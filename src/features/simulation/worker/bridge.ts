import * as Comlink from 'comlink';
import type { ComponentInstanceState } from '../../../shared/types';
import type { WireConnection } from '../../wiring/netlist';
import { SimSession, type SimSnapshot } from './simSession';
import type { SimWorkerApi } from './sim.worker';

/**
 * Jembatan main thread ↔ sesi simulasi. Sesi berjalan di Web Worker
 * (comlink); bila Worker gagal dibuat, sesi yang sama dipakai langsung
 * di main thread — perilaku identik, hanya tanpa isolasi thread.
 *
 * Jalur diam yang ditutup (audit jalur Run): konstruksi `new Worker`
 * bisa SUKSES sementara script worker-nya gagal dimuat (bundle rusak,
 * browser lama) — tanpa penjagaan, semua panggilan comlink menggantung
 * selamanya dan tombol Jalankan terlihat mati total tanpa error apa pun.
 * Karena itu pendaftaran listener dibuktikan dengan round-trip: bila
 * tidak terjawab dalam batas waktu (atau worker memancarkan error),
 * bridge beralih ke sesi lokal dan MEMUTAR ULANG state terakhir
 * (rangkaian + daya + sketch) yang sempat terkirim ke worker.
 *
 * Self-healing (2026-10-21) — worker yang mati DI TENGAH sesi tidak
 * lagi menjatuhkan seluruh aplikasi:
 *  1. Watchdog: ping berkala ke worker; worker yang tidak menjawab
 *     melewati ambang (sketch beku / worker mati diam tanpa event
 *     error) dinyatakan mati, BUKAN ditunggu selamanya.
 *  2. Pemulihan: worker lama diterminasi, worker BARU dibuat dan
 *     dibuktikan round-trip, lalu state terakhir diputar ulang
 *     (rangkaian selalu; daya + sketch sesuai jenis kegagalan —
 *     sketch yang beku SENGAJA tidak dijalankan ulang, sesi kembali
 *     berhenti dengan sketch utuh). Bila worker baru pun gagal, jalur
 *     terakhir adalah sesi lokal yang sudah terbukti di atas.
 *  3. Kejujuran: setiap pemulihan dicatat di log pemulihan
 *     (getSimRecoveryLog) dan diberitahukan satu kali ke pengguna
 *     lewat kolom `notice` pada snapshot berikutnya + listener
 *     pemulihan (setSimRecoveryListener) — tidak ada pemulihan diam.
 */

export type { SimSnapshot };

interface CircuitParts {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  boardId: string;
}

/** Batas bukti round-trip pendaftaran listener worker (ms). */
const WORKER_PROOF_TIMEOUT_MS = 2000;
/** Selang ping watchdog ke worker (ms). */
export const WATCHDOG_INTERVAL_MS = 1000;
/**
 * Ambang worker dinyatakan beku/mati: ping yang lebih tua dari ini
 * tanpa jawaban. 3 detik cukup longgar untuk solve rangkaian besar
 * yang sah (ratusan ms), cukup ketat agar pengguna tidak menatap
 * layar beku lama.
 */
export const WATCHDOG_TIMEOUT_MS = 3000;

/** Sebab pemulihan worker dijalankan. */
export type SimRecoveryReason = 'worker-error' | 'watchdog' | 'ping-gagal';
/** Hasil akhir satu peristiwa pemulihan. */
export type SimRecoveryOutcome = 'worker-restart' | 'local-fallback';

export interface SimRecoveryEntry {
  /** Stempel waktu (Date.now) saat pemulihan selesai. */
  at: number;
  reason: SimRecoveryReason;
  outcome: SimRecoveryOutcome;
}

const NOTICE_WORKER_RESTARTED =
  'Mesin simulasi dimulai ulang otomatis — rangkaianmu utuh.';
const NOTICE_SKETCH_FROZEN =
  'Sketch tidak merespons dan dihentikan. Mesin simulasi dimulai ulang ' +
  'otomatis — rangkaianmu utuh, tekan Jalankan untuk melanjutkan.';

