/**
 * Audit P3 (2026-10-21) — vonis klaim eksternal K12/K14/K15 di level
 * netlist + solver, semua dengan angka terukur:
 *
 * K12 INPUT_PULLUP: klaim dokumen "hanya OUTPUT yang di-stamp" DISANGKAL
 *   untuk jalur utama — buildNetlist sudah menautkan pin INPUT_PULLUP ke
 *   rel logika lewat pullupOhms PROFIL (Uno 20 kΩ). Bukti di bawah:
 *   tombol nyata (placement + kabel seperti Modul 3) lepas = 4,9998 V,
 *   ditekan = 2,5e-7 V. Celah yang TERBUKTI dan diperbaiki di gelombang
 *   ini: mode INPUT tak punya jangkar eksplisit (links kosong) dan
 *   INPUT_PULLDOWN tak ditangani → kini INPUT = bleed 10 MΩ ke GND,
 *   INPUT_PULLDOWN = pullupOhms ke GND.
 * K14 Gmin/NaN: DISANGKAL — MnaBuilder sudah menaruh GMIN = 1e-9 S di
 *   diagonal SETIAP net; rangkaian mengambang total dan rangkaian yang
 *   hanya menyentuh GND lewat sakelar terbuka selalu finite (angka di
 *   bawah). 1e-9 dipertahankan: bocornya 5 nA pada 5 V (tak terukur
 *   terhadap ambang mana pun) dan 1000× lebih kuat menstabilkan pivot
 *   daripada 1e-12 yang diusulkan dokumen.
 * K15 PWL: DISANGKAL-sebagian — tak ditemukan osilasi flip-flop
 *   berkelanjutan yang mengubah output akhir pada skenario dokumen
 *   (semua konvergen ≤ 4 iterasi, hasil akhir benar). Yang diterapkan
 *   adalah kontrak initialVoltages: solveCircuit menerimanya sebagai
 *   prevVoltage iterasi ke-0; hasil seeded == cold pada titik tunak.
 */
import { describe, expect, it } from 'vitest';
import { buildNetlist, INPUT_BLEED_OHMS, type WireConnection } from '../../wiring/netlist';
import { computePlacement } from '../../wiring/placement';
import { solveCircuit } from '../solver/engine';
import { GMIN, MnaBuilder } from '../solver/mna';
import { electricalOf } from '../../../shared/components/electricalRegistry';
import { terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type PinState,
} from '../../../shared/types';

