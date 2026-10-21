/**
 * Diagnostik mandiri "Periksa Kesehatan" (self-healing, 2026-10-21):
 * logika pemeriksaan NYATA yang dipakai DiagnosticsPanel — dipisah
 * dari render agar bisa dites di node. Empat pemeriksaan:
 *  (a) Mesin simulasi — round-trip ping ke bridge (worker/lokal).
 *  (b) Solver — rangkaian acuan kecil (pembagi 1 kΩ/1 kΩ dari 5 V)
 *      yang hasilnya diketahui pasti: node tengah 2,5 V ± 0,05 V.
 *  (c) Penyimpanan lokal — tulis/baca/hapus kunci uji.
 *  (d) WebGL — konteks webgl2 bisa dibuat (cara yang sama dengan
 *      penjaga boot di index.html).
 *
 * Log error lokal dibaca dari kunci kontrak `sim3d:errorlog` secara
 * defensif: format penulisnya (cangkang aplikasi) adalah array JSON;
 * entri yang bentuknya tidak dikenal tetap ditampilkan sebagai teks
 * mentahnya, tidak pernah melempar.
 */

import { EMPTY_SIM_RESULT, type ComponentInstanceState } from '../shared/types';
import { solveCircuit } from '../features/simulation/solver/engine';
import { simDiagnosticsPing } from '../features/simulation/worker/bridge';
import { RESISTOR_META } from '../shared/components/catalog/resistor/meta';
import { resistorElectrical } from '../shared/components/catalog/resistor/electrical';

/** Kunci localStorage log error lokal (kontrak dengan cangkang aplikasi). */
export const ERROR_LOG_KEY = 'sim3d:errorlog';
/** Kunci uji tulis/baca untuk pemeriksaan penyimpanan. */
const STORAGE_PROBE_KEY = 'sim3d:health-probe';

export type HealthCheckId = 'worker' | 'solver' | 'storage' | 'webgl';

export interface HealthCheckResult {
  id: HealthCheckId;
  label: string;
  ok: boolean;
  /** Penjelasan satu baris — ditampilkan panel terutama saat bermasalah. */
  detail: string;
}

/** Ketergantungan pemeriksaan — disuntikkan agar logika bisa dites. */
export interface HealthCheckDeps {
  ping: () => Promise<{ mode: 'worker' | 'local'; latencyMs: number } | null>;
  solveReference: () => { volts: number | null; solveError?: string };
  storageProbe: () => boolean;
  webglProbe: () => boolean;
}

function referenceInstance(id: string): ComponentInstanceState {
  return {
    id,
    type: RESISTOR_META.type,
    position: [0, 0, 0],
    rotation: 0,
    props: { resistance: 1000 },
    interactiveState: {},
    simState: { ...EMPTY_SIM_RESULT },
  };
}

/**
 * Solve rangkaian acuan: 5 V → 1 kΩ → node MID → 1 kΩ → GND.
 * Node tengah harus 2,5 V (toleransi panel ±0,05 V).
 */
export function solveReferenceCircuit(): {
  volts: number | null;
  solveError?: string;
} {
  const solution = solveCircuit(
    {
      instances: [referenceInstance('ref-r1'), referenceInstance('ref-r2')],
      pinNets: {
        'ref-r1:A': 'V5',
        'ref-r1:B': 'MID',
        'ref-r2:A': 'MID',
        'ref-r2:B': 'GND',
      },
      sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
    },
    (type) => (type === RESISTOR_META.type ? resistorElectrical : undefined),
  );
  const volts = solution.voltages.get('MID');
  return {
    volts: volts === undefined ? null : volts,
    ...(solution.solveError ? { solveError: solution.solveError } : {}),
  };
}

