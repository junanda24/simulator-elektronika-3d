import { describe, expect, it } from 'vitest';
import {
  ERROR_LOG_KEY,
  clearErrorLog,
  formatErrorLog,
  parseErrorLog,
  readErrorLog,
  runHealthChecks,
  solveReferenceCircuit,
  type HealthCheckDeps,
  type StorageLike,
} from '../diagnostics';

/**
 * Diagnostik "Periksa Kesehatan" (self-healing, 2026-10-21):
 * logika murni di balik DiagnosticsPanel — pemeriksaan nyata dengan
 * ketergantungan tersuntik + penguraian log error yang defensif.
 */

function healthyDeps(overrides: Partial<HealthCheckDeps> = {}): HealthCheckDeps {
  return {
    ping: async () => ({ mode: 'worker', latencyMs: 3 }),
    solveReference: () => ({ volts: 2.5 }),
    storageProbe: () => true,
    webglProbe: () => true,
    ...overrides,
  };
}

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe('runHealthChecks', () => {
  it('semua sehat: 4 item ok dengan label yang benar', async () => {
    const results = await runHealthChecks(healthyDeps());
    expect(results.map((r) => r.id)).toEqual(['worker', 'solver', 'storage', 'webgl']);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('mode lokal: worker dilaporkan sehat dengan penjelasan cadangan lokal', async () => {
    const results = await runHealthChecks(
      healthyDeps({ ping: async () => ({ mode: 'local', latencyMs: 0 }) }),
    );
    const worker = results.find((r) => r.id === 'worker');
    expect(worker?.ok).toBe(true);
    expect(worker?.detail).toContain('cadangan lokal');
  });

  it('ping null / melempar: item worker bermasalah', async () => {
    const nullPing = await runHealthChecks(healthyDeps({ ping: async () => null }));
    expect(nullPing.find((r) => r.id === 'worker')?.ok).toBe(false);
    const throwing = await runHealthChecks(
      healthyDeps({
        ping: async () => {
          throw new Error('boom');
        },
      }),
    );
    expect(throwing.find((r) => r.id === 'worker')?.ok).toBe(false);
  });

  it('solver menyimpang / solveError: item solver bermasalah', async () => {
    const off = await runHealthChecks(
      healthyDeps({ solveReference: () => ({ volts: 1.2 }) }),
    );
    expect(off.find((r) => r.id === 'solver')?.ok).toBe(false);
    const failed = await runHealthChecks(
      healthyDeps({
        solveReference: () => ({ volts: 0, solveError: 'tidak konvergen' }),
      }),
    );
    const solver = failed.find((r) => r.id === 'solver');
    expect(solver?.ok).toBe(false);
    expect(solver?.detail).toContain('tidak konvergen');
  });

  it('penyimpanan & WebGL gagal: keduanya bermasalah, yang lain tetap sehat', async () => {
    const results = await runHealthChecks(
      healthyDeps({ storageProbe: () => false, webglProbe: () => false }),
    );
    expect(results.find((r) => r.id === 'storage')?.ok).toBe(false);
    expect(results.find((r) => r.id === 'webgl')?.ok).toBe(false);
    expect(results.find((r) => r.id === 'worker')?.ok).toBe(true);
    expect(results.find((r) => r.id === 'solver')?.ok).toBe(true);
  });
});

describe('solveReferenceCircuit (solver sungguhan)', () => {
  it('pembagi 1k/1k dari 5 V: node tengah 2,5 V ± 0,05, tanpa solveError', () => {
    const ref = solveReferenceCircuit();
    expect(ref.solveError).toBeUndefined();
    expect(ref.volts).not.toBeNull();
    expect(Math.abs((ref.volts ?? 0) - 2.5)).toBeLessThanOrEqual(0.05);
  });
});

describe('log error lokal', () => {
  it('parseErrorLog: null / JSON rusak / bukan array ditangani defensif', () => {
    expect(parseErrorLog(null)).toEqual([]);
    expect(parseErrorLog('bukan json {')).toEqual([]);
    expect(parseErrorLog('[]')).toEqual([]);
    expect(parseErrorLog('{"message":"satu error"}')).toEqual([
      { at: '', message: 'satu error' },
    ]);
  });

  it('parseErrorLog: entri string & objek dibaca; stempel waktu dipertahankan', () => {
    const raw = JSON.stringify([
      'error polos',
      { at: '2026-10-21T12:00:00.000Z', message: 'worker mati' },
      { timestamp: 0, error: 'dari timestamp' },
    ]);
    const entries = parseErrorLog(raw);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ at: '', message: 'error polos' });
    expect(entries[1]?.message).toBe('worker mati');
    expect(entries[1]?.at).toContain('2026-10-21');
    expect(entries[2]?.message).toBe('dari timestamp');
  });

  it('readErrorLog + clearErrorLog lewat kunci kontrak sim3d:errorlog', () => {
    const storage = fakeStorage({
      [ERROR_LOG_KEY]: JSON.stringify([{ message: 'x' }]),
    });
    expect(readErrorLog(storage)).toEqual([{ at: '', message: 'x' }]);
    clearErrorLog(storage);
    expect(storage.data.has(ERROR_LOG_KEY)).toBe(false);
    expect(readErrorLog(null)).toEqual([]);
  });

  it('formatErrorLog: baris-baris teks siap salin', () => {
    const text = formatErrorLog([
      { at: '2026-10-21', message: 'satu' },
      { at: '', message: 'dua' },
    ]);
    expect(text).toBe('[2026-10-21] satu\ndua');
  });
});
