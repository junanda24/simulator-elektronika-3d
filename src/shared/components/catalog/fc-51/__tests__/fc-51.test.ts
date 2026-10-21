import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../../types';
import { solveCircuit } from '../../../../../features/simulation/solver/engine';
import {
  distanceCmOf,
  fc51Electrical,
  obstacleOf,
} from '../electrical';
import { FC51_META } from '../meta';

function instance(
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id: 'fc1',
    type: 'fc-51',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const lookup = (type: string) =>
  type === 'fc-51' ? fc51Electrical : undefined;

// VCC dipasok sumber 5 V; OUT dibaca pada net-nya sendiri.
const pinNets = { 'fc1:VCC': 'vcc', 'fc1:GND': 'GND', 'fc1:OUT': 'out' };
const sources = [{ net: 'vcc', volts: 5, seriesOhms: 1 }];

function outVolts(interactiveState: Record<string, unknown>): number {
  const sol = solveCircuit(
    { instances: [instance(interactiveState)], pinNets, sources },
    lookup,
  );
  return sol.voltages.get('out') ?? 0;
}

describe('FC-51 — meta & state jarak', () => {
  it('urutan pin fisik header VCC-GND-OUT pada z = −1/0/+1', () => {
    expect(FC51_META.pins.map((p) => p.id)).toEqual(['VCC', 'GND', 'OUT']);
    expect(FC51_META.pins.map((p) => p.localPosition)).toEqual([
      [0, 0, -1],
      [0, 0, 0],
      [0, 0, 1],
    ]);
  });

  it('distanceCmOf: default 35 (bebas), dijepit 0..35', () => {
    expect(distanceCmOf(instance())).toBe(35);
    expect(distanceCmOf(instance({ distanceCm: 99 }))).toBe(35);
    expect(distanceCmOf(instance({ distanceCm: -3 }))).toBe(0);
  });

  it('obstacleOf: ambang tetap 20 cm', () => {
    expect(obstacleOf(instance({ distanceCm: 35 }))).toBe(false);
    expect(obstacleOf(instance({ distanceCm: 21 }))).toBe(false);
    expect(obstacleOf(instance({ distanceCm: 20 }))).toBe(true);
    expect(obstacleOf(instance({ distanceCm: 5 }))).toBe(true);
  });
});

describe('FC-51 — OUT aktif-RENDAH lewat solver', () => {
  it('jalan bebas (35 cm): OUT HIGH ≈ VCC', () => {
    expect(outVolts({ distanceCm: 35 })).toBeGreaterThan(4.8);
  });

  it('halangan dekat (10 cm): OUT LOW ≈ 0 V', () => {
    expect(outVolts({ distanceCm: 10 })).toBeLessThan(0.2);
  });

  it('tanpa catu: OUT tidak mengambang membawa HIGH hantu', () => {
    const sol = solveCircuit(
      { instances: [instance({ distanceCm: 35 })], pinNets, sources: [] },
      lookup,
    );
    expect(Math.abs(sol.voltages.get('out') ?? 0)).toBeLessThan(0.01);
  });
});

describe('FC-51 — kerusakan catu berlebih (FC51_OVERVOLTAGE)', () => {
  it('catu 9 V (baterai langsung) memicu laporan rusak', () => {
    const report = fc51Electrical.checkDamage(instance(), {
      ...EMPTY_SIM_RESULT,
      pinVoltages: { VCC: 9, GND: 0, OUT: 0 },
    });
    expect(report?.ruleId).toBe('FC51_OVERVOLTAGE');
    expect(report?.limit).toBe(5.5);
    expect(report?.unit).toBe('V');
  });

  it('catu 5 V dan 3,3 V aman', () => {
    for (const v of [5, 3.3]) {
      expect(
        fc51Electrical.checkDamage(instance(), {
          ...EMPTY_SIM_RESULT,
          pinVoltages: { VCC: v, GND: 0, OUT: 0 },
        }),
      ).toBeNull();
    }
  });
});
