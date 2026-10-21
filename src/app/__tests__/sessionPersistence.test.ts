import { describe, expect, it, vi } from 'vitest';

// localStorage deterministik (pola soundFx.test.ts).
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
  QUARANTINE_KEY_PREFIX,
  SESSION_STORAGE_KEY,
  SESSION_VERSION,
  clearSession,
  restoreSession,
  saveSession,
  type SessionEnvelope,
} from '../sessionPersistence';
import type { SharedProject } from '../../features/share/projectShare';

const project: SharedProject = {
  v: 1,
  boardId: 'uno',
  instances: [
    {
      id: 'led-1',
      type: 'led-5mm',
      position: [1, 3, 2],
      rotation: 0,
      props: {},
      interactiveState: {},
    },
  ],
  pinHoles: { 'led-1': { ANODE: 't:R:20:4', CATHODE: 't:R:22:4' } },
  wires: [
    {
      id: 'w1',
      a: { kind: 'board', pinId: 'D13' },
      b: { kind: 'hole', holeId: 't:R:20:4' },
      color: '#3b82f6',
    },
  ],
  sketchCode: 'void setup() {}\nvoid loop() {}\n',
};

function quarantineKeys(): string[] {
  return [...mem.keys()].filter((k) => k.startsWith(QUARANTINE_KEY_PREFIX));
}

describe('sessionPersistence — autosave & pemulihan sesi (self-healing SH-1)', () => {
  it('tidak ada simpanan → empty', () => {
    mem.clear();
    expect(restoreSession()).toEqual({ status: 'empty' });
  });

  it('save → restore: proyek kembali utuh dalam amplop versi kini', () => {
    mem.clear();
    const now = new Date('2026-10-21T12:00:00.000Z');
    expect(saveSession(project, now)).toBe(true);
    const raw = JSON.parse(mem.get(SESSION_STORAGE_KEY) as string) as SessionEnvelope;
    expect(raw.version).toBe(SESSION_VERSION);
    expect(raw.savedAt).toBe(now.toISOString());

    const restored = restoreSession();
    expect(restored.status).toBe('restored');
    if (restored.status === 'restored') {
      expect(restored.project).toEqual(project);
      expect(restored.savedAt).toBe(now.toISOString());
      expect(restored.migrated).toBe(false);
    }
    expect(quarantineKeys()).toEqual([]);
  });

  it('format lama (proyek mentah tanpa amplop) → dimigrasi lalu dipulihkan', () => {
    mem.clear();
    mem.set(SESSION_STORAGE_KEY, JSON.stringify(project));
    const restored = restoreSession(new Date('2026-10-21T12:30:00.000Z'));
    expect(restored.status).toBe('restored');
    if (restored.status === 'restored') {
      expect(restored.project).toEqual(project);
      expect(restored.migrated).toBe(true);
    }
    // Migrasi menulis ulang sebagai amplop versi kini.
    const raw = JSON.parse(mem.get(SESSION_STORAGE_KEY) as string) as SessionEnvelope;
    expect(raw.version).toBe(SESSION_VERSION);
    expect(raw.payload).toEqual(project);
    expect(quarantineKeys()).toEqual([]);
  });

  it('versi amplop tak dikenal → karantina, kunci sesi bersih, isi mentah tersimpan', () => {
    mem.clear();
    const alien = JSON.stringify({ version: 99, savedAt: 'x', payload: project });
    mem.set(SESSION_STORAGE_KEY, alien);
    const restored = restoreSession(new Date('2026-10-21T13:00:00.000Z'));
    expect(restored.status).toBe('quarantined');
    if (restored.status === 'quarantined') {
      expect(restored.reason).toContain('versi');
      expect(restored.quarantineKey).toBe(
        `${QUARANTINE_KEY_PREFIX}2026-10-21T13:00:00.000Z`,
      );
    }
    expect(mem.has(SESSION_STORAGE_KEY)).toBe(false);
    expect(quarantineKeys()).toHaveLength(1);
    expect(mem.get(quarantineKeys()[0])).toBe(alien);
    // Boot berikutnya tidak tersandung data yang sama lagi.
    expect(restoreSession()).toEqual({ status: 'empty' });
  });

  it('JSON rusak → karantina dengan alasan yang jelas', () => {
    mem.clear();
    mem.set(SESSION_STORAGE_KEY, '{{{bukan json');
    const restored = restoreSession();
    expect(restored.status).toBe('quarantined');
    if (restored.status === 'quarantined') {
      expect(restored.reason).toContain('JSON');
    }
    expect(mem.has(SESSION_STORAGE_KEY)).toBe(false);
    expect(quarantineKeys()).toHaveLength(1);
  });

  it('payload gagal validasi mendalam (tipe komponen tak dikenal) → karantina', () => {
    mem.clear();
    const bad: SharedProject = {
      ...project,
      instances: [{ ...project.instances[0], type: 'komponen-ngawur' }],
    };
    mem.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ version: SESSION_VERSION, savedAt: 'x', payload: bad }),
    );
    const restored = restoreSession();
    expect(restored.status).toBe('quarantined');
    if (restored.status === 'quarantined') {
      expect(restored.reason).toContain('katalog');
    }
    expect(mem.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it('payload gagal validasi (kabel menunjuk komponen hantu) → karantina', () => {
    mem.clear();
    const bad: SharedProject = {
      ...project,
      wires: [
        {
          id: 'w9',
          a: { kind: 'component', instanceId: 'hantu', pinId: 'PLUS' },
          b: { kind: 'hole', holeId: 't:R:20:4' },
          color: '#000000',
        },
      ],
    };
    mem.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ version: SESSION_VERSION, savedAt: 'x', payload: bad }),
    );
    expect(restoreSession().status).toBe('quarantined');
  });

  it('clearSession membuang simpanan', () => {
    mem.clear();
    saveSession(project);
    clearSession();
    expect(restoreSession()).toEqual({ status: 'empty' });
  });
});
