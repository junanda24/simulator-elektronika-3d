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
 */

export type { SimSnapshot };

interface CircuitParts {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  boardId: string;
}

let remote: Comlink.Remote<SimWorkerApi> | null = null;
let localSession: SimSession | null = null;
let workerRef: Worker | null = null;
let initialized = false;

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

/** Aktifkan sesi lokal (fallback) dan putar ulang state terakhir. */
function useLocalSession(): void {
  if (localSession) return;
  remote = null;
  if (workerRef) {
    try {
      workerRef.terminate();
    } catch {
      /* worker sudah mati; abaikan */
    }
    workerRef = null;
  }
  localSession = new SimSession();
  if (snapshotHandler) localSession.setSnapshotListener(snapshotHandler);
  if (lastParts) localSession.setCircuit(lastParts);
  if (lastPowered !== null) localSession.setPowered(lastPowered);
  if (lastSketch !== null) localSession.startSketch(lastSketch);
}

export function initSim(onSnapshot: (snapshot: SimSnapshot) => void): void {
  if (initialized) return;
  initialized = true;
  snapshotHandler = onSnapshot;
  try {
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef = worker;
    remote = Comlink.wrap<SimWorkerApi>(worker);
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      useLocalSession();
    };
    worker.addEventListener('error', fallback);
    // Bukti round-trip: promise ini hanya selesai bila modul worker
    // benar-benar termuat dan method-nya ada. Timeout = worker mati diam.
    void Promise.race([
      Promise.resolve(
        remote.setSnapshotListener(Comlink.proxy(onSnapshot) as never),
      ).then(() => 'ok' as const),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 2000),
      ),
    ]).then((outcome) => {
      if (outcome !== 'ok') fallback();
    });
  } catch {
    useLocalSession();
  }
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
