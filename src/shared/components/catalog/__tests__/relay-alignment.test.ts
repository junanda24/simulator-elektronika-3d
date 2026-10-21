import { describe, expect, it } from 'vitest';
import { RELAY_META } from '../relay/meta';
import {
  RELAY_COIL_BLOCK,
  RELAY_LED,
  RELAY_TERMINAL_BLOCK,
  RELAY_TERMINAL_HOLE_X,
  RELAY_TERMINAL_SCREW_Z,
} from '../relay/model3d';
import { computePlacement } from '../../../../features/wiring/placement';
import {
  holeNetKey,
  holeWorldPosition,
  terminalHoleId,
} from '../../../boards/breadboard';

/**
 * KESELARASAN RELAY — jangkar pin elektrik vs fitur visual model 3D.
 *
 * Regresi yang dikunci (bug dilaporkan user dari screenshot, 2026-10-21):
 * blok terminal KF301 dulu berpusat di x=2,7 dengan sekrup pitch 1,27,
 * sementara jangkar COM/NO/NC berada di x=1,5 pitch 1,0 — kabel kontak
 * mendarat di celah kosong 0,4 di luar muka blok dan tidak ada sekrup
 * yang sejajar pin mana pun. Tes ini menegaskan dari angka: blok
 * terminal duduk di atas kolom kontak, sekrup & lubang kabel berbagi
 * z yang persis sama dengan jangkar, pin kendali berada di bawah
 * balok koil, dan LED indikator tidak menabrak kedua blok.
 */

const pinOf = (id: string) => {
  const pin = RELAY_META.pins.find((p) => p.id === id);
  if (!pin) throw new Error(`pin ${id} tidak ada di meta relay`);
  return pin;
};
const CONTACT_IDS = ['COM', 'NO', 'NC'];
const CONTROL_IDS = ['VCC', 'IN', 'GND'];

describe('Relay — blok terminal sejajar jangkar kontak', () => {
  it('muka dalam blok terminal menimpa bidang kolom kontak (selisih ≤ 0,15)', () => {
    const innerFace = RELAY_TERMINAL_BLOCK.centerX - RELAY_TERMINAL_BLOCK.width / 2;
    for (const id of CONTACT_IDS) {
      const [x] = pinOf(id).localPosition;
      // Jangkar berada tepat di dalam tepi blok (bukan 0,4 di luarnya
      // seperti geometri lama) dan di sisi dalam dari pusat blok.
      expect(innerFace - x).toBeGreaterThanOrEqual(0);
      expect(innerFace - x).toBeLessThanOrEqual(0.15);
      expect(x).toBeLessThan(RELAY_TERMINAL_BLOCK.centerX);
    }
  });

  it('z sekrup blok terminal == z jangkar COM/NO/NC, urut dan persis', () => {
    const contactZ = CONTACT_IDS.map((id) => pinOf(id).localPosition[2]);
    expect([...RELAY_TERMINAL_SCREW_Z]).toEqual(contactZ);
  });

  it('lubang masuk kabel berada pada muka luar blok terminal', () => {
    const outerFace = RELAY_TERMINAL_BLOCK.centerX + RELAY_TERMINAL_BLOCK.width / 2;
    expect(RELAY_TERMINAL_HOLE_X).toBeGreaterThanOrEqual(outerFace);
    expect(RELAY_TERMINAL_HOLE_X - outerFace).toBeLessThanOrEqual(0.05);
  });

  it('pin kendali berada di bawah balok koil, terpisah dari blok terminal', () => {
    const coilLeft = RELAY_COIL_BLOCK.centerX - RELAY_COIL_BLOCK.width / 2;
    const coilRight = RELAY_COIL_BLOCK.centerX + RELAY_COIL_BLOCK.width / 2;
    const terminalInner = RELAY_TERMINAL_BLOCK.centerX - RELAY_TERMINAL_BLOCK.width / 2;
    for (const id of CONTROL_IDS) {
      const [x] = pinOf(id).localPosition;
      expect(x).toBeGreaterThanOrEqual(coilLeft);
      expect(x).toBeLessThanOrEqual(coilRight);
      expect(x).toBeLessThan(terminalInner);
    }
  });

  it('LED indikator muat di celah antara balok koil dan blok terminal', () => {
    const coilRight = RELAY_COIL_BLOCK.centerX + RELAY_COIL_BLOCK.width / 2;
    const terminalInner = RELAY_TERMINAL_BLOCK.centerX - RELAY_TERMINAL_BLOCK.width / 2;
    expect(RELAY_LED.x - RELAY_LED.radius).toBeGreaterThan(coilRight);
    expect(RELAY_LED.x + RELAY_LED.radius).toBeLessThan(terminalInner);
  });
});

describe('Relay — jangkar meta konsisten dengan lubang hasil placement', () => {
  it('offset dunia tiap lubang pin dari sentroid == localPosition meta', () => {
    // Jangkar footprint DIP: VCC diklik di tepi kanal bank L (col 4).
    const placement = computePlacement('relay', terminalHoleId('L', 20, 4), new Set());
    expect(placement).not.toBeNull();
    if (!placement) return;
    const worlds = new Map<string, [number, number, number]>();
    for (const [pinId, holeId] of Object.entries(placement.pinHoles)) {
      const world = holeWorldPosition(holeId);
      expect(world, `lubang pin ${pinId} harus punya posisi dunia`).not.toBeNull();
      if (world) worlds.set(pinId, world);
    }
    const cx = [...worlds.values()].reduce((s, p) => s + p[0], 0) / worlds.size;
    const cz = [...worlds.values()].reduce((s, p) => s + p[2], 0) / worlds.size;
    for (const pin of RELAY_META.pins) {
      const world = worlds.get(pin.id);
      expect(world).toBeDefined();
      if (!world) continue;
      expect(world[0] - cx).toBeCloseTo(pin.localPosition[0], 6);
      expect(world[2] - cz).toBeCloseTo(pin.localPosition[2], 6);
    }
  });
});

describe('Relay — footprint DIP: net kontak independen dari net kendali', () => {
  it('keenam pin menempati enam strip berbeda, kendali di L dan kontak di R', () => {
    const placement = computePlacement('relay', terminalHoleId('L', 20, 4), new Set());
    expect(placement).not.toBeNull();
    if (!placement) return;
    // Regresi audit T2: footprint lama menaruh kontak sebaris kendali
    // (COM ≡ VCC, NO ≡ IN, NC ≡ GND satu strip). Footprint DIP harus
    // memberi setiap pin stripnya sendiri melintasi kanal tengah.
    const nets = Object.values(placement.pinHoles).map((h) => holeNetKey(h));
    expect(new Set(nets).size).toBe(6);
    for (const id of CONTROL_IDS) {
      expect(placement.pinHoles[id], `pin kendali ${id} di bank L`).toContain(':L:');
    }
    for (const id of CONTACT_IDS) {
      expect(placement.pinHoles[id], `pin kontak ${id} di bank R`).toContain(':R:');
    }
  });

  it('klik di luar tepi kanal bank L ditolak (jangkar DIP tidak sah)', () => {
    expect(computePlacement('relay', terminalHoleId('L', 20, 1), new Set())).toBeNull();
    expect(computePlacement('relay', terminalHoleId('R', 20, 0), new Set())).toBeNull();
  });
});
