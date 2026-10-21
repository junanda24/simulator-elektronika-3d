import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { electricalOf } from '../../../components/electricalRegistry';
import { getComponentPlugin } from '../../../components/registry';

function instance(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props,
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const SOURCE_5V = [{ net: 'V5', volts: 5, seriesOhms: 1 }];

describe('Registry — komponen Gelombang 5A', () => {
  it('kelima komponen terdaftar di registry plugin, elektrik, dan meta pin sesuai placement', () => {
    const expected: Array<{ type: string; pins: string[] }> = [
      { type: 'capacitor', pins: ['PLUS', 'MINUS'] },
      { type: 'diode', pins: ['ANODE', 'CATHODE'] },
      { type: 'transistor', pins: ['E', 'B', 'C'] },
      { type: 'relay', pins: ['VCC', 'IN', 'GND', 'COM', 'NO', 'NC'] },
      { type: 'rgb-led', pins: ['COM', 'R', 'G', 'B'] },
    ];
    for (const { type, pins } of expected) {
      const plugin = getComponentPlugin(type);
      expect(plugin?.type).toBe(type);
      expect(plugin?.pins.map((p) => p.id)).toEqual(pins);
      expect(electricalOf(type)).toBeDefined();
    }
    expect(getComponentPlugin('capacitor')?.defaultProps).toEqual({
      capacitance: 100,
      voltageRating: 25,
    });
    expect(getComponentPlugin('transistor')?.defaultProps).toEqual({ beta: 100 });
    expect(getComponentPlugin('relay')?.category).toBe('actuator');
    expect(getComponentPlugin('rgb-led')?.category).toBe('output');
  });
});

describe('Kapasitor Elektrolit — DC tunak & polaritas', () => {
  it('5 V searah: arus bocor < 2 µA dan tidak rusak', () => {
    const solution = solveCircuit(
      {
        instances: [instance('cap1', 'capacitor', { capacitance: 100, voltageRating: 25 })],
        pinNets: { 'cap1:PLUS': 'V5', 'cap1:MINUS': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('cap1');
    // I = 5 V / 10 MΩ = 0,5 µA
    expect(Math.abs(result?.branchCurrents.main ?? 0)).toBeLessThan(2e-6);
    expect(result?.isDamaged).toBe(false);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('dipasang terbalik 5 V: rusak dengan ruleId CAP_REVERSE_POLARITY', () => {
    const solution = solveCircuit(
      {
        instances: [instance('cap1', 'capacitor', { capacitance: 100, voltageRating: 25 })],
        pinNets: { 'cap1:PLUS': 'GND', 'cap1:MINUS': 'V5' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('cap1');
    expect(result?.isDamaged).toBe(true);
    expect(result?.damageReport?.ruleId).toBe('CAP_REVERSE_POLARITY');
  });
});

describe('Dioda 1N4007 — penyearah', () => {
  it('seri 220 Ω dari 5 V: arus maju 15–24 mA', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 220 }),
          instance('d1', 'diode'),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'mid',
          'd1:ANODE': 'mid',
          'd1:CATHODE': 'GND',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    // I = (5 − 0,7) / (1 + 220 + 2) ≈ 19,3 mA
    const amps = solution.results.get('d1')?.branchCurrents.main ?? 0;
    expect(amps).toBeGreaterThan(0.015);
    expect(amps).toBeLessThan(0.024);
  });

  it('arah balik: arus < 0,1 mA (dioda memblokir)', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 220 }),
          instance('d1', 'diode'),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'mid',
          'd1:ANODE': 'GND',
          'd1:CATHODE': 'mid',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const amps = solution.results.get('d1')?.branchCurrents.main ?? 0;
    expect(Math.abs(amps)).toBeLessThan(0.0001);
  });
});

describe('Transistor NPN — saklar penguat arus', () => {
  function buildCircuit(baseTargetNet: string) {
    return {
      instances: [
        instance('tr1', 'transistor', { beta: 100 }),
        instance('rbase', 'resistor', { resistance: 10000 }),
        instance('rcol', 'resistor', { resistance: 220 }),
        instance('led1', 'led-5mm', { color: 'red' }),
      ],
      pinNets: {
        'tr1:E': 'GND',
        'tr1:B': 'bNet',
        'tr1:C': 'cNet',
        'rbase:A': baseTargetNet,
        'rbase:B': 'bNet',
        'rcol:A': 'V5',
        'rcol:B': 'aNet',
        'led1:ANODE': 'aNet',
        'led1:CATHODE': 'cNet',
      },
      sources: SOURCE_5V,
    };
  }

  it('basis lewat 10 kΩ ke 5 V: LED di kolektor menyala (arus > 3 mA)', () => {
    const solution = solveCircuit(buildCircuit('V5'), electricalOf);
    const ledAmps = solution.results.get('led1')?.branchCurrents.led ?? 0;
    expect(ledAmps).toBeGreaterThan(0.003);
  });

  it('basis ke GND: transistor mati, arus LED < 0,1 mA', () => {
    const solution = solveCircuit(buildCircuit('GND'), electricalOf);
    const ledAmps = solution.results.get('led1')?.branchCurrents.led ?? 0;
    expect(Math.abs(ledAmps)).toBeLessThan(0.0001);
  });
});

describe('Modul Relay 5V — kontak pindah NC/NO', () => {
  function buildCircuit(inNet: string) {
    return {
      instances: [instance('rel1', 'relay')],
      pinNets: {
        'rel1:VCC': 'V5',
        'rel1:IN': inNet,
        'rel1:GND': 'GND',
        'rel1:COM': 'comNet',
        'rel1:NO': 'noNet',
        'rel1:NC': 'ncNet',
      },
      sources: [
        { net: 'V5', volts: 5, seriesOhms: 1 },
        { net: 'comNet', volts: 5, seriesOhms: 1 },
      ],
    };
  }

  it('IN ke GND: tidak aktif — NC mengikuti COM (5 V), NO ≈ 0 V, arus koil 50–90 mA', () => {
    const solution = solveCircuit(buildCircuit('GND'), electricalOf);
    expect(solution.voltages.get('ncNet') ?? 0).toBeGreaterThan(4.9);
    expect(Math.abs(solution.voltages.get('noNet') ?? 0)).toBeLessThan(0.01);
    const result = solution.results.get('rel1');
    expect(result?.branchCurrents.active).toBe(0);
    // I koil = 5 V / 71 Ω ≈ 70 mA
    expect(result?.branchCurrents.coil ?? 0).toBeGreaterThan(0.05);
    expect(result?.branchCurrents.coil ?? 0).toBeLessThan(0.09);
  });

  it('IN ke 5 V: aktif — NO mengikuti COM (5 V), NC ≈ 0 V', () => {
    const solution = solveCircuit(buildCircuit('V5'), electricalOf);
    expect(solution.voltages.get('noNet') ?? 0).toBeGreaterThan(4.9);
    expect(Math.abs(solution.voltages.get('ncNet') ?? 0)).toBeLessThan(0.01);
    const result = solution.results.get('rel1');
    expect(result?.branchCurrents.active).toBe(1);
    expect(result?.branchCurrents.coil ?? 0).toBeGreaterThan(0.05);
    expect(result?.branchCurrents.coil ?? 0).toBeLessThan(0.09);
  });
});

describe('LED RGB katoda umum — kanal independen', () => {
  it('kanal R lewat 220 Ω dari 5 V: arus r 9–17 mA, kanal g & b mati', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('rgb1', 'rgb-led'),
          instance('rr', 'resistor', { resistance: 220 }),
        ],
        pinNets: {
          'rgb1:COM': 'GND',
          'rgb1:R': 'rNet',
          'rr:A': 'V5',
          'rr:B': 'rNet',
          // Pin G & B sengaja tidak disambungkan (net mengambang sendiri)
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const currents = solution.results.get('rgb1')?.branchCurrents ?? {};
    // I_r = (5 − 2,0) / (1 + 220 + 5) ≈ 13,3 mA
    expect(currents.r ?? 0).toBeGreaterThan(0.009);
    expect(currents.r ?? 0).toBeLessThan(0.017);
    expect(Math.abs(currents.g ?? 0)).toBeLessThan(0.0001);
    expect(Math.abs(currents.b ?? 0)).toBeLessThan(0.0001);
  });
});