let remote: Comlink.Remote<SimWorkerApi> | null = null;
let localSession: SimSession | null = null;
let workerRef: Worker | null = null;
let initialized = false;
/** Worker saat ini sudah lolos bukti round-trip (bukan sekadar dibuat). */
let workerEstablished = false;

/** State terakhir yang dikirim UI — diputar ulang bila beralih ke lokal. */
let snapshotHandler: ((snapshot: SimSnapshot) => void) | null = null;
let lastParts: CircuitParts | null = null;
let lastPowered: boolean | null = null;
let lastSketch: string | null = null;

/**
 * Pelacakan operasi sibuk (indikator "Memproses…"): penghitung perintah
 * yang sedang berjalan (in-flight). Listener menerima `true` saat
 * penghitung naik dari 0 (perintah pertama dikirim) dan `false` saat
 * kembali ke 0 (perintah terakhir selesai dieksekusi sesi). Untuk jalur
 * worker, selesai = promise comlink settle; untuk fallback sesi lokal,
 * selesai = panggilan sinkron kembali (snapshot-nya sendiri sudah
 * terkirim sinkron di dalamnya). Store memakai tepi naik ini untuk
 * mengunci latch `simBusy` miliknya.
 */
let inFlight = 0;
let busyListener: ((busy: boolean) => void) | null = null;

export function setSimBusyListener(
  listener: ((busy: boolean) => void) | null,
): void {
  busyListener = listener;
}

function opBegin(): void {
  inFlight += 1;
  if (inFlight === 1) busyListener?.(true);
}

function opEnd(): void {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) busyListener?.(false);
}

/** Kirim satu perintah sesi sambil melacak status sibuknya. */
function dispatchOp(
  remoteCall: () => Promise<unknown>,
  localCall: () => void,
): void {
  opBegin();
  try {
    if (remote) {
      void Promise.resolve(remoteCall()).then(opEnd, opEnd);
    } else {
      localCall();
      opEnd();
    }
  } catch {
    opEnd();
  }
}

/* ------------------------------------------------------------------ */
/* Pemberitahuan pemulihan & log                                       */
/* ------------------------------------------------------------------ */

/** Notice one-shot menunggu snapshot berikutnya yang diteruskan ke UI. */
let pendingBridgeNotice: string | null = null;
const recoveryLog: SimRecoveryEntry[] = [];
let recoveryListener: ((entry: SimRecoveryEntry) => void) | null = null;

/** Daftarkan pendengar peristiwa pemulihan mesin simulasi. */
export function setSimRecoveryListener(
  listener: ((entry: SimRecoveryEntry) => void) | null,
): void {
  recoveryListener = listener;
}

/**
 * Pendengar pemulihan TAMBAHAN (multi-pendengar, himpunan) — untuk
 * konsumen permanen yang tidak boleh saling merebut slot tunggal di
 * atas (slot itu dipakai DiagnosticsPanel selama panel terpasang).
 * Mengembalikan fungsi berhenti-berlangganan.
 */
const recoveryListeners = new Set<(entry: SimRecoveryEntry) => void>();

export function addSimRecoveryListener(
  listener: (entry: SimRecoveryEntry) => void,
): () => void {
  recoveryListeners.add(listener);
  return () => {
    recoveryListeners.delete(listener);
  };
}

/** Salinan log pemulihan (terlama dulu, maks 20 entri). */
export function getSimRecoveryLog(): SimRecoveryEntry[] {
  return [...recoveryLog];
}

function recordRecovery(
  reason: SimRecoveryReason,
  outcome: SimRecoveryOutcome,
  notice: string,
): void {
  const entry: SimRecoveryEntry = { at: Date.now(), reason, outcome };
  recoveryLog.push(entry);
  if (recoveryLog.length > 20) recoveryLog.shift();
  pendingBridgeNotice = notice;
  recoveryListener?.(entry);
  for (const listener of recoveryListeners) listener(entry);
}

/**
 * Penerus snapshot satu-satunya ke UI: menyuntikkan notice pemulihan
 * bridge (one-shot) ke snapshot pertama yang lewat setelah pemulihan,
 * hanya bila sesi sendiri tidak sedang membawa notice-nya — bila sesi
 * membawanya, notice bridge ditahan satu snapshot agar tidak tertelan.
 */
