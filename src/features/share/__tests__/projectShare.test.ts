import { describe, expect, it } from 'vitest';
import {
  projectFromFileJson,
  projectFromHash,
  projectToFileJson,
  projectToHash,
  validateSharedProject,
  type SharedProject,
} from '../projectShare';

/**
 * Validasi mendalam data luar (self-healing SH-1): tautan berbagi dan
 * berkas .rangkai tidak lagi dipercaya dari bentuk luarnya saja —
 * board harus terdaftar, tipe komponen harus ada di katalog (33 tipe),
 * terminal kabel harus masuk akal. Data gagal → null/ok:false dengan
 * alasan, TIDAK pernah diterapkan sebagian.
 */

const valid: SharedProject = {
  v: 1,
  boardId: 'uno',
  instances: [
    {
      id: 'led-1',
      type: 'led-5mm',
      position: [12, 3, -5],
      rotation: 0,
      props: { color: 'red' },
      interactiveState: {},
    },
    {
      id: 'bat-1',
      type: 'battery-9v',
      position: [-30, 0, 10],
      rotation: 90,
      props: {},
      interactiveState: {},
    },
  ],
  pinHoles: { 'led-1': { ANODE: 't:R:20:4', CATHODE: 't:R:22:4' }, 'bat-1': {} },
  wires: [
    { id: 'w1', a: { kind: 'board', pinId: 'D13' }, b: { kind: 'hole', holeId: 't:R:24:2' }, color: '#3b82f6' },
    { id: 'w2', a: { kind: 'component', instanceId: 'bat-1', pinId: 'PLUS' }, b: { kind: 'hole', holeId: 't:R:20:4' }, color: '#ef4444' },
  ],
  sketchCode: 'void setup() {}\nvoid loop() {}\n',
};

describe('validateSharedProject — validasi mendalam', () => {
  it('proyek sah (termasuk komponen gelombang baru battery-9v) lolos utuh', () => {
    const result = validateSharedProject(valid);
    expect(result.ok).toBe(true);
    expect(projectFromHash(projectToHash(valid))).toEqual(valid);
    expect(projectFromFileJson(projectToFileJson(valid))).toEqual(valid);
  });

  it('versi proyek asing ditolak dengan alasan versi', () => {
    const bad = { ...valid, v: 2 };
    const result = validateSharedProject(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('versi');
    expect(projectFromFileJson(JSON.stringify(bad))).toBeNull();
  });

  it('board tak dikenal ditolak', () => {
    const bad = { ...valid, boardId: 'board-ngawur' };
    expect(validateSharedProject(bad).ok).toBe(false);
    expect(projectFromFileJson(JSON.stringify(bad))).toBeNull();
  });

  it('tipe komponen di luar katalog ditolak (alasan menyebut katalog)', () => {
    const bad: SharedProject = {
      ...valid,
      instances: [{ ...valid.instances[0], type: 'komponen-ngawur' }],
    };
    const result = validateSharedProject(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('katalog');
    expect(projectFromHash(projectToHash(bad))).toBeNull();
  });

  it('posisi bukan tiga angka berhingga ditolak', () => {
    const nan = {
      ...valid,
      instances: [{ ...valid.instances[0], position: [0, Number.NaN, 0] }],
    };
    expect(validateSharedProject(nan).ok).toBe(false);
    const pendek = {
      ...valid,
      instances: [{ ...valid.instances[0], position: [0, 1] }],
    };
    expect(validateSharedProject(pendek).ok).toBe(false);
  });

  it('kabel ke komponen yang tidak ada di daftar ditolak', () => {
    const bad: SharedProject = {
      ...valid,
      wires: [
        {
          id: 'w9',
          a: { kind: 'component', instanceId: 'hantu', pinId: 'PLUS' },
          b: { kind: 'hole', holeId: 't:R:20:4' },
          color: '#000000',
        },
      ],
    };
    expect(validateSharedProject(bad).ok).toBe(false);
    expect(projectFromFileJson(JSON.stringify(bad))).toBeNull();
  });

  it('peta pin-lubang yang menunjuk komponen tak dikenal ditolak', () => {
    const bad: SharedProject = {
      ...valid,
      pinHoles: { 'siapa-ini': { PLUS: 't:R:1:1' } },
    };
    expect(validateSharedProject(bad).ok).toBe(false);
  });

  it('bentuk dasar yang rusak ditolak: null, array, sketch bukan teks', () => {
    expect(validateSharedProject(null).ok).toBe(false);
    expect(validateSharedProject([1, 2, 3]).ok).toBe(false);
    expect(validateSharedProject({ ...valid, sketchCode: 42 }).ok).toBe(false);
    expect(projectFromFileJson('{bukan json')).toBeNull();
    expect(projectFromHash('#s=!!!bukan-data')).toBeNull();
  });
});