function inst(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  interactive: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props,
    interactiveState: interactive,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const UNO = getBoardDefinition('uno');

/** Rangkaian Modul 3 persis: D2 → sisi A tombol; sisi B → rail R− → GND. */
function buttonCircuit(pressed: boolean, mode: PinState['mode']) {
  const place = computePlacement('push-button', terminalHoleId('L', 20, 4), new Set());
  if (!place) throw new Error('placement push-button gagal');
  const btn = { ...place.instance, interactiveState: { pressed } };
  const wires: WireConnection[] = [
    { id: 'w1', a: { kind: 'board', pinId: 'D2' }, b: { kind: 'hole', holeId: terminalHoleId('L', 20, 2) }, color: '#3b82f6' },
    { id: 'w2', a: { kind: 'hole', holeId: terminalHoleId('R', 20, 2) }, b: { kind: 'hole', holeId: railHoleId('R-', 15) }, color: '#222222' },
    { id: 'w3', a: { kind: 'hole', holeId: railHoleId('R-', 4) }, b: { kind: 'board', pinId: 'GND#1' }, color: '#222222' },
  ];
  const nl = buildNetlist([btn], { [btn.id]: place.pinHoles }, wires, { D2: { mode } });
  return { nl, sol: solveCircuit(nl.input, electricalOf), d2: nl.netOfBoardPin('D2') };
}

describe('K12 — INPUT_PULLUP & mode input di netlist', () => {
  it('pull-up memakai pullupOhms PROFIL Uno (20 kΩ), bukan konstanta karangan', () => {
    const { nl } = buttonCircuit(false, 'INPUT_PULLUP');
    expect(UNO.profile.pullupOhms).toBe(20000);
    expect(nl.input.links).toEqual([{ a: 'board:D2', b: 'board:5V', ohms: 20000 }]);
  });

  it('tombol LEPAS: net D2 ≈ 5 V, di atas ambang digital Uno (3,0 V) → terbaca HIGH', () => {
    const { sol, d2 } = buttonCircuit(false, 'INPUT_PULLUP');
    const v = sol.voltages.get(d2) ?? NaN;
    expect(v).toBeGreaterThan(4.9); // terukur 4,9998 V
    expect(v).toBeGreaterThan(UNO.profile.digitalThresholdVolts);
  });

  it('tombol DITEKAN: net D2 ≈ 0 V → terbaca LOW', () => {
    const { sol, d2 } = buttonCircuit(true, 'INPUT_PULLUP');
    expect(sol.voltages.get(d2) ?? NaN).toBeLessThan(0.01); // terukur 2,5e-7 V
  });

  it('INPUT murni kini punya bleed eksplisit 10 MΩ ke GND (sebelumnya links kosong)', () => {
    const nl = buildNetlist([], {}, [], { D2: { mode: 'INPUT' } });
    expect(nl.input.links).toEqual([{ a: 'board:D2', b: 'GND', ohms: INPUT_BLEED_OHMS }]);
    const sol = solveCircuit(nl.input, electricalOf);
    expect(sol.voltages.get(nl.netOfBoardPin('D2'))).toBe(0);
    // Kontras perilaku: INPUT + tombol tetap 0 V dua arah (bukan pull-up).
    expect(buttonCircuit(false, 'INPUT').sol.voltages.get('board:D2')).toBe(0);
    expect(buttonCircuit(true, 'INPUT').sol.voltages.get('board:D2')).toBe(0);
  });

  it('INPUT_PULLDOWN (defensif): pullupOhms ke GND menang atas tarikan lemah ke 5 V', () => {
    // D2 satu strip dengan kaki B resistor 100 kΩ; kaki A resistor ke rail 5 V.
    const rp = computePlacement('resistor', terminalHoleId('L', 24, 2), new Set());
    if (!rp) throw new Error('placement resistor gagal');
    const r = { ...rp.instance, props: { resistance: 100000 } };
    const wires: WireConnection[] = [
      { id: 'w1', a: { kind: 'board', pinId: '5V#3' }, b: { kind: 'hole', holeId: railHoleId('L+', 4) }, color: '#ef4444' },
      { id: 'w2', a: { kind: 'hole', holeId: railHoleId('L+', 29) }, b: { kind: 'hole', holeId: rp.pinHoles.A }, color: '#ef4444' },
      { id: 'w3', a: { kind: 'board', pinId: 'D2' }, b: { kind: 'hole', holeId: rp.pinHoles.B }, color: '#3b82f6' },
    ];
    const pinStates = { D2: { mode: 'INPUT_PULLDOWN' } } as unknown as Record<string, PinState>;
    const nl = buildNetlist([r], { [r.id]: rp.pinHoles }, wires, pinStates);
    expect(nl.input.links).toEqual([{ a: 'board:D2', b: 'GND', ohms: 20000 }]);
    const sol = solveCircuit(nl.input, electricalOf);
    // Pembagi 100 kΩ (ke 5 V) vs 20 kΩ (ke GND): V = 5 × 20/120 ≈ 0,83 V.
    const v = sol.voltages.get(nl.netOfBoardPin('D2')) ?? NaN;
    expect(v).toBeGreaterThan(0.7);
    expect(v).toBeLessThan(0.95);
    expect(v).toBeLessThan(UNO.profile.digitalThresholdVolts);
  });
});

describe('K14 — Gmin & node mengambang tidak pernah NaN', () => {
  it('GMIN terkunci 1e-9 S dan diterapkan ke semua net', () => {
    expect(GMIN).toBe(1e-9);
    const b = new MnaBuilder(['A', 'B']);
    b.conductance('A', 'B', 1 / 1000); // sub-rangkaian tanpa jalur GND sama sekali
    const out = b.solve();
    for (const v of out.values()) expect(Number.isFinite(v)).toBe(true);
    expect(out.get('A')).toBe(0);
    expect(out.get('B')).toBe(0);
  });

  it('loop resistor+LED tertutup tanpa GND & tanpa sumber: semua tegangan finite 0', () => {
    const sol = solveCircuit(
      {
        instances: [inst('r1', 'resistor', { resistance: 220 }), inst('l1', 'led-5mm', { color: 'red' })],
        pinNets: { 'r1:A': 'X1', 'r1:B': 'X2', 'l1:ANODE': 'X2', 'l1:CATHODE': 'X1' },
        sources: [],
      },
      electricalOf,
    );
    for (const v of sol.voltages.values()) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBe(0);
    }
  });

  it('hanya terhubung ke GND lewat sakelar TERBUKA: finite, LED mati (≈5 nA bocor)', () => {
    const sol = solveCircuit(
      {
        instances: [inst('l1', 'led-5mm', { color: 'red' }), inst('b1', 'push-button', {}, { pressed: false })],
        pinNets: { 'l1:ANODE': 'V5', 'l1:CATHODE': 'MID', 'b1:A1': 'MID', 'b1:A2': 'MID', 'b1:B1': 'GND', 'b1:B2': 'GND' },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    for (const v of sol.voltages.values()) expect(Number.isFinite(v)).toBe(true);
    expect(sol.voltages.get('MID') ?? NaN).toBeGreaterThan(4.9); // terukur 4,9505 V
    expect(Math.abs(sol.results.get('l1')?.branchCurrents.led ?? NaN)).toBeLessThan(1e-6);
    expect(sol.damageEvents).toHaveLength(0);
  });
});

describe('K15 — PWL stabil & kontrak initialVoltages', () => {
  const ledDriver = (ohms: number) => ({
    instances: [inst('r1', 'resistor', { resistance: ohms }), inst('l1', 'led-5mm', { color: 'red' })],
    pinNets: { 'r1:A': 'V5', 'r1:B': 'N1', 'l1:ANODE': 'N1', 'l1:CATHODE': 'GND' },
    sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
  });

  it('LED + 220 Ω: titik kerja benar (Vd ≈ 2,07 V, I ≈ 13,3 mA, tak rusak)', () => {
    const sol = solveCircuit(ledDriver(220), electricalOf);
    expect(sol.voltages.get('N1') ?? NaN).toBeGreaterThan(2.05);
    expect(sol.voltages.get('N1') ?? NaN).toBeLessThan(2.08);
    const ma = (sol.results.get('l1')?.branchCurrents.led ?? 0) * 1000;
    expect(ma).toBeGreaterThan(12);
    expect(ma).toBeLessThan(14);
    expect(sol.damageEvents).toHaveLength(0);
  });

  it('LED + 100 kΩ (persis di ambang): stabil di Vd ≈ 2,0001 V, I ≈ 30 µA — bukan flip-flop ke overcurrent', () => {
    const sol = solveCircuit(ledDriver(100000), electricalOf);
    const vd = sol.voltages.get('N1') ?? NaN;
    expect(vd).toBeGreaterThan(1.99);
    expect(vd).toBeLessThan(2.01);
    const ua = (sol.results.get('l1')?.branchCurrents.led ?? 0) * 1e6;
    expect(ua).toBeGreaterThan(15);
    expect(ua).toBeLessThan(45);
    expect(sol.damageEvents).toHaveLength(0);
  });

  it('LED + dioda seri dari 3 V (total Vf 2,7 V): konvergen, I LED ±1,3 mA, tak rusak', () => {
    const sol = solveCircuit(
      {
        instances: [inst('d1', 'diode'), inst('l1', 'led-5mm', { color: 'red' }), inst('r1', 'resistor', { resistance: 220 })],
        pinNets: { 'd1:ANODE': 'V3', 'd1:CATHODE': 'M', 'l1:ANODE': 'M', 'l1:CATHODE': 'N1', 'r1:A': 'N1', 'r1:B': 'GND' },
        sources: [{ net: 'V3', volts: 3, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const ma = (sol.results.get('l1')?.branchCurrents.led ?? 0) * 1000;
    expect(ma).toBeGreaterThan(0.8);
    expect(ma).toBeLessThan(1.8);
    expect(sol.damageEvents).toHaveLength(0);
  });

  it('transistor menggerakkan LED: saturasi benar (Vc < 0,3 V, I LED 11–14 mA, tak rusak)', () => {
    const sol = solveCircuit(
      {
        instances: [
          inst('t1', 'transistor', { beta: 100 }),
          inst('l1', 'led-5mm', { color: 'red' }),
          inst('rc', 'resistor', { resistance: 220 }),
          inst('rb', 'resistor', { resistance: 10000 }),
        ],
        pinNets: {
          'rb:A': 'V5', 'rb:B': 'NB', 't1:B': 'NB', 't1:E': 'GND', 't1:C': 'NC',
          'l1:ANODE': 'NL', 'l1:CATHODE': 'NC', 'rc:A': 'V5', 'rc:B': 'NL',
        },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    expect(sol.voltages.get('NC') ?? NaN).toBeLessThan(0.3); // terukur 0,0756 V
    const ma = (sol.results.get('l1')?.branchCurrents.led ?? 0) * 1000;
    expect(ma).toBeGreaterThan(11);
    expect(ma).toBeLessThan(14);
    expect(sol.damageEvents).toHaveLength(0);
  });

  it('initialVoltages: seeded == cold pada titik tunak, dan peta pemanggil tak dimutasi', () => {
    const input = ledDriver(220);
    const cold = solveCircuit(input, electricalOf);
    const seed = new Map(cold.voltages);
    const seedSnapshot = [...seed.entries()];
    const seeded = solveCircuit(input, electricalOf, seed);
    expect(seeded.voltages.get('N1')).toBeCloseTo(cold.voltages.get('N1') ?? NaN, 9);
    expect(seeded.results.get('l1')?.branchCurrents.led).toBeCloseTo(
      cold.results.get('l1')?.branchCurrents.led ?? NaN,
      9,
    );
    expect([...seed.entries()]).toEqual(seedSnapshot);
  });

  it('initialVoltages tak mengubah kapasitor DC-tunak (stamp-nya tak membaca prevVoltage)', () => {
    const input = {
      instances: [inst('c1', 'capacitor', { capacitance: 100, voltageRating: 25 })],
      pinNets: { 'c1:PLUS': 'V5', 'c1:MINUS': 'GND' },
      sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
    };
    const cold = solveCircuit(input, electricalOf);
    const seeded = solveCircuit(input, electricalOf, new Map(cold.voltages));
    expect(seeded.voltages.get('V5')).toBeCloseTo(cold.voltages.get('V5') ?? NaN, 9);
    // Arus bocor dielektrik: 5 V / 10 MΩ = 0,5 µA dua arah perhitungan sama.
    expect(seeded.results.get('c1')?.branchCurrents.main).toBeCloseTo(
      cold.results.get('c1')?.branchCurrents.main ?? NaN,
      12,
    );
    expect(cold.damageEvents).toHaveLength(0);
  });
});