function forwardSnapshot(snapshot: SimSnapshot): void {
  if (!snapshotHandler) return;
  if (pendingBridgeNotice !== null && !snapshot.notice) {
    const notice = pendingBridgeNotice;
    pendingBridgeNotice = null;
    snapshotHandler({ ...snapshot, notice });
    return;
  }
  snapshotHandler(snapshot);
}

/* ------------------------------------------------------------------ */
/* Pembuatan worker & bukti round-trip                                 */
/* ------------------------------------------------------------------ */

/** Pabrik worker — dapat diganti tes untuk menyuntikkan worker palsu. */
let workerFactory: (() => Worker) | null = null;

/** KHUSUS TES: ganti pabrik worker (null = pabrik bawaan browser). */
export function __setSimWorkerFactoryForTests(
  factory: (() => Worker) | null,
): void {
  workerFactory = factory;
}

/** KHUSUS TES: sesuaikan irama watchdog agar tes tidak menunggu detik nyata. */
export function __setWatchdogTimingForTests(
  intervalMs: number,
  timeoutMs: number,
): void {
  watchdogIntervalMs = intervalMs;
  watchdogTimeoutMs = timeoutMs;
}

let watchdogIntervalMs: number = WATCHDOG_INTERVAL_MS;
let watchdogTimeoutMs: number = WATCHDOG_TIMEOUT_MS;

function createWorker(): Worker {
  if (workerFactory) return workerFactory();
  return new Worker(new URL('./sim.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function terminateWorker(): void {
  if (!workerRef) return;
  try {
    workerRef.terminate();
  } catch {
    /* worker sudah mati; abaikan */
  }
  workerRef = null;
}

/** Satu worker yang baru dipasang (remote terpasang optimistis). */
interface SpawnedWorker {
  worker: Worker;
  /** true bila event error tiba sebelum bukti round-trip selesai. */
  errorBeforeProof: boolean;
}

/**
 * Buat worker dan pasang sebagai `remote` SAAT INI JUGA (optimistis,
 * seperti bridge historis: perintah yang dikirim selama pembuktian
 * mengalir ke worker ini; bila pembuktian gagal, state-nya diputar
 * ulang dari catatan `last*` oleh jalur pemulihan). null = konstruksi
 * worker melempar (browser tanpa Worker / bundle rusak total).
 */
function beginSpawn(): SpawnedWorker | null {
  let worker: Worker;
  try {
    worker = createWorker();
  } catch {
    return null;
  }
  const spawned: SpawnedWorker = { worker, errorBeforeProof: false };
  workerRef = worker;
  remote = Comlink.wrap<SimWorkerApi>(worker);
  workerEstablished = false;
  worker.addEventListener('error', () => {
    // Event dari worker generasi lama (sudah diganti) diabaikan.
    if (workerRef !== worker) return;
    if (!workerEstablished) {
      spawned.errorBeforeProof = true;
    } else {
      void recoverFromWorkerFailure('worker-error', { restartSketch: true });
    }
  });
  return spawned;
}

/**
 * Bukti round-trip untuk worker yang baru dipasang: promise ini hanya
 * selesai 'ok' bila modul worker benar-benar termuat, method-nya ada,
 * dan tidak ada error sebelum bukti selesai. Gagal → worker dibuang;
 * pemanggil memutuskan jalur berikutnya.
 */
async function proveSpawn(spawned: SpawnedWorker): Promise<boolean> {
  const candidate = remote;
  if (!candidate || workerRef !== spawned.worker) return false;
  const outcome = await Promise.race([
    Promise.resolve(
      candidate.setSnapshotListener(Comlink.proxy(forwardSnapshot) as never),
    ).then(
      () => 'ok' as const,
      () => 'error' as const,
    ),
    new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), WORKER_PROOF_TIMEOUT_MS),
    ),
  ]);
  if (outcome !== 'ok' || spawned.errorBeforeProof || workerRef !== spawned.worker) {
    if (workerRef === spawned.worker) {
      remote = null;
      terminateWorker();
    }
    return false;
  }
  workerEstablished = true;
  return true;
}

