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

describe('Registry — komponen Gelombang 5C', () => {
  it('keenam komponen terdaftar di registry plugin, elektrik, dan meta', () => {
    const expected: Array<{ type: string; pins: string[] }> = [
      { type: 'servo', pins: ['GND', 'VCC', 'SIG'] },
      { type: 'dc-motor', pins: ['PLUS', 'MINUS'] },
      { type: 'buzzer', pins: ['PLUS', 'MINUS'] },
      {
        type: 'seven-segment',
        pins: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'COM'],
      },
      { type: 'fuse', pins: ['A', 'B'] },
      { type: 'tilt-switch', pins: ['A', 'B'] },
    ];
    for (const { type, pins } of expected) {
      const plugin = getComponentPlugin(type);
      expect(plugin?.type).toBe(type);
      expect(plugin?.pins.map((p) => p.id)).toEqual(pins);
      expect(electricalOf(type)).toBeDefined();
      expect(getComponentMeta(type)?.type).toBe(type);
    }
    expect(getComponentPlugin('servo')?.category).toBe('actuator');
    expect(getComponentPlugin('dc-motor')?.category).toBe('actuator');
    expect(getComponentPlugin('buzzer')?.category).toBe('output');
    expect(getComponentPlugin('seven-segment')?.category).toBe('output');
    expect(getComponentPlugin('fuse')?.category).toBe('passive');
    expect(getComponentPlugin('fuse')?.defaultProps).toEqual({ rating: 500 });
    expect(getComponentPlugin('tilt-switch')?.category).toBe(
      getComponentPlugin('push-button')?.category,
    );
  });
});

describe('Motor Servo SG90 — sudut dari rasio SIG/VCC', () => {
  function solveServo(sigVolts: number) {
    return solveCircuit(
      {
        instances: [instance('sv1', 'servo')],
        pinNets: { 'sv1:VCC': 'V5', 'sv1:GND': 'GND', 'sv1:SIG': 'VSIG' },
        sources: [
          { net: 'V5', volts: 5, seriesOhms: 1 },
          { net: 'VSIG', volts: sigVolts, seriesOhms: 1 },
        ],
      },
      electricalOf,
    );
  }

  it('SIG 2,5 V dari VCC 5 V: sudut ≈ 90°', () => {
    const angle = solveServo(2.5).results.get('sv1')?.branchCurrents.angle ?? -1;
    expect(Math.abs(angle - 90)).toBeLessThanOrEqual(10);
  });

  it('SIG 0 V: sudut ≈ 0°', () => {
    const angle = solveServo(0).results.get('sv1')?.branchCurrents.angle ?? -1;
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(5);
  });

  it('SIG 5 V: sudut ≈ 180°', () => {
    const angle = solveServo(5).results.get('sv1')?.branchCurrents.angle ?? -1;
    expect(angle).toBeGreaterThan(170);
    expect(angle).toBeLessThanOrEqual(180);
  });
});

