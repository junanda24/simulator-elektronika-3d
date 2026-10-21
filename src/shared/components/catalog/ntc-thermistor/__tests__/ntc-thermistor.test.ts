import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../../types';
import { solveCircuit } from '../../../../../features/simulation/solver/engine';
import {
  ntcResistance,
  ntcThermistorElectrical,
  tempCOf,
} from '../electrical';
import { NTC_THERMISTOR_META } from '../meta';

function instance(
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id: 'ntc1',
    type: 'ntc-thermistor',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const lookup = (type: string) =>
  type === 'ntc-thermistor' ? ntcThermistorElectrical : undefined;

describe('Termistor NTC 10K — meta', () => {
  it('pin A/B pasif tanpa polaritas pada z = ∓1', () => {
    expect(NTC_THERMISTOR_META.type).toBe('ntc-thermistor');
    expect(NTC_THERMISTOR_META.pins.map((p) => p.id)).toEqual(['A', 'B']);
    expect(NTC_THERMISTOR_META.pins.map((p) => p.localPosition)).toEqual([
      [0, 0, -1],
      [0, 0, 1],
    ]);
  });
});

describe('Termistor NTC 10K — kurva Beta B=3950 (datasheet MF52A1)', () => {
  it('jangkar 25 °C = 10 kΩ persis', () => {
    expect(ntcResistance(25)).toBeCloseTo(10000, 6);
  });

  it('−10 °C ≈ 58 kΩ dan 80 °C ≈ 1,27 kΩ (persamaan Beta)', () => {
    expect(ntcResistance(-10)).toBeGreaterThan(55000);
    expect(ntcResistance(-10)).toBeLessThan(61000);
    expect(ntcResistance(80)).toBeGreaterThan(1200);
    expect(ntcResistance(80)).toBeLessThan(1350);
  });

  it('monoton turun: makin panas makin kecil resistansinya (NTC)', () => {
    let prev = Infinity;
    for (const t of [-10, 0, 25, 50, 80]) {
      const r = ntcResistance(t);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
  });

  it('tempCOf: default 25 dan dijepit ke rentang gizmo −10…80', () => {
    expect(tempCOf(instance())).toBe(25);
    expect(tempCOf(instance({ tempC: 200 }))).toBe(80);
    expect(tempCOf(instance({ tempC: -50 }))).toBe(-10);
    expect(tempCOf(instance({ tempC: 'panas' }))).toBe(25);
  });
});

describe('Termistor NTC 10K — pembagi tegangan lewat solver', () => {
  // Rangkaian ajar kanonik: 5 V → resistor tetap 10 kΩ (seriesOhms
  // sumber) → node tengah (kaki A) → NTC → GND (kaki B).
  const pinNets = { 'ntc1:A': 'mid', 'ntc1:B': 'GND' };
  const sources = [{ net: 'mid', volts: 5, seriesOhms: 10000 }];

  it('25 °C: node tengah = 2,5 V (R NTC = R tetap)', () => {
    const sol = solveCircuit(
      { instances: [instance()], pinNets, sources },
      lookup,
    );
    expect(sol.voltages.get('mid') ?? 0).toBeCloseTo(2.5, 2);
  });

  it('80 °C: node tengah turun ke ±0,56 V (resistansi NTC runtuh)', () => {
    const sol = solveCircuit(
      { instances: [instance({ tempC: 80 })], pinNets, sources },
      lookup,
    );
    const v = sol.voltages.get('mid') ?? 0;
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(0.63);
  });

  it('−10 °C: node tengah naik ke ±4,27 V', () => {
    const sol = solveCircuit(
      { instances: [instance({ tempC: -10 })], pinNets, sources },
      lookup,
    );
    const v = sol.voltages.get('mid') ?? 0;
    expect(v).toBeGreaterThan(4.15);
    expect(v).toBeLessThan(4.4);
  });

  it('tidak pernah rusak (elemen pasif, tanpa aturan kerusakan)', () => {
    expect(
      ntcThermistorElectrical.checkDamage(instance(), {
        ...EMPTY_SIM_RESULT,
        pinVoltages: { A: 100, B: 0 },
        branchCurrents: { main: 5 },
      }),
    ).toBeNull();
  });
});