function browserStorageProbe(): boolean {
  try {
    const storage = window.localStorage;
    storage.setItem(STORAGE_PROBE_KEY, '1');
    const ok = storage.getItem(STORAGE_PROBE_KEY) === '1';
    storage.removeItem(STORAGE_PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
}

/** Probe WebGL — pola yang sama persis dengan penjaga boot index.html. */
function browserWebglProbe(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const probe = document.createElement('canvas');
    const gl = window.WebGL2RenderingContext
      ? probe.getContext('webgl2')
      : null;
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Ketergantungan bawaan untuk browser nyata. */
export function defaultHealthCheckDeps(): HealthCheckDeps {
  return {
    ping: simDiagnosticsPing,
    solveReference: solveReferenceCircuit,
    storageProbe: browserStorageProbe,
    webglProbe: browserWebglProbe,
  };
}

/** Jalankan keempat pemeriksaan dan susun hasil per item. */
export async function runHealthChecks(
  deps: HealthCheckDeps,
): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];

  // (a) Mesin simulasi — round-trip ping ke bridge.
  try {
    const ping = await deps.ping();
    if (ping === null) {
      results.push({
        id: 'worker',
        label: 'Mesin simulasi (worker)',
        ok: false,
        detail:
          'Bridge tidak menjawab ping — worker mungkin mati atau sesi belum dimulai.',
      });
    } else if (ping.mode === 'worker') {
      results.push({
        id: 'worker',
        label: 'Mesin simulasi (worker)',
        ok: true,
        detail: `Worker menjawab round-trip dalam ${ping.latencyMs} ms.`,
      });
    } else {
      results.push({
        id: 'worker',
        label: 'Mesin simulasi (worker)',
        ok: true,
        detail:
          'Worker tidak dipakai — sesi cadangan lokal aktif dan menjawab ping.',
      });
    }
  } catch {
    results.push({
      id: 'worker',
      label: 'Mesin simulasi (worker)',
      ok: false,
      detail: 'Ping ke bridge melempar error.',
    });
  }

  // (b) Solver — rangkaian acuan dengan hasil yang diketahui pasti.
  try {
    const ref = deps.solveReference();
    if (ref.volts !== null && Math.abs(ref.volts - 2.5) <= 0.05 && !ref.solveError) {
      results.push({
        id: 'solver',
        label: 'Solver rangkaian',
        ok: true,
        detail: `Rangkaian acuan terhitung benar (node tengah ${ref.volts
          .toFixed(2)
          .replace('.', ',')} V dari seharusnya 2,50 V).`,
      });
    } else {
      results.push({
        id: 'solver',
        label: 'Solver rangkaian',
        ok: false,
        detail:
          ref.solveError ??
          `Node tengah rangkaian acuan ${
            ref.volts === null ? 'tidak terhitung' : `${ref.volts} V`
          } — seharusnya 2,50 V ± 0,05 V.`,
      });
    }
  } catch {
    results.push({
      id: 'solver',
      label: 'Solver rangkaian',
      ok: false,
      detail: 'Solver melempar error saat menghitung rangkaian acuan.',
    });
  }

  // (c) Penyimpanan lokal.
  results.push(
    deps.storageProbe()
      ? {
          id: 'storage',
          label: 'Penyimpanan lokal',
          ok: true,
          detail: 'Tulis/baca/hapus kunci uji berhasil.',
        }
      : {
          id: 'storage',
          label: 'Penyimpanan lokal',
          ok: false,
          detail:
            'localStorage tidak bisa ditulis — progres pelajaran & sesi mungkin tidak tersimpan.',
        },
  );

  // (d) WebGL.
  results.push(
    deps.webglProbe()
      ? {
          id: 'webgl',
          label: 'WebGL (tampilan 3D)',
          ok: true,
          detail: 'Konteks WebGL2 berhasil dibuat.',
        }
      : {
          id: 'webgl',
          label: 'WebGL (tampilan 3D)',
          ok: false,
          detail:
            'Konteks WebGL2 tidak bisa dibuat — meja kerja 3D tidak dapat digambar di browser ini.',
        },
  );

  return results;
}

/* ------------------------------------------------------------------ */
/* Log error lokal (sim3d:errorlog)                                    */
/* ------------------------------------------------------------------ */

export interface ErrorLogEntry {
  /** Stempel waktu mentah dari entri (string), '' bila tidak ada. */
  at: string;
  /** Pesan yang ditampilkan. */
  message: string;
}

/** Bentuk penyimpanan minimal yang dibutuhkan (localStorage-compatible). */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/**
 * Urai isi mentah kunci log — defensif penuh: null/rusak/bukan array
 * menghasilkan daftar kosong (bentuk objek tunggal dibaca sebagai
 * satu entri). Urutan dipertahankan apa adanya (penulis menentukan).
 */
export function parseErrorLog(raw: string | null): ErrorLogEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const entries: ErrorLogEntry[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      entries.push({ at: '', message: item });
    } else if (item !== null && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const at =
        typeof record.at === 'string'
          ? record.at
          : typeof record.time === 'string'
            ? record.time
            : typeof record.timestamp === 'number'
              ? new Date(record.timestamp).toISOString()
              : '';
      const baseMessage =
        typeof record.message === 'string'
          ? record.message
          : typeof record.error === 'string'
            ? record.error
            : JSON.stringify(item);
      // Konteks sumber error (kontrak penulis log: 'boundary:app',
      // 'window.onerror', …) dilipat ke pesan agar log yang disalin
      // untuk laporan bug tetap membawa asal errornya.
      const message =
        typeof record.context === 'string' && record.context
          ? `${baseMessage} [${record.context}]`
          : baseMessage;
      entries.push({ at, message });
    }
  }
  return entries.slice(-30);
}

/** Baca log error dari penyimpanan (gagal baca = daftar kosong). */
export function readErrorLog(storage: StorageLike | null): ErrorLogEntry[] {
  if (!storage) return [];
  try {
    return parseErrorLog(storage.getItem(ERROR_LOG_KEY));
  } catch {
    return [];
  }
}

/** Hapus log error dari penyimpanan. */
export function clearErrorLog(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(ERROR_LOG_KEY);
  } catch {
    /* penyimpanan tidak tersedia; abaikan */
  }
}

/** Teks polos log untuk disalin ke clipboard. */
export function formatErrorLog(entries: readonly ErrorLogEntry[]): string {
  return entries
    .map((entry) => (entry.at ? `[${entry.at}] ${entry.message}` : entry.message))
    .join('\n');
}
