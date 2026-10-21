import { describe, expect, it, vi } from 'vitest';

// Storage deterministik di memori (pola soundFx.test.ts) untuk
// sessionStorage + localStorage, dan location palsu agar reload
// bisa diamati tanpa benar-benar memuat ulang halaman uji.
function makeStorage() {
  const mem = new Map<string, string>();
  return {
    mem,
    impl: {
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
    },
  };
}

const session = makeStorage();
const local = makeStorage();
const reloadSpy = vi.fn();
vi.stubGlobal('sessionStorage', session.impl);
vi.stubGlobal('localStorage', local.impl);
vi.stubGlobal('location', { reload: reloadSpy });

import {
  CHUNK_RELOAD_AT_KEY,
  CHUNK_RELOAD_WINDOW_MS,
  chunkReloadAllowed,
  handleChunkLoadError,
  isChunkLoadError,
  markChunkReload,
  type StorageLike,
} from '../chunkHealing';
import { readErrorLog } from '../errorLog';

describe('chunkHealing — kenali error chunk basi', () => {
  it('pola-pola kegagalan chunk yang dikenal', () => {
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/x.js')),
    ).toBe(true);
    expect(isChunkLoadError('Importing a module script failed.')).toBe(true);
    expect(isChunkLoadError({ message: 'Loading chunk 12 failed' })).toBe(true);
    const named = new Error('apa pun');
    named.name = 'ChunkLoadError';
    expect(isChunkLoadError(named)).toBe(true);
  });

  it('error biasa BUKAN error chunk', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

describe('chunkHealing — penanda reload satu kali', () => {
  const fake = (): { storage: StorageLike; mem: Map<string, string> } => {
    const mem = new Map<string, string>();
    return {
      mem,
      storage: {
        getItem: (k) => (mem.has(k) ? (mem.get(k) as string) : null),
        setItem: (k, v) => {
          mem.set(k, String(v));
        },
      },
    };
  };

  it('belum pernah reload → boleh; baru saja reload → ditolak; lewat jendela → boleh lagi', () => {
    const { storage } = fake();
    const now = 1_000_000;
    expect(chunkReloadAllowed(now, storage)).toBe(true);
    markChunkReload(now, storage);
    expect(chunkReloadAllowed(now + 1_000, storage)).toBe(false);
    expect(chunkReloadAllowed(now + CHUNK_RELOAD_WINDOW_MS + 1, storage)).toBe(true);
  });

  it('tanpa sessionStorage → tidak reload (mencegah loop buta)', () => {
    expect(chunkReloadAllowed(Date.now(), null)).toBe(false);
  });

  it('handleChunkLoadError: reload pertama jalan, kedua menyerah + tercatat, bukan-chunk diabaikan', () => {
    session.mem.clear();
    local.mem.clear();
    reloadSpy.mockClear();
    const chunkError = new Error('Failed to fetch dynamically imported module');

    expect(handleChunkLoadError(new Error('error lain'))).toBe('ignored');
    expect(reloadSpy).not.toHaveBeenCalled();

    expect(handleChunkLoadError(chunkError)).toBe('reloaded');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(session.mem.has(CHUNK_RELOAD_AT_KEY)).toBe(true);

    expect(handleChunkLoadError(chunkError)).toBe('gave-up');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    const log = readErrorLog();
    expect(log.some((e) => e.context === 'chunk:menyerah')).toBe(true);
  });
});
