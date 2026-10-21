import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { electricalOf } from '../../../components/electricalRegistry';
import { getComponentPlugin } from '../../../components/registry';
import { getComponentMeta } from '../../../components/catalogMeta';

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

describe('Registry — komponen Gelombang 5B (sensor)', () => {
  it('kelima komponen terdaftar di registry plugin, elektrik, dan meta; pin cocok dengan placement', () => {
    const expected: Array<{ type: string; pins: string[]; z: number[] }> = [
      { type: 'ldr', pins: ['A', 'B'], z: [-1, 1] },
      { type: 'pir', pins: ['VCC', 'OUT', 'GND'], z: [-1, 0, 1] },
      { type: 'lm35', pins: ['VCC', 'OUT', 'GND'], z: [-1, 0, 1] },
      { type: 'joystick', pins: ['VCC', 'GND', 'VRX', 'VRY', 'SW'], z: [-2, -1, 0, 1, 2] },
      { type: 'soil-moisture', pins: ['VCC', 'AO', 'GND'], z: [-1, 0, 1] },
    ];
    for (const { type, pins, z } of expected) {
      const plugin = getComponentPlugin(type);
      expect(plugin?.type).toBe(type);
      expect(plugin?.pins.map((p) => p.id)).toEqual(pins);
      expect(plugin?.pins.map((p) => p.localPosition[2])).toEqual(z);
      expect(plugin?.pins.every((p) => p.localPosition[0] === 0)).toBe(true);
      expect(electricalOf(type)).toBeDefined();
      expect(getComponentMeta(type)?.pins.map((p) => p.id)).toEqual(pins);
    }
    expect(getComponentPlugin('ldr')?.category).toBe('sensor');
    expect(getComponentPlugin('pir')?.category).toBe('sensor');
    expect(getComponentPlugin('lm35')?.category).toBe('sensor');
    expect(getComponentPlugin('soil-moisture')?.category).toBe('sensor');
  });
});

describe('LDR — resistansi logaritmik mengikuti cahaya', () => {
  function divider(light: number) {
    return solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 2000 }),
          instance('ldr1', 'ldr', {}, { light }),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'mid',
          'ldr1:A': 'mid',
          'ldr1:B': 'GND',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('terang penuh (light=1, R=200 Ω): tegangan node tengah kecil', () => {
    // V(mid) = 5 × 200 / (1 + 2000 + 200) ≈ 0,45 V
    const solution = divider(1);
    expect(solution.voltages.get('mid') ?? 0).toBeLessThan(0.6);
  });

  it('gelap total (light=0, R=20 kΩ): tegangan node tengah besar', () => {
    // V(mid) = 5 × 20000 / (1 + 2000 + 20000) ≈ 4,55 V
    const solution = divider(0);
    expect(solution.voltages.get('mid') ?? 0).toBeGreaterThan(4.3);
  });

  it('cahaya setengah (light=0,5, R≈2 kΩ): tegangan tengah ≈ setengah catu', () => {
    // R(0,5) = 20000 × (0,01)^0,5 = 2000 Ω → V(mid) ≈ 2,5 V
    const solution = divider(0.5);
    const v = solution.voltages.get('mid') ?? 0;
    expect(v).toBeGreaterThan(2.3);
    expect(v).toBeLessThan(2.7);
  });
});

describe('LM35 — keluaran 10 mV/°C', () => {
  function read(tempC: number) {
    return solveCircuit(
      {
        instances: [instance('t1', 'lm35', {}, { tempC })],
        pinNets: { 't1:VCC': 'V5', 't1:OUT': 'outNet', 't1:GND': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('25 °C → OUT ≈ 0,25 V', () => {
    const v = read(25).voltages.get('outNet') ?? 0;
    expect(Math.abs(v - 0.25)).toBeLessThan(0.02);
  });

  it('60 °C → OUT ≈ 0,60 V', () => {
    const v = read(60).voltages.get('outNet') ?? 0;
    expect(Math.abs(v - 0.6)).toBeLessThan(0.02);
  });
});

describe('PIR — OUT digital mengikuti gerakan', () => {
  function read(motion: boolean) {
    return solveCircuit(
      {
        instances: [instance('pir1', 'pir', {}, { motion })],
        pinNets: { 'pir1:VCC': 'V5', 'pir1:OUT': 'outNet', 'pir1:GND': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('tanpa gerakan: OUT < 0,1 V', () => {
    expect(read(false).voltages.get('outNet') ?? 0).toBeLessThan(0.1);
  });

  it('ada gerakan: OUT > 4,5 V (didorong ke VCC)', () => {
    expect(read(true).voltages.get('outNet') ?? 0).toBeGreaterThan(4.5);
  });
});

describe('Sensor Kelembaban Tanah — AO berbanding terbalik', () => {
  function read(moisture: number) {
    return solveCircuit(
      {
        instances: [instance('sm1', 'soil-moisture', {}, { moisture })],
        pinNets: { 'sm1:VCC': 'V5', 'sm1:AO': 'aoNet', 'sm1:GND': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('kering (moisture=0): AO > 4,5 V', () => {
    expect(read(0).voltages.get('aoNet') ?? 0).toBeGreaterThan(4.5);
  });

  it('basah (moisture=1): AO < 0,1 V', () => {
    expect(read(1).voltages.get('aoNet') ?? 0).toBeLessThan(0.1);
  });

  it('setengah (moisture=0,5): AO ≈ 2,5 V', () => {
    const v = read(0.5).voltages.get('aoNet') ?? 0;
    expect(Math.abs(v - 2.5)).toBeLessThan(0.3);
  });
});

describe('Joystick Analog — VRX/VRY & tombol SW', () => {
  function read(interactiveState: Record<string, unknown>) {
    return solveCircuit(
      {
        instances: [instance('joy1', 'joystick', {}, interactiveState)],
        pinNets: {
          'joy1:VCC': 'V5',
          'joy1:GND': 'GND',
          'joy1:VRX': 'vrxNet',
          'joy1:VRY': 'vryNet',
          'joy1:SW': 'swNet',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('tuas tengah (alphaX=0,5): VRX ≈ 2,5 V', () => {
    const v = read({ alphaX: 0.5, alphaY: 0.5 }).voltages.get('vrxNet') ?? 0;
    expect(Math.abs(v - 2.5)).toBeLessThan(0.3);
  });

  it('tuas penuh (alphaX=1): VRX > 4,5 V', () => {
    expect(read({ alphaX: 1 }).voltages.get('vrxNet') ?? 0).toBeGreaterThan(4.5);
  });

  it('SW ditekan: pin SW tertarik ke GND (< 0,1 V) dan arus tombol terhitung', () => {
    const solution = read({ pressed: true });
    expect(Math.abs(solution.voltages.get('swNet') ?? 0)).toBeLessThan(0.1);
  });

  it('SW tidak ditekan: tidak ada jalur — branchCurrents.sw ≈ 0', () => {
    const solution = read({ pressed: false });
    const sw = solution.results.get('joy1')?.branchCurrents.sw ?? 0;
    expect(Math.abs(sw)).toBeLessThan(1e-9);
  });
});
