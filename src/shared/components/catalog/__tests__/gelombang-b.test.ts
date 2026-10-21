import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentElectrical,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { mosfetPlugin } from '../mosfet/index';
import { mosfetElectrical, mosfetRds } from '../mosfet/electrical';
import { flameSensorPlugin } from '../flame-sensor/index';
import { flameSensorElectrical } from '../flame-sensor/electrical';
import { rainSensorPlugin } from '../rain-sensor/index';
import { rainSensorElectrical, rainPlateResistance } from '../rain-sensor/electrical';
import { mq2Plugin } from '../mq2/index';
import { mq2Electrical, mq2Rs } from '../mq2/electrical';
import { soundSensorPlugin } from '../sound-sensor/index';
import { soundSensorElectrical } from '../sound-sensor/electrical';

/**
 * Tes Gelombang B (MOSFET, KY-026, MH-RD, MQ-2, KY-038) — resolver
 * elektrik LOKAL dari paket komponen masing-masing, karena registri
 * pusat adalah wilayah agent integrasi. Pola harness sama seperti
 * tes gelombang sebelumnya (solveCircuit + sumber Thevenin).
 */
const BY_TYPE: Record<string, ComponentElectrical> = {
  mosfet: mosfetElectrical,
  'flame-sensor': flameSensorElectrical,
  'rain-sensor': rainSensorElectrical,
  mq2: mq2Electrical,
  'sound-sensor': soundSensorElectrical,
};
const resolver = (type: string) => BY_TYPE[type];

function instance(
  id: string,
  type: string,
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const SOURCE_5V = [{ net: 'V5', volts: 5, seriesOhms: 1 }];

describe('Paket plugin Gelombang B — bentuk meta', () => {
  it('kelima plugin lengkap (meta + elektrik + render) dengan pin sesuai riset', () => {
    expect(mosfetPlugin.type).toBe('mosfet');
    expect(mosfetPlugin.name).toBe('MOSFET IRLZ44N');
    expect(mosfetPlugin.pins.map((p) => p.id)).toEqual(['G', 'D', 'S']);
    expect(mosfetPlugin.Render3D).toBeDefined();
    expect(mosfetPlugin.electrical).toBe(mosfetElectrical);

    expect(flameSensorPlugin.type).toBe('flame-sensor');
    expect(flameSensorPlugin.pins.map((p) => p.id)).toEqual(['GND', 'VCC', 'DO', 'AO']);

    expect(rainSensorPlugin.type).toBe('rain-sensor');
    expect(rainSensorPlugin.pins.map((p) => p.id)).toEqual(['VCC', 'GND', 'DO', 'AO']);

    expect(mq2Plugin.type).toBe('mq2');
    expect(mq2Plugin.pins.map((p) => p.id)).toEqual(['VCC', 'GND', 'DO', 'AO']);

    expect(soundSensorPlugin.type).toBe('sound-sensor');
    expect(soundSensorPlugin.pins.map((p) => p.id)).toEqual(['AO', 'GND', 'VCC', 'DO']);
  });
});

describe('MOSFET IRLZ44N — saklar saluran D–S', () => {
  // D diberi 5 V lewat sumber berseri 10 Ω (garis beban), S ke GND,
  // G digerakkan sumber tegangan sendiri.
  const pinNets = { 'fet1:G': 'VG', 'fet1:D': 'VD', 'fet1:S': 'GND' };

  it('Vgs 0 V: saluran mati, arus drain ≈ 0 dan Vds ≈ penuh', () => {
    const solution = solveCircuit(
      {
        instances: [instance('fet1', 'mosfet')],
        pinNets,
        sources: [
          { net: 'VG', volts: 0, seriesOhms: 1 },
          { net: 'VD', volts: 5, seriesOhms: 10 },
        ],
      },
      resolver,
    );
    const res = solution.results.get('fet1');
    expect(Math.abs(res?.branchCurrents.id ?? 1)).toBeLessThan(0.00001);
    expect(res?.pinVoltages.D ?? 0).toBeGreaterThan(4.9);
  });

  it('Vgs 5 V: saluran terbuka penuh (RDS(on) 0,03 Ω), Id ≈ 0,5 A', () => {
    const solution = solveCircuit(
      {
        instances: [instance('fet1', 'mosfet')],
        pinNets,
        sources: [
          { net: 'VG', volts: 5, seriesOhms: 1 },
          { net: 'VD', volts: 5, seriesOhms: 10 },
        ],
      },
      resolver,
    );
    const res = solution.results.get('fet1');
    // Id = 5 / (10 + 0,03) ≈ 0,4985 A; Vds = Id × 0,03 ≈ 0,015 V.
    expect(res?.branchCurrents.id ?? 0).toBeGreaterThan(0.49);
    expect(res?.branchCurrents.id ?? 0).toBeLessThan(0.51);
    expect(res?.pinVoltages.D ?? 1).toBeLessThan(0.05);
    expect(res?.isDamaged).toBe(false);
  });

  it('kurva RDS: mati di bawah ambang, 0,03 Ω di atas 4,5 V, transisi monoton', () => {
    expect(mosfetRds(0)).toBe(10_000_000);
    expect(mosfetRds(1.5)).toBe(10_000_000);
    expect(mosfetRds(4.5)).toBeCloseTo(0.03, 6);
    expect(mosfetRds(3)).toBeLessThan(mosfetRds(2));
    expect(mosfetRds(3)).toBeGreaterThan(0.03);
  });

  it('|Vgs| 20 V: oksida gerbang jebol (MOSFET_GATE_OXIDE)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('fet1', 'mosfet')],
        pinNets,
        sources: [
          { net: 'VG', volts: 20, seriesOhms: 1 },
          { net: 'VD', volts: 5, seriesOhms: 10 },
        ],
      },
      resolver,
    );
    const res = solution.results.get('fet1');
    expect(res?.isDamaged).toBe(true);
    expect(res?.damageReport?.ruleId).toBe('MOSFET_GATE_OXIDE');
  });

  it('disipasi saluran > 2 W: MOSFET_OVERHEAT', () => {
    const solution = solveCircuit(
      {
        instances: [instance('fet1', 'mosfet')],
        pinNets,
        sources: [
          { net: 'VG', volts: 5, seriesOhms: 1 },
          { net: 'VD', volts: 24, seriesOhms: 1 },
        ],
      },
      resolver,
    );
    const res = solution.results.get('fet1');
    // Id ≈ 24 / 1,03 ≈ 23,3 A, Vds ≈ 0,7 V → P ≈ 16 W > 2 W.
    expect(res?.isDamaged).toBe(true);
    expect(res?.damageReport?.ruleId).toBe('MOSFET_OVERHEAT');
  });
});

