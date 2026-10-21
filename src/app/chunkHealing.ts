/**
 * Penyembuhan chunk basi (self-healing SH-1).
 *
 * Penyakit klasik web publik: setelah deploy baru, browser yang masih
 * memegang index.html lama meminta berkas chunk JS dengan hash lama
 * yang sudah tidak ada di server → aplikasi gagal dimuat (layar putih).
 * Obatnya: muat ulang halaman SATU kali agar browser mengambil
 * index.html + chunk terbaru. Agar tidak berubah menjadi loop reload
 * bila kegagalannya persisten (mis. koneksi benar-benar putus), upaya
 * reload ditandai bertanda waktu di sessionStorage: reload otomatis
 * hanya boleh bila upaya terakhir lewat dari CHUNK_RELOAD_WINDOW_MS,
 * atau belum pernah ada. Upaya kedua dalam jendela yang sama
 * MENYERAH dengan jujur (pesan ditampilkan, error dicatat ke log).
 *
 * KONTRAK: kunci sessionStorage "sim3d:chunk-reload-at" + jendela
 * 60 detik yang sama dipakai skrip penjaga inline di index.html
 * (titik deteksi paling awal, untuk <script> entri yang 404).
 * Ubah salah satu → ubah keduanya.
 */

import { logError } from './errorLog';

export const CHUNK_RELOAD_AT_KEY = 'sim3d:chunk-reload-at';
export const CHUNK_RELOAD_WINDOW_MS = 60_000;

/** Bentuk minimal storage yang dibutuhkan logika penanda (agar bisa dites tanpa DOM). */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const CHUNK_ERROR_PATTERNS: readonly string[] = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
  'loading chunk',
  'failed to load dynamically imported module',
  'error loading dynamically imported module',
  'unable to preload css',
];

/**
 * Kenali error kegagalan memuat chunk dari Error / string / objek
 * mirip-error (mis. ErrorEvent.message, promise rejection reason).
 */
export function isChunkLoadError(value: unknown): boolean {
  let name = '';
  let message = '';
  if (value instanceof Error) {
    name = value.name;
    message = value.message;
  } else if (typeof value === 'string') {
    message = value;
  } else if (typeof value === 'object' && value !== null) {
    const v = value as { name?: unknown; message?: unknown };
    if (typeof v.name === 'string') name = v.name;
    if (typeof v.message === 'string') message = v.message;
  }
  if (name === 'ChunkLoadError') return true;
  const haystack = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function sessionStorageOrNull(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Boleh reload otomatis sekarang? Boleh bila belum pernah ada upaya,
 * atau upaya terakhir sudah lewat jendela. Tanpa sessionStorage kita
 * tidak bisa membuktikan upaya sebelumnya → TIDAK reload (mencegah
 * loop buta lebih penting daripada menyembuhkan di lingkungan langka
 * tanpa sessionStorage).
 */
export function chunkReloadAllowed(nowMs: number, storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(CHUNK_RELOAD_AT_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return nowMs - last > CHUNK_RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Tandai bahwa reload otomatis dilakukan pada waktu ini. */
export function markChunkReload(nowMs: number, storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(CHUNK_RELOAD_AT_KEY, String(nowMs));
  } catch {
    /* penanda gagal ditulis — reload tetap dilakukan oleh pemanggil */
  }
}

export type ChunkErrorOutcome = 'ignored' | 'reloaded' | 'gave-up';

/**
 * Tangani satu error yang mungkin berasal dari chunk basi:
 * - bukan error chunk → 'ignored' (pemanggil menangani seperti biasa);
 * - error chunk & reload masih boleh → tandai, reload halaman, 'reloaded';
 * - error chunk & sudah pernah reload dalam jendela → catat ke log
 *   error dan 'gave-up' (pemanggil menampilkan pesan jujur; TIDAK loop).
 */
export function handleChunkLoadError(value: unknown): ChunkErrorOutcome {
  if (!isChunkLoadError(value)) return 'ignored';
  const storage = sessionStorageOrNull();
  const now = Date.now();
  if (!chunkReloadAllowed(now, storage)) {
    logError(value, 'chunk:menyerah');
    return 'gave-up';
  }
  markChunkReload(now, storage);
  try {
    globalThis.location?.reload();
  } catch {
    /* lingkungan tanpa location (tes) — penanda sudah tercatat */
  }
  return 'reloaded';
}