describe('Motor DC Kecil — bebas vs stall', () => {
  it('5 V langsung, poros bebas: arus ≈ 0,42 A dan tidak rusak', () => {
    const solution = solveCircuit(
      {
        instances: [instance('m1', 'dc-motor')],
        pinNets: { 'm1:PLUS': 'V5', 'm1:MINUS': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('m1');
    // I = 5 V / (1 Ω sumber + 12 Ω motor) ≈ 0,385 A
    expect(Math.abs((result?.branchCurrents.main ?? 0) - 0.42)).toBeLessThanOrEqual(0.08);
    expect(result?.isDamaged).toBe(false);
  });

  it('poros dikunci (locked): arus > 1 A dan rusak MOTOR_STALL', () => {
    const solution = solveCircuit(
      {
        instances: [instance('m1', 'dc-motor', {}, { locked: true })],
        pinNets: { 'm1:PLUS': 'V5', 'm1:MINUS': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('m1');
    // I = 5 V / (1 Ω sumber + 2 Ω stall) ≈ 1,67 A
    expect(Math.abs(result?.branchCurrents.main ?? 0)).toBeGreaterThan(1);
    expect(result?.isDamaged).toBe(true);
    expect(result?.damageReport?.ruleId).toBe('MOTOR_STALL');
  });
});

describe('Buzzer Aktif 5V — peka polaritas', () => {
  it('5 V maju: arus ≈ 33 mA (buzzer berbunyi)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bz1', 'buzzer')],
        pinNets: { 'bz1:PLUS': 'V5', 'bz1:MINUS': 'GND' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const amps = solution.results.get('bz1')?.branchCurrents.main ?? 0;
    // I = 5 V / (1 Ω sumber + 150 Ω buzzer) ≈ 33 mA
    expect(Math.abs(amps - 0.033)).toBeLessThanOrEqual(0.008);
  });

  it('polaritas dibalik: arus < 0,1 mA (buzzer diam)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bz1', 'buzzer')],
        pinNets: { 'bz1:PLUS': 'GND', 'bz1:MINUS': 'V5' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const amps = solution.results.get('bz1')?.branchCurrents.main ?? 0;
    expect(Math.abs(amps)).toBeLessThan(0.0001);
  });
});

describe('Display 7-Segment — segmen independen', () => {
  it('segmen A lewat 220 Ω dari 5 V, COM ke GND: arus a 8–18 mA, segmen lain mati', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('dsp1', 'seven-segment'),
          instance('ra', 'resistor', { resistance: 220 }),
        ],
        pinNets: {
          'dsp1:A': 'aNet',
          'dsp1:COM': 'GND',
          'ra:A': 'V5',
          'ra:B': 'aNet',
          // Segmen B–G & DP sengaja tidak disambungkan (net mengambang sendiri)
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const currents = solution.results.get('dsp1')?.branchCurrents ?? {};
    // I_a = (5 − 2,0) / (1 + 220 + 10) ≈ 13 mA
    expect(currents.a ?? 0).toBeGreaterThan(0.008);
    expect(currents.a ?? 0).toBeLessThan(0.018);
    for (const key of ['b', 'c', 'd', 'e', 'f', 'g', 'dp']) {
      expect(Math.abs(currents[key] ?? 0)).toBeLessThan(0.0001);
    }
  });
});

describe('Sekering 500 mA — pelindung rangkaian', () => {
  function solveFuse(loadOhms: number) {
    return solveCircuit(
      {
        instances: [
          instance('f1', 'fuse', { rating: 500 }),
          instance('load', 'resistor', { resistance: loadOhms }),
        ],
        pinNets: {
          'f1:A': 'V5',
          'f1:B': 'mid',
          'load:A': 'mid',
          'load:B': 'GND',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('beban 10 Ω: arus ≈ 0,45 A, sekering utuh', () => {
    const solution = solveFuse(10);
    const result = solution.results.get('f1');
    // I = 5 V / (1 + 0,01 + 10) Ω ≈ 0,454 A
    expect(Math.abs((result?.branchCurrents.main ?? 0) - 0.45)).toBeLessThanOrEqual(0.06);
    expect(result?.isDamaged).toBe(false);
  });

  it('beban 2 Ω: arus > 0,5 A dan sekering putus (FUSE_BLOWN)', () => {
    const solution = solveFuse(2);
    const result = solution.results.get('f1');
    expect(Math.abs(result?.branchCurrents.main ?? 0)).toBeGreaterThan(0.5);
    expect(result?.isDamaged).toBe(true);
    expect(result?.damageReport?.ruleId).toBe('FUSE_BLOWN');
  });
});

describe('Saklar Miring — kontak mengikuti kemiringan', () => {
  function solveTilt(tilted: boolean) {
    return solveCircuit(
      {
        instances: [
          instance('t1', 'tilt-switch', {}, { tilted }),
          instance('r1', 'resistor', { resistance: 1000 }),
        ],
        pinNets: {
          't1:A': 'V5',
          't1:B': 'mid',
          'r1:A': 'mid',
          'r1:B': 'GND',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
  }

  it('tegak (tilted=false): arus < 0,1 mA (kontak terbuka)', () => {
    const solution = solveTilt(false);
    const amps = solution.results.get('t1')?.branchCurrents.main ?? -1;
    expect(Math.abs(amps)).toBeLessThan(0.0001);
  });

  it('dimiringkan (tilted=true): arus ≈ 5 mA (kontak tertutup)', () => {
    const solution = solveTilt(true);
    const amps = solution.results.get('t1')?.branchCurrents.main ?? 0;
    // I = 5 V / (1 + 0,001 + 1000) Ω ≈ 5 mA
    expect(Math.abs(amps - 0.005)).toBeLessThanOrEqual(0.001);
  });
});
