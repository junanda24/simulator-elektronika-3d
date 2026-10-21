/**
 * Persistensi sesi rangkaian (self-healing SH-1): autosave rangkaian
 * yang sedang dikerjakan agar pekerjaan pengguna TIDAK hilang oleh
 * crash, reload tak sengaja, atau tab tertutup — dan pemulihan yang
 * aman saat data simpanan ternyata rusak.
 *
 * Bentuk simpanan = amplop berversi di localStorage:
 *   { version: 1, savedAt: <ISO>, payload: SharedProject }
 * Payload memakai serialisasi yang SUDAH ada (projectShare) — tidak
 * ada format rangkaian kedua.
 *
 * Aturan pemulihan (jujur, tanpa tebak-tebakan):
 * - Amplop versi kini + payload lolos validateSharedProject → pulihkan.
 * - Format LAMA yang dikenal (versi 0 = proyek SharedProject mentah
 *   tanpa amplop, dari masa sebelum amplop ada) → MIGRASI: dibungkus
 *   amplop versi kini, ditulis ulang, lalu dipulihkan.
 * - Versi amplop tak dikenal / JSON rusak / payload gagal validasi →
 *   KARANTINA: salinan mentah dipindah ke kunci
 *   "sim3d:quarantine:<timestamp>", kunci sesi dibersihkan, dan
 *   pemanggil melanjutkan dengan keadaan aman (demo) sambil memberi
 *   tahu pengguna. Data rusak TIDAK PERNAH diterapkan sebagian.
 */

import {
  validateSharedProject,
  type SharedProject,
} from '../features/share/projectShare';

export const SESSION_STORAGE_KEY = 'sim3d:session';
export const SESSION_VERSION = 1;
export const QUARANTINE_KEY_PREFIX = 'sim3d:quarantine:';

export interface SessionEnvelope {
  version: number;
  savedAt: string;
  payload: SharedProject;
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Simpan proyek sebagai amplop versi kini. False bila storage tak bisa dipakai. */
export function saveSession(project: SharedProject, now: Date = new Date()): boolean {
  const storage = storageOrNull();
  if (!storage) return false;
  try {
    const envelope: SessionEnvelope = {
      version: SESSION_VERSION,
      savedAt: now.toISOString(),
      payload: project,
    };
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pindahkan payload mentah ke karantina untuk diagnosis, lalu
 * bersihkan kunci sesi agar boot berikutnya tidak tersandung data
 * yang sama. Mengembalikan kunci karantina yang dipakai (atau null
 * bila storage tidak tersedia sama sekali).
 */
export function quarantineRawSession(raw: string, now: Date = new Date()): string | null {
  const storage = storageOrNull();
  if (!storage) return null;
  const key = `${QUARANTINE_KEY_PREFIX}${now.toISOString()}`;
  try {
    storage.setItem(key, raw);
  } catch {
    /* karantina gagal (kuota dsb.) — kunci sesi tetap dibersihkan di bawah */
  }
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* abaikan */
  }
  return key;
}

/** Buang simpanan sesi (aksi pengguna "Mulai dari awal"). */
export function clearSession(): void {
  const storage = storageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* abaikan */
  }
}

export type SessionRestore =
  | { status: 'empty' }
  | { status: 'restored'; project: SharedProject; savedAt: string; migrated: boolean }
  | { status: 'quarantined'; reason: string; quarantineKey: string | null };

/**
 * Baca + validasi simpanan sesi. Seluruh keputusan migrasi/karantina
 * terjadi di sini, satu kali saat boot (lihat pemakaian di App.tsx).
 */
export function restoreSession(now: Date = new Date()): SessionRestore {
  const storage = storageOrNull();
  if (!storage) return { status: 'empty' };
  let raw: string | null = null;
  try {
    raw = storage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return { status: 'empty' };
  }
  if (!raw) return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const quarantineKey = quarantineRawSession(raw, now);
    return { status: 'quarantined', reason: 'data tersimpan bukan JSON yang sah', quarantineKey };
  }

  // Format lama versi 0: proyek mentah tanpa amplop. Dikenali dari
  // tidak adanya field "version" sementara bentuk proyeknya lolos
  // validasi penuh — migrasi = bungkus, tulis ulang, pulihkan.
  const looksEnveloped =
    typeof parsed === 'object' &&
    parsed !== null &&
    'version' in (parsed as Record<string, unknown>);
  if (!looksEnveloped) {
    const validation = validateSharedProject(parsed);
    if (validation.ok) {
      saveSession(validation.project, now);
      return {
        status: 'restored',
        project: validation.project,
        savedAt: now.toISOString(),
        migrated: true,
      };
    }
    const quarantineKey = quarantineRawSession(raw, now);
    return { status: 'quarantined', reason: validation.reason, quarantineKey };
  }

  const envelope = parsed as Partial<SessionEnvelope>;
  if (envelope.version !== SESSION_VERSION) {
    const quarantineKey = quarantineRawSession(raw, now);
    return {
      status: 'quarantined',
      reason: `versi simpanan tidak dikenal: ${JSON.stringify(envelope.version ?? null)}`,
      quarantineKey,
    };
  }
  const validation = validateSharedProject(envelope.payload);
  if (!validation.ok) {
    const quarantineKey = quarantineRawSession(raw, now);
    return { status: 'quarantined', reason: validation.reason, quarantineKey };
  }
  return {
    status: 'restored',
    project: validation.project,
    savedAt: typeof envelope.savedAt === 'string' ? envelope.savedAt : now.toISOString(),
    migrated: false,
  };
}
