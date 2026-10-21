import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentElectrical,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { LED_BAR_GRAPH_META } from '../led-bar-graph/meta';
import { ledBarGraphElectrical } from '../led-bar-graph/electrical';
import { REGULATOR_7805_META } from '../regulator-7805/meta';
import { regulator7805Electrical } from '../regulator-7805/electrical';
import { BATTERY_9V_META } from '../battery-9v/meta';
import { battery9vElectrical } from '../battery-9v/electrical';

/**
 * Gelombang C (daya & display): LED bar graph DC-10EWA, regulator
 * L7805, baterai 9V. Elektrik disuplai langsung dari modul komponen
 * (registri katalog adalah langkah integrasi terpisah) — pola yang
 * sama dengan tes registry, tanpa menyentuh registry.
 */
const ELECTRICAL: Record<string, ComponentElectrical> = {
  'led-bar-graph': ledBarGraphElectrical,
  'regulator-7805': regulator7805Electrical,
  'battery-9v': battery9vElectrical,
};
const electricalOf = (type: string) => ELECTRICAL[type];

function instance(id: string, type: string): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState: {},
    simState: { ...EMPTY_SIM_RESULT },
  };
}

describe('LED Bar Graph — pemetaan pin TERVERIFIKASI (DSAD1426 hal. 1)', () => {
  it('20 pin: anoda segmen i = pin fisik i, katoda segmen i = pin fisik 21−i', () => {
    expect(LED_BAR_GRAPH_META.pins).toHaveLength(20);
    const byId = new Map(LED_BAR_GRAPH_META.pins.map((p) => [p.id, p]));
    expect(byId.get('A1')?.label).toContain('pin fisik 1');
    expect(byId.get('K1')?.label).toContain('pin fisik 20');
    expect(byId.get('A10')?.label).toContain('pin fisik 10');
    expect(byId.get('K10')?.label).toContain('pin fisik 11');
    expect(byId.get('A5')?.label).toContain('pin fisik 5');
    expect(byId.get('K5')?.label).toContain('pin fisik 16');
  });

  it('posisi lokal: baris anoda x −1,5, katoda x +1,5, segmen 1 di z −4,5', () => {
    const byId = new Map(LED_BAR_GRAPH_META.pins.map((p) => [p.id, p]));
    expect(byId.get('A1')?.localPosition).toEqual([-1.5, 0, -4.5]);
    expect(byId.get('K1')?.localPosition).toEqual([1.5, 0, -4.5]);
    expect(byId.get('A10')?.localPosition).toEqual([-1.5, 0, 4.5]);
    expect(byId.get('K10')?.localPosition).toEqual([1.5, 0, 4.5]);
  });
});

describe('LED Bar Graph — elektrik 10× LED PWL independen', () => {
  it('segmen 1 menyala lewat resistor 220 Ω: arus ≈13,3 mA, segmen lain mati, tanpa kerusakan', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bg1', 'led-bar-graph')],
        pinNets: { 'bg1:A1': 'a1', 'bg1:K1': 'GND' },
        sources: [{ net: 'a1', volts: 5, seriesOhms: 220 }],
      },
      electricalOf,
    );
    const result = solution.results.get('bg1');
    expect(result?.branchCurrents.s1).toBeGreaterThan(0.012);
    expect(result?.branchCurrents.s1).toBeLessThan(0.0145);
    expect(Math.abs(result?.branchCurrents.s2 ?? 0)).toBeLessThan(1e-6);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('segmen tanpa resistor: arus >30 mA → LED_OVERCURRENT', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bg1', 'led-bar-graph')],
        pinNets: { 'bg1:A2': 'a2', 'bg1:K2': 'GND' },
        sources: [{ net: 'a2', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    expect(solution.results.get('bg1')?.branchCurrents.s2).toBeGreaterThan(0.03);
    expect(solution.damageEvents[0]?.report.ruleId).toBe('LED_OVERCURRENT');
  });

  it('segmen terbalik 9 V: tegangan balik >5 V → LED_REVERSE_BREAKDOWN', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bg1', 'led-bar-graph')],
        pinNets: { 'bg1:A3': 'GND', 'bg1:K3': 'k3' },
        sources: [{ net: 'k3', volts: 9, seriesOhms: 10 }],
      },
      electricalOf,
    );
    expect(solution.damageEvents[0]?.report.ruleId).toBe('LED_REVERSE_BREAKDOWN');
  });
});

