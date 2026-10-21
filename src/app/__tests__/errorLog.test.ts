import { describe, expect, it, vi } from 'vitest';

// localStorage deterministik — pola yang sama dengan soundFx.test.ts:
// lingkungan node tidak menyediakannya, hasil uji tidak boleh
// bergantung pada lingkungan.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => {
    mem.clear();
  },
  key: () => null,
  length: 0,
});

import {
  ERROR_LOG_KEY,
  ERROR_LOG_LIMIT,
  clearErrorLog,
  describeError,
  logError,
  readErrorLog,
} from '../errorLog';

describe('errorLog — log error lokal (self-healing SH-1)', () => {
  it('kunci kontrak tidak berubah: sim3d:errorlog', () => {
    expect(ERROR_LOG_KEY).toBe('sim3d:errorlog');
    expect(ERROR_LOG_LIMIT).toBe(50);
  });

  it('catat lalu baca kembali: pesan, konteks, dan waktu tercatat', () => {
    mem.clear();
    const entry = logError(new Error('solver meledak'), 'boundary:canvas');
    expect(entry).not.toBeNull();
    expect(entry?.message).toBe('solver meledak');
    expect(entry?.context).toBe('boundary:canvas');
    expect(typeof entry?.at).toBe('string');
    const all = readErrorLog();
    expect(all).toHaveLength(1);
    expect(all[0].message).toBe('solver meledak');
  });

  it('rotasi: hanya 50 entri terakhir yang disimpan', () => {
    mem.clear();
    for (let i = 0; i < 55; i += 1) logError(`err-${i}`, 'uji');
    const all = readErrorLog();
    expect(all).toHaveLength(50);
    expect(all[0].message).toBe('err-5');
    expect(all[all.length - 1].message).toBe('err-54');
  });

  it('isi storage rusak tidak menggagalkan pembacaan maupun pencatatan', () => {
    mem.set(ERROR_LOG_KEY, '{{{bukan json');
    expect(readErrorLog()).toEqual([]);
    expect(() => logError('tetap dicatat', 'uji')).not.toThrow();
    expect(readErrorLog().map((e) => e.message)).toEqual(['tetap dicatat']);
    mem.set(ERROR_LOG_KEY, JSON.stringify([{ aneh: true }, 'sampah']));
    expect(readErrorLog()).toEqual([]);
  });

  it('clearErrorLog mengosongkan log', () => {
    mem.clear();
    logError('satu', 'uji');
    clearErrorLog();
    expect(readErrorLog()).toEqual([]);
    expect(mem.has(ERROR_LOG_KEY)).toBe(false);
  });

  it('describeError menangani Error, string, dan objek', () => {
    expect(describeError(new Error('pesan')).message).toBe('pesan');
    expect(describeError('teks polos').message).toBe('teks polos');
    expect(describeError({ kode: 7 }).message).toContain('7');
  });
});