/** Putar ulang state terakhir ke sesi yang sedang aktif (worker/lokal). */
function replayState(opts: { restartSketch: boolean }): void {
  if (lastParts) simSetCircuit(lastParts);
  if (opts.restartSketch) {
    if (lastPowered !== null) simSetPowered(lastPowered);
    if (lastSketch !== null) simStartSketch(lastSketch);
  } else {
    // Keadaan berhenti yang jujur: daya mati, sketch tidak dijalankan
    // ulang. lastPowered disamakan agar putar-ulang berikutnya (bila
    // ada kegagalan lain) tidak menghidupkan daya secara diam-diam;
    // UI menghidupkan lagi lewat Jalankan seperti biasa.
    simSetPowered(false);
  }
}

/** Aktifkan sesi lokal (fallback terakhir) dan putar ulang state terakhir. */
function useLocalSession(
  opts: { restartSketch: boolean } = { restartSketch: true },
): void {
  if (localSession) {
    replayState(opts);
    return;
  }
  remote = null;
  workerEstablished = false;
  terminateWorker();
  stopWatchdog();
  localSession = new SimSession();
  localSession.setSnapshotListener(forwardSnapshot);
  replayState(opts);
}

/* ------------------------------------------------------------------ */
/* Pemulihan worker di tengah sesi                                     */
/* ------------------------------------------------------------------ */

let recovering = false;

/**
 * Sembuhkan kegagalan worker di tengah sesi: terminasi → worker baru +
 * bukti round-trip → putar ulang state. Worker baru gagal → sesi lokal
 * (dengan semantik putar-ulang yang sama). Selalu dicatat + diberitahu.
 */
async function recoverFromWorkerFailure(
  reason: SimRecoveryReason,
  opts: { restartSketch: boolean },
): Promise<void> {
  if (recovering || localSession) return;
  recovering = true;
  try {
    // Perintah yang menggantung di worker mati tidak akan pernah
    // settle — nolkan penghitung sibuk agar indikator "Memproses…"
    // tidak terkunci selamanya oleh pemulihan ini.
    if (inFlight > 0) {
      inFlight = 0;
      busyListener?.(false);
    }
    remote = null;
    workerEstablished = false;
    terminateWorker();
    stopWatchdog();

    const notice = opts.restartSketch
      ? NOTICE_WORKER_RESTARTED
      : NOTICE_SKETCH_FROZEN;

    const spawned = beginSpawn();
    if (spawned && (await proveSpawn(spawned))) {
      replayState(opts);
      startWatchdog();
      recordRecovery(reason, 'worker-restart', notice);
    } else {
      useLocalSession(opts);
      recordRecovery(reason, 'local-fallback', notice);
    }
  } finally {
    recovering = false;
  }
}

/* ------------------------------------------------------------------ */
/* Watchdog: detak jantung worker                                      */
/* ------------------------------------------------------------------ */

let watchdogTimer: ReturnType<typeof setInterval> | null = null;
/** Stempel pengiriman ping yang belum terjawab (null = tidak ada). */
let pendingPingSince: number | null = null;

function watchdogTick(): void {
  if (!remote || !workerEstablished || recovering || localSession) return;
  // Tab tersembunyi: timer main thread & worker sama-sama dilambatkan
  // browser — memaafkan ping yang tertunda di sini mencegah vonis beku
  // palsu hanya karena pengguna berpindah tab.
  if (typeof document !== 'undefined' && document.hidden) {
    pendingPingSince = null;
    return;
  }
  const now = Date.now();
  if (pendingPingSince !== null) {
    if (now - pendingPingSince > watchdogTimeoutMs) {
      pendingPingSince = null;
      void recoverFromWorkerFailure('watchdog', { restartSketch: false });
    }
    return;
  }
  pendingPingSince = now;
  const pingRemote = remote;
  void Promise.resolve(pingRemote.ping()).then(
    () => {
      // Pong dari worker generasi lama (sudah diganti) tidak boleh
      // membersihkan penanda ping generasi baru.
      if (remote === pingRemote) pendingPingSince = null;
    },
    () => {
      if (remote === pingRemote) {
        pendingPingSince = null;
        void recoverFromWorkerFailure('ping-gagal', { restartSketch: true });
      }
    },
  );
}