describe('Sensor Api KY-026 — AO terbalik & DO aktif-RENDAH', () => {
  const pinNets = {
    'ky026:VCC': 'V5',
    'ky026:GND': 'GND',
    'ky026:AO': 'AO',
    'ky026:DO': 'DO',
  };

  it('tanpa api: AO ≈ VCC (5 V), DO HIGH', () => {
    const solution = solveCircuit(
      { instances: [instance('ky026', 'flame-sensor', { flame: 0 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(solution.voltages.get('AO') ?? 0).toBeGreaterThan(4.8);
    expect(solution.voltages.get('DO') ?? 0).toBeGreaterThan(4.8);
  });

  it('api 0,8: AO TURUN ke ±1 V dan DO aktif-RENDAH (≈0 V)', () => {
    const solution = solveCircuit(
      { instances: [instance('ky026', 'flame-sensor', { flame: 0.8 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(Math.abs((solution.voltages.get('AO') ?? 0) - 1)).toBeLessThan(0.15);
    expect(Math.abs(solution.voltages.get('DO') ?? 1)).toBeLessThan(0.1);
  });

  it('tanpa catu: AO ditahan ≈0 V (tidak ada bacaan hantu)', () => {
    const solution = solveCircuit(
      { instances: [instance('ky026', 'flame-sensor', { flame: 0.8 })], pinNets, sources: [] },
      resolver,
    );
    expect(Math.abs(solution.voltages.get('AO') ?? 1)).toBeLessThan(0.05);
  });

  it('catu 9 V: modul rusak (FLAME_OVERVOLTAGE)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('ky026', 'flame-sensor')],
        pinNets,
        sources: [{ net: 'V5', volts: 9, seriesOhms: 1 }],
      },
      resolver,
    );
    expect(solution.results.get('ky026')?.damageReport?.ruleId).toBe('FLAME_OVERVOLTAGE');
  });
});

describe('Sensor Hujan MH-RD — pembagi papan deteksi', () => {
  const pinNets = {
    'mhrd:VCC': 'V5',
    'mhrd:GND': 'GND',
    'mhrd:AO': 'AO',
    'mhrd:DO': 'DO',
  };

  it('resistansi papan: 1 MΩ kering → 5 kΩ terendam (dua titik jangkar)', () => {
    expect(rainPlateResistance(0)).toBe(1_000_000);
    expect(rainPlateResistance(1)).toBeCloseTo(5000, 3);
  });

  it('kering: AO ≈ VCC; terendam: AO turun ke ±1,67 V dan DO aktif-RENDAH', () => {
    const dry = solveCircuit(
      { instances: [instance('mhrd', 'rain-sensor', { wetness: 0 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(dry.voltages.get('AO') ?? 0).toBeGreaterThan(4.8);
    expect(dry.voltages.get('DO') ?? 0).toBeGreaterThan(4.8);

    const wet = solveCircuit(
      { instances: [instance('mhrd', 'rain-sensor', { wetness: 1 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    // AO = 5 × 5000 / (5000 + 10000) ≈ 1,667 V.
    expect(Math.abs((wet.voltages.get('AO') ?? 0) - 1.667)).toBeLessThan(0.1);
    expect(Math.abs(wet.voltages.get('DO') ?? 1)).toBeLessThan(0.1);
  });

  it('catu 9 V: modul rusak (RAIN_OVERVOLTAGE, batas 5,5 V)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('mhrd', 'rain-sensor')],
        pinNets,
        sources: [{ net: 'V5', volts: 9, seriesOhms: 1 }],
      },
      resolver,
    );
    expect(solution.results.get('mhrd')?.damageReport?.ruleId).toBe('RAIN_OVERVOLTAGE');
  });
});

describe('Sensor Gas MQ-2 — pemanas nyata + kurva log-log', () => {
  const pinNets = {
    'mq2:VCC': 'V5',
    'mq2:GND': 'GND',
    'mq2:AO': 'AO',
    'mq2:DO': 'DO',
  };

  it('pemanas menarik ±150 mA nyata dari rel 5 V', () => {
    const solution = solveCircuit(
      { instances: [instance('mq2', 'mq2')], pinNets, sources: SOURCE_5V },
      resolver,
    );
    const heater = solution.results.get('mq2')?.branchCurrents.heater ?? 0;
    // 5 V / (31 Ω + 1 Ω sumber) ≈ 0,156 A pada net; cabang dilaporkan 5/31 ≈ 0,161 A.
    expect(heater).toBeGreaterThan(0.14);
    expect(heater).toBeLessThan(0.18);
  });

  it('kurva Rs: jangkar 200 ppm ≈ 2,0 × Ro dan 10.000 ppm ≈ 0,18 × Ro', () => {
    expect(mq2Rs(200) / 10000).toBeCloseTo(2.0, 1);
    expect(mq2Rs(10000) / 10000).toBeCloseTo(0.18, 1);
  });

  it('udara bersih: AO rendah (±0,3 V); gas pekat 10.000 ppm: AO naik ke ±3,7 V, DO aktif-RENDAH', () => {
    const clean = solveCircuit(
      { instances: [instance('mq2', 'mq2', { ppm: 0 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(clean.voltages.get('AO') ?? 0).toBeGreaterThan(0.15);
    expect(clean.voltages.get('AO') ?? 0).toBeLessThan(0.45);
    expect(clean.voltages.get('DO') ?? 0).toBeGreaterThan(4.8);

    const rich = solveCircuit(
      { instances: [instance('mq2', 'mq2', { ppm: 10000 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(rich.voltages.get('AO') ?? 0).toBeGreaterThan(3.3);
    expect(rich.voltages.get('AO') ?? 0).toBeLessThan(4.1);
    expect(Math.abs(rich.voltages.get('DO') ?? 1)).toBeLessThan(0.1);
  });

  it('catu 9 V: pemanas terbakar (MQ2_HEATER_BURNOUT)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('mq2', 'mq2')],
        pinNets,
        sources: [{ net: 'V5', volts: 9, seriesOhms: 1 }],
      },
      resolver,
    );
    expect(solution.results.get('mq2')?.damageReport?.ruleId).toBe('MQ2_HEATER_BURNOUT');
  });
});

describe('Sensor Suara KY-038 — envelope kebisingan saja', () => {
  const pinNets = {
    'ky038:AO': 'AO',
    'ky038:GND': 'GND',
    'ky038:VCC': 'V5',
    'ky038:DO': 'DO',
  };

  it('hening: AO ≈ 0 V dan DO LOW; bising 0,5: AO ≈ 2,5 V', () => {
    const quiet = solveCircuit(
      { instances: [instance('ky038', 'sound-sensor', { noise: 0 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(Math.abs(quiet.voltages.get('AO') ?? 1)).toBeLessThan(0.1);
    expect(Math.abs(quiet.voltages.get('DO') ?? 1)).toBeLessThan(0.1);

    const half = solveCircuit(
      { instances: [instance('ky038', 'sound-sensor', { noise: 0.5 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(Math.abs((half.voltages.get('AO') ?? 0) - 2.5)).toBeLessThan(0.15);
  });

  it('bising 0,8 melewati ambang: DO menjadi HIGH', () => {
    const solution = solveCircuit(
      { instances: [instance('ky038', 'sound-sensor', { noise: 0.8 })], pinNets, sources: SOURCE_5V },
      resolver,
    );
    expect(solution.voltages.get('DO') ?? 0).toBeGreaterThan(4.8);
  });

  it('catu 9 V: modul rusak (SOUND_OVERVOLTAGE)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('ky038', 'sound-sensor')],
        pinNets,
        sources: [{ net: 'V5', volts: 9, seriesOhms: 1 }],
      },
      resolver,
    );
    expect(solution.results.get('ky038')?.damageReport?.ruleId).toBe('SOUND_OVERVOLTAGE');
  });
});
