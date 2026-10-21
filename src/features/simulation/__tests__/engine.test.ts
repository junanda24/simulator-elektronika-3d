import { describe, expect, it } from 'vitest';
import type {
  ComponentElectrical,
  ComponentInstanceState,
} from '../../../shared/types';
import { EMPTY_SIM_RESULT } from '../../../shared/types';
import { RESISTOR_META } from '../../../shared/components/catalog/resistor/meta';
import { resistorElectrical } from '../../../shared/components/catalog/resistor/electrical';
import { LED_META } from '../../../shared/components/catalog/led/meta';
import { ledElectrical } from '../../../shared/components/catalog/led/electrical';
import { solveCircuit } from '../solver/engine';

function instance(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props,
    interactiveState: {},
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const REGISTRY: Record<string, ComponentElectrical> = {
  [RESISTOR_META.type]: resistorElectrical,
  [LED_META.type]: ledElectrical,
};
const electricalOf = (type: string) => REGISTRY[type];

describe('Solver MNA — skenario spec Batch 1', () => {
  it('LED + resistor 220 Ω dari sumber 5 V: arus 12–14 mA, Vf ≈ 2,0 V, tanpa kerusakan', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 220 }),
          instance('led1', 'led-5mm', { color: 'red' }),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'N1',
          'led1:ANODE': 'N1',
          'led1:CATHODE': 'GND',
        },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );

    const led = solution.results.get('led1');
    expect(led).toBeDefined();
    const currentMa = (led?.branchCurrents.led ?? 0) * 1000;
    // Hitungan tangan: I = (5 − 2) / (1 + 220 + 5) = 3/226 ≈ 13,3 mA.
    expect(currentMa).toBeGreaterThanOrEqual(12);
    expect(currentMa).toBeLessThanOrEqual(14);
    const vAnode = led?.pinVoltages.ANODE ?? 0;
    const vCathode = led?.pinVoltages.CATHODE ?? 0;
    expect(vAnode - vCathode).toBeGreaterThanOrEqual(1.9);
    expect(vAnode - vCathode).toBeLessThanOrEqual(2.1);
    expect(led?.isDamaged).toBe(false);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('Pembagi tegangan 1 kΩ + 1 kΩ: node tengah 2,5 V ± 0,05 V', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 1000 }),
          instance('r2', 'resistor', { resistance: 1000 }),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'MID',
          'r2:A': 'MID',
          'r2:B': 'GND',
        },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );

    // 5 · 1000/(1 + 1000 + 1000) ≈ 2,499 V — di dalam toleransi 2,5 ± 0,05.
    expect(solution.voltages.get('MID') ?? NaN).toBeCloseTo(2.5, 1);
    expect(Math.abs((solution.voltages.get('MID') ?? 0) - 2.5)).toBeLessThanOrEqual(0.05);
  });

  it('LED langsung ke 5 V tanpa resistor: arus > 30 mA dan LED_OVERCURRENT', () => {
    const solution = solveCircuit(
      {
        instances: [instance('led1', 'led-5mm', { color: 'red' })],
        pinNets: { 'led1:ANODE': 'V5', 'led1:CATHODE': 'GND' },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );

    const led = solution.results.get('led1');
    // Hitungan tangan: I = (5 − 2) / (1 + 5) = 500 mA.
    expect((led?.branchCurrents.led ?? 0) * 1000).toBeGreaterThan(30);
    expect(led?.isDamaged).toBe(true);
    expect(solution.damageEvents).toHaveLength(1);
    expect(solution.damageEvents[0]?.instanceId).toBe('led1');
    expect(solution.damageEvents[0]?.report.ruleId).toBe('LED_OVERCURRENT');
    expect(solution.damageEvents[0]?.report.unit).toBe('mA');
    expect(solution.damageEvents[0]?.report.limit).toBe(30);
  });

  it('LED terbalik dengan katoda 6 V di atas anoda: LED_REVERSE_BREAKDOWN', () => {
    const solution = solveCircuit(
      {
        instances: [instance('led1', 'led-5mm', { color: 'red' })],
        pinNets: { 'led1:ANODE': 'GND', 'led1:CATHODE': 'V6' },
        sources: [{ net: 'V6', volts: 6, seriesOhms: 1 }],
      },
      electricalOf,
    );

    expect(solution.damageEvents).toHaveLength(1);
    expect(solution.damageEvents[0]?.report.ruleId).toBe('LED_REVERSE_BREAKDOWN');
    expect(solution.damageEvents[0]?.report.measured).toBeGreaterThan(5.0);
    expect(solution.results.get('led1')?.isDamaged).toBe(true);
  });

  it('Pin mengambang (tanpa kabel): semua tegangan hingga, tidak ada NaN/Infinity', () => {
    const solution = solveCircuit(
      {
        instances: [instance('r1', 'resistor', { resistance: 1000 })],
        // Pin B sengaja tidak diberi net — mengambang.
        pinNets: { 'r1:A': 'V5' },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );

    for (const v of solution.voltages.values()) {
      expect(Number.isFinite(v)).toBe(true);
    }
    const r1 = solution.results.get('r1');
    for (const v of Object.values(r1?.pinVoltages ?? {})) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(solution.voltages.get('GND')).toBe(0);
  });

  it('Engine generik: plugin tipe baru yang tidak dikenal core tetap diproses (zero-core-touch)', () => {
    // Plugin lokal khusus tes: shunt 1 kΩ antara pin X–Y.
    const shuntElectrical: ComponentElectrical = {
      stamp: (ctx, inst) => {
        ctx.conductance(ctx.netOf(inst.id, 'X'), ctx.netOf(inst.id, 'Y'), 1 / 1000);
      },
      computeCurrents: () => ({}),
      checkDamage: () => null,
    };
    const withShunt = (type: string) =>
      type === 'test-shunt' ? shuntElectrical : REGISTRY[type];

    const solution = solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 1000 }),
          instance('s1', 'test-shunt'),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'MID',
          's1:X': 'MID',
          's1:Y': 'GND',
        },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      withShunt,
    );

    // MID dibebani 1 kΩ (resistor) + 1 kΩ (shunt plugin) → pembagi 2,5 V.
    expect(Math.abs((solution.voltages.get('MID') ?? 0) - 2.5)).toBeLessThanOrEqual(0.05);
    expect(solution.results.has('s1')).toBe(true);
  });

  it('Instance yang sudah rusak: di-stamp terbuka, tanpa event kerusakan baru', () => {
    const damagedLed = instance('led1', 'led-5mm', { color: 'red' });
    damagedLed.simState = {
      pinVoltages: {},
      branchCurrents: {},
      isDamaged: true,
      damageReport: {
        ruleId: 'LED_OVERCURRENT',
        titleId: 'LED Terbakar — Arus Berlebih',
        explanationId: 'sudah rusak dari tick sebelumnya',
        measured: 500,
        limit: 30,
        unit: 'mA',
      },
    };

    const solution = solveCircuit(
      {
        instances: [damagedLed],
        pinNets: { 'led1:ANODE': 'V5', 'led1:CATHODE': 'GND' },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );

    const led = solution.results.get('led1');
    expect(led?.isDamaged).toBe(true);
    expect(led?.branchCurrents).toEqual({});
    expect(led?.damageReport?.ruleId).toBe('LED_OVERCURRENT');
    expect(solution.damageEvents).toHaveLength(0);
    // Karena LED terbuka, net V5 tidak dibebani: tegangan ≈ penuh 5 V.
    expect(solution.voltages.get('V5') ?? 0).toBeGreaterThan(4.9);
  });
});