function startWatchdog(): void {
  if (watchdogTimer) return;
  pendingPingSince = null;
  watchdogTimer = setInterval(watchdogTick, watchdogIntervalMs);
}

function stopWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  pendingPingSince = null;
}

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

export function initSim(onSnapshot: (snapshot: SimSnapshot) => void): void {
  if (initialized) return;
  initialized = true;
  snapshotHandler = onSnapshot;
  const spawned = beginSpawn();
  if (!spawned) {
    // Konstruksi Worker melempar (lingkungan tanpa Worker — termasuk
    // node di tes): sesi lokal seketika, sama seperti bridge historis.
    useLocalSession();
    return;
  }
  void proveSpawn(spawned).then((ok) => {
    if (ok) {
      startWatchdog();
    } else if (workerRef === null && !localSession) {
      // Bukti gagal & belum ada yang mengambil alih → jalur historis:
      // sesi lokal dengan putar-ulang state terakhir.
      useLocalSession();
    }
  });
}

export function simSetCircuit(parts: CircuitParts): void {
  lastParts = parts;
  dispatchOp(
    () => remote!.setCircuit(parts as never),
    () => localSession?.setCircuit(parts),
  );
}

export function simSetPowered(on: boolean): void {
  lastPowered = on;
  dispatchOp(
    () => remote!.setPowered(on),
    () => localSession?.setPowered(on),
  );
}

export function simStartSketch(source: string): void {
  lastSketch = source;
  dispatchOp(
    () => remote!.startSketch(source),
    () => localSession?.startSketch(source),
  );
}

export function simStopSketch(): void {
  lastSketch = null;
  dispatchOp(
    () => remote!.stopSketch(),
    () => localSession?.stopSketch(),
  );
}

export function simClearBoardDamage(): void {
  dispatchOp(
    () => remote!.clearBoardDamage(),
    () => localSession?.clearBoardDamage(),
  );
}

/**
 * Ping diagnostik untuk panel "Periksa Kesehatan": ukur round-trip
 * bridge apa adanya — worker (pong comlink) atau sesi lokal (panggilan
 * langsung). null = tidak ada sesi yang bisa menjawab sama sekali.
 */
export async function simDiagnosticsPing(): Promise<{
  mode: 'worker' | 'local';
  latencyMs: number;
} | null> {
  const startedAt = Date.now();
  if (remote) {
    try {
      await Promise.race([
        Promise.resolve(remote.ping()),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('ping timeout')),
            WORKER_PROOF_TIMEOUT_MS,
          ),
        ),
      ]);
      return { mode: 'worker', latencyMs: Date.now() - startedAt };
    } catch {
      return null;
    }
  }
  if (localSession) {
    return { mode: 'local', latencyMs: Date.now() - startedAt };
  }
  return null;
}

/**
 * KHUSUS TES: bongkar seluruh state modul bridge (worker diterminasi,
 * sesi lokal dibuang, watchdog berhenti, log & listener dibersihkan)
 * agar tiap skenario tes mulai dari keadaan awal yang bersih.
 */
export function __resetBridgeForTests(): void {
  stopWatchdog();
  terminateWorker();
  remote = null;
  localSession = null;
  initialized = false;
  workerEstablished = false;
  snapshotHandler = null;
  lastParts = null;
  lastPowered = null;
  lastSketch = null;
  inFlight = 0;
  busyListener = null;
  pendingBridgeNotice = null;
  recoveryLog.length = 0;
  recoveryListener = null;
  recoveryListeners.clear();
  recovering = false;
  workerFactory = null;
  watchdogIntervalMs = WATCHDOG_INTERVAL_MS;
  watchdogTimeoutMs = WATCHDOG_TIMEOUT_MS;
}
