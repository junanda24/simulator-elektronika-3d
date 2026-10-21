/**
 * Log error lokal (self-healing SH-1, perintah user 2026-10-21: web
 * harus "self healing" dan matang sebagai bahan belajar publik).
 *
 * Error yang tertangkap error boundary maupun penangan global
 * (window.onerror / unhandledrejection di main.tsx) dicatat di sini
 * agar bisa diperiksa belakangan — panel diagnostik membaca kunci
 * localStorage yang sama. KONTRAK STRING: kunci "sim3d:errorlog"
 * dibaca lintas modul (panel diagnostik SH-2) — JANGAN diganti.
 *
 * Prinsip: mencatat error TIDAK BOLEH pernah melempar error baru.
 * Semua akses storage dibungkus try/catch; bila storage tidak
 * tersedia (mode privat, kuota penuh), pencatatan dilewati diam-diam —
 * error aslinya tetap tampil di console oleh pemanggil.
 */

export interface ErrorLogEntry {
  /** Waktu kejadian, ISO 8601. */
  at: string;
  /** Pesan error yang bisa dibaca manusia. */
  message: string;
  /** Sumber singkat: 'boundary:app' | 'boundary:canvas' | 'window.onerror' | 'unhandledrejection' | 'chunk' | … */
  context: string;
  /** Stack dipotong (±1200 karakter) untuk diagnosis; boleh tidak ada. */
  stack?: string;
}

export const ERROR_LOG_KEY = 'sim3d:errorlog';
export const ERROR_LOG_LIMIT = 50;

const STACK_LIMIT = 1200;

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isErrorLogEntry(value: unknown): value is ErrorLogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Partial<ErrorLogEntry>;
  return (
    typeof e.at === 'string' &&
    typeof e.message === 'string' &&
    typeof e.context === 'string' &&
    (e.stack === undefined || typeof e.stack === 'string')
  );
}

/** Baca seluruh log; entri rusak di dalam array dibuang, bukan menggagalkan pembacaan. */
export function readErrorLog(): ErrorLogEntry[] {
  const storage = storageOrNull();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ERROR_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isErrorLogEntry).slice(-ERROR_LOG_LIMIT);
  } catch {
    return [];
  }
}

/** Ubah nilai tak dikenal (Error, string, objek) menjadi pesan ringkas. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Error tanpa pesan',
      stack: error.stack ? error.stack.slice(0, STACK_LIMIT) : undefined,
    };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * Catat satu error. Mengembalikan entri yang dicatat, atau null bila
 * pencatatan tidak mungkin (storage tidak tersedia). Rotasi: hanya
 * ERROR_LOG_LIMIT entri terakhir yang disimpan.
 */
export function logError(error: unknown, context: string): ErrorLogEntry | null {
  const { message, stack } = describeError(error);
  const entry: ErrorLogEntry = {
    at: new Date().toISOString(),
    message,
    context,
    ...(stack ? { stack } : {}),
  };
  const storage = storageOrNull();
  if (!storage) return null;
  try {
    const next = [...readErrorLog(), entry].slice(-ERROR_LOG_LIMIT);
    storage.setItem(ERROR_LOG_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

/** Kosongkan log (mis. dari panel diagnostik setelah error ditangani). */
export function clearErrorLog(): void {
  const storage = storageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(ERROR_LOG_KEY);
  } catch {
    /* abaikan — lihat prinsip di header */
  }
}