describe('L7805 — pola Norton melayang antar-net', () => {
  it('9 V masuk → keluaran teregulasi ±5 V di beban 50 Ω', () => {
    const solution = solveCircuit(
      {
        instances: [instance('reg1', 'regulator-7805')],
        pinNets: { 'reg1:IN': 'vin', 'reg1:GND': 'GND', 'reg1:OUT': 'out' },
        sources: [{ net: 'vin', volts: 9, seriesOhms: 0.1 }],
        links: [{ a: 'out', b: 'GND', ohms: 50 }],
      },
      electricalOf,
    );
    const vout = solution.voltages.get('out') ?? 0;
    expect(vout).toBeGreaterThan(4.85);
    expect(vout).toBeLessThan(5.0);
    const result = solution.results.get('reg1');
    expect(result?.branchCurrents.out).toBeGreaterThan(0.09);
    expect(result?.branchCurrents.out).toBeLessThan(0.11);
    // Arus masuk = arus keluar + Iq 6 mA.
    expect(result?.branchCurrents.in).toBeCloseTo((result?.branchCurrents.out ?? 0) + 0.006, 3);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('dropout: 6 V masuk → keluaran mengikuti Vin − 2 V ≈ 4 V', () => {
    const solution = solveCircuit(
      {
        instances: [instance('reg1', 'regulator-7805')],
        pinNets: { 'reg1:IN': 'vin', 'reg1:GND': 'GND', 'reg1:OUT': 'out' },
        sources: [{ net: 'vin', volts: 6, seriesOhms: 0.1 }],
        links: [{ a: 'out', b: 'GND', ohms: 50 }],
      },
      electricalOf,
    );
    const vout = solution.voltages.get('out') ?? 0;
    expect(vout).toBeGreaterThan(3.85);
    expect(vout).toBeLessThan(4.05);
  });

  it('pin GND melayang di net sendiri: regulasi relatif terhadap pin GND-nya, BUKAN ground global', () => {
    const solution = solveCircuit(
      {
        instances: [instance('reg1', 'regulator-7805')],
        pinNets: { 'reg1:IN': 'vin', 'reg1:GND': 'gfloat', 'reg1:OUT': 'out' },
        sources: [{ net: 'vin', volts: 9, seriesOhms: 0.1 }],
        links: [
          { a: 'out', b: 'GND', ohms: 50 },
          { a: 'gfloat', b: 'GND', ohms: 10 },
        ],
      },
      electricalOf,
    );
    const vout = solution.voltages.get('out') ?? 0;
    const vg = solution.voltages.get('gfloat') ?? 0;
    // Relatif terhadap pin GND-nya sendiri tetap ±4,95 V …
    expect(vout - vg).toBeGreaterThan(4.8);
    expect(vout - vg).toBeLessThan(5.0);
    // … dan pin GND-nya sendiri terseret DI BAWAH ground global oleh
    // arus balik beban yang mengalir masuk lewat pin itu (fisika
    // regulator asli: arus beban kembali lewat pin GND), sehingga
    // keluaran terhadap ground global jelas BUKAN 4,95 V — bukti
    // stamp tidak terikat ground (thevenin engine akan memaku
    // keluaran di ±4,95 V terhadap ground global apa pun vg-nya).
    expect(vg).toBeLessThan(-0.3);
    expect(Math.abs(vout - 4.95)).toBeGreaterThan(0.3);
  });

  it('disipasi (20−5)×±0,9 A > 2 W → REGULATOR_OVERHEAT', () => {
    const solution = solveCircuit(
      {
        instances: [instance('reg1', 'regulator-7805')],
        pinNets: { 'reg1:IN': 'vin', 'reg1:GND': 'GND', 'reg1:OUT': 'out' },
        sources: [{ net: 'vin', volts: 20, seriesOhms: 0.1 }],
        links: [{ a: 'out', b: 'GND', ohms: 5 }],
      },
      electricalOf,
    );
    expect(solution.damageEvents[0]?.report.ruleId).toBe('REGULATOR_OVERHEAT');
  });

  it('masukan 40 V → REGULATOR_INPUT_OVERVOLTAGE', () => {
    const solution = solveCircuit(
      {
        instances: [instance('reg1', 'regulator-7805')],
        pinNets: { 'reg1:IN': 'vin', 'reg1:GND': 'GND', 'reg1:OUT': 'out' },
        sources: [{ net: 'vin', volts: 40, seriesOhms: 0.1 }],
        links: [{ a: 'out', b: 'GND', ohms: 50 }],
      },
      electricalOf,
    );
    expect(solution.damageEvents[0]?.report.ruleId).toBe('REGULATOR_INPUT_OVERVOLTAGE');
  });

  it('meta: urutan kaki IN–GND–OUT dari muka depan (pin 1–2–3)', () => {
    expect(REGULATOR_7805_META.pins.map((p) => p.id)).toEqual(['IN', 'GND', 'OUT']);
  });
});

describe('Baterai 9V — Norton melayang + BATTERY_SHORT', () => {
  it('beban 100 Ω antar terminal: tegangan ±8,87 V (resistansi internal 1,5 Ω), arus ±89 mA', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bat1', 'battery-9v')],
        pinNets: { 'bat1:PLUS': 'p', 'bat1:MINUS': 'm' },
        sources: [],
        links: [{ a: 'p', b: 'm', ohms: 100 }],
      },
      electricalOf,
    );
    const vdiff = (solution.voltages.get('p') ?? 0) - (solution.voltages.get('m') ?? 0);
    expect(vdiff).toBeGreaterThan(8.7);
    expect(vdiff).toBeLessThan(9.0);
    const main = solution.results.get('bat1')?.branchCurrents.main ?? 0;
    expect(main).toBeGreaterThan(0.08);
    expect(main).toBeLessThan(0.097);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('terminal terhubung langsung (tautan 0,1 Ω): arus ±5,6 A → BATTERY_SHORT', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bat1', 'battery-9v')],
        pinNets: { 'bat1:PLUS': 'p', 'bat1:MINUS': 'm' },
        sources: [],
        links: [{ a: 'p', b: 'm', ohms: 0.1 }],
      },
      electricalOf,
    );
    const main = solution.results.get('bat1')?.branchCurrents.main ?? 0;
    expect(main).toBeGreaterThan(1);
    expect(solution.damageEvents[0]?.report.ruleId).toBe('BATTERY_SHORT');
    expect(solution.damageEvents[0]?.report.measured).toBeGreaterThan(1000);
  });

  it('rangkaian terbuka: arus ≈ 0, tanpa kerusakan', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bat1', 'battery-9v')],
        pinNets: { 'bat1:PLUS': 'p', 'bat1:MINUS': 'm' },
        sources: [],
      },
      electricalOf,
    );
    expect(Math.abs(solution.results.get('bat1')?.branchCurrents.main ?? 0)).toBeLessThan(1e-6);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('paket klasik riset: baterai 9V memberi makan L7805 → rel 5 V mandiri', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bat1', 'battery-9v'), instance('reg1', 'regulator-7805')],
        pinNets: {
          'bat1:PLUS': 'vin',
          'bat1:MINUS': 'GND',
          'reg1:IN': 'vin',
          'reg1:GND': 'GND',
          'reg1:OUT': 'out',
        },
        sources: [],
        links: [{ a: 'out', b: 'GND', ohms: 50 }],
      },
      electricalOf,
    );
    const vout = solution.voltages.get('out') ?? 0;
    expect(vout).toBeGreaterThan(4.8);
    expect(vout).toBeLessThan(5.0);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('meta: terminal snap + di x −2,5 dan − di x +2,5 (jarak 12,7 mm), puncak y 19,6', () => {
    const byId = new Map(BATTERY_9V_META.pins.map((p) => [p.id, p]));
    expect(byId.get('PLUS')?.localPosition).toEqual([-2.5, 19.6, 0]);
    expect(byId.get('MINUS')?.localPosition).toEqual([2.5, 19.6, 0]);
  });
});
