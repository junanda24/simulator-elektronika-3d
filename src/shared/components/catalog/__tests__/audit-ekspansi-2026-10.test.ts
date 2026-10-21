import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { electricalOf } from '../../electricalRegistry';
import { CATALOG_META } from '../../catalogMeta';
import {
  computePlacement,
  isFreePlacementType,
} from '../../../../features/wiring/placement';
import { componentPinWorldPosition } from '../../../../features/wiring/terminals';
import { holeWorldPosition, terminalHoleId } from '../../../boards/breadboard';

/**
 * AUDIT GELOMBANG EKSPANSI 2026-10-21 (perintah user: "cek lagi
 * komponen-komponennya ada bug?"). Probe berbasis bukti untuk 13 tipe
 * baru + jahitannya: geometri meta↔lubang, ambang kerusakan persis di
 * batas (divonis dari nilai TERUKUR di hasil, bukan dari niat sumber),
 * aturan yang terpicu tanpa catu, dan diskriminasi antar-aturan dalam
 * satu rangkaian. Nilai jangkar dasar sudah dibuktikan tes gelombang
 * masing-masing; berkas ini menyasar celah di antaranya.
 */

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

const NEW_TYPES = [
  'ntc-thermistor',
  'reed-switch',
  'fc-51',
  'ky-003',
  'mosfet',
  'flame-sensor',
  'rain-sensor',
  'mq2',
  'sound-sensor',
  'led-bar-graph',
  'regulator-7805',
  'battery-9v',
  'hc-sr04',
];

/* ------------------------------------------------------------------ */
/* 1. Geometri: lubang placement == posisi pin meta di dunia           */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — geometri meta ↔ lubang placement', () => {
  function anchorFor(type: string): string {
    if (type === 'push-button' || type === 'relay' || type === 'led-bar-graph') {
      return terminalHoleId('L', 30, 4);
    }
    return terminalHoleId('L', 30, 0);
  }

  const HOLE_NEW = NEW_TYPES.filter((t) => !isFreePlacementType(t));

  it.each(HOLE_NEW)(
    '%s: setiap pin meta mendarat tepat di lubang placement-nya (model 3D tidak meleset dari terminal)',
    (type) => {
      const placement = computePlacement(type, anchorFor(type), new Set());
      expect(placement).not.toBeNull();
      const inst = placement!.instance;
      for (const [pinId, holeId] of Object.entries(placement!.pinHoles)) {
        const hole = holeWorldPosition(holeId);
        const pinWorld = componentPinWorldPosition(inst, pinId);
        expect(hole).not.toBeNull();
        expect(pinWorld).not.toBeNull();
        const dx = Math.abs((hole?.[0] ?? 0) - (pinWorld?.[0] ?? 0));
        const dz = Math.abs((hole?.[2] ?? 0) - (pinWorld?.[2] ?? 0));
        expect(Math.max(dx, dz)).toBeLessThan(0.05);
      }
    },
  );
});

/* ------------------------------------------------------------------ */
/* 2. Keadaan tanpa catu: tidak ada tegangan absurd, tidak ada rusak   */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — tanpa catu sama sekali', () => {
  it.each(NEW_TYPES)(
    '%s: semua pin melayang di net sendiri → tegangan terhingga & wajar (|V| ≤ 12), arus terhingga, TIDAK rusak',
    (type) => {
      const meta = CATALOG_META[type];
      const pinNets: Record<string, string> = {};
      for (const p of meta.pins) pinNets[`u1:${p.id}`] = `float_${p.id}`;
      const solution = solveCircuit(
        { instances: [instance('u1', type)], pinNets, sources: [] },
        electricalOf,
      );
      const result = solution.results.get('u1');
      expect(result).toBeDefined();
      for (const v of Object.values(result?.pinVoltages ?? {})) {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThanOrEqual(12);
      }
      for (const a of Object.values(result?.branchCurrents ?? {})) {
        expect(Number.isFinite(a)).toBe(true);
      }
      expect(result?.isDamaged).toBe(false);
      expect(solution.damageEvents).toHaveLength(0);
    },
  );
});

/* ------------------------------------------------------------------ */
/* 3. L7805: pin IN menggantung tidak boleh melahirkan tegangan/kerusakan */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — L7805 dengan IN belum tersambung', () => {
  it('GND ter-ground, IN & OUT di net sendiri: IN ≈ 0 V dan regulator TIDAK rusak', () => {
    const solution = solveCircuit(
      {
        instances: [instance('reg1', 'regulator-7805')],
        pinNets: { 'reg1:IN': 'inFloat', 'reg1:GND': 'GND', 'reg1:OUT': 'outFloat' },
        sources: [],
      },
      electricalOf,
    );
    const result = solution.results.get('reg1');
    expect(Math.abs(result?.pinVoltages.IN ?? 0)).toBeLessThan(1);
    expect(result?.isDamaged).toBe(false);
  });

  it('berbeban: baterai → 7805 → 50 Ω: arus in ≈ out + Iq 6 mA, tak ada yang rusak', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('bat1', 'battery-9v'),
          instance('reg1', 'regulator-7805'),
          instance('load', 'resistor', { resistance: 50 }),
        ],
        pinNets: {
          'bat1:PLUS': 'vin',
          'bat1:MINUS': 'GND',
          'reg1:IN': 'vin',
          'reg1:GND': 'GND',
          'reg1:OUT': 'vout',
          'load:A': 'vout',
          'load:B': 'GND',
        },
        sources: [],
      },
      electricalOf,
    );
    const reg = solution.results.get('reg1');
    const out = reg?.branchCurrents.out ?? 0;
    const inA = reg?.branchCurrents.in ?? 0;
    expect(out).toBeGreaterThan(0.09);
    expect(out).toBeLessThan(0.11);
    expect(inA - out).toBeGreaterThan(0.004);
    expect(inA - out).toBeLessThan(0.008);
    expect(reg?.isDamaged).toBe(false);
    expect(solution.results.get('bat1')?.isDamaged).toBe(false);
  });

  it('diskriminasi: beban 6 Ω di keluaran → regulator OVERHEAT, baterai tetap sehat', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('bat1', 'battery-9v'),
          instance('reg1', 'regulator-7805'),
          instance('load', 'resistor', { resistance: 6 }),
        ],
        pinNets: {
          'bat1:PLUS': 'vin',
          'bat1:MINUS': 'GND',
          'reg1:IN': 'vin',
          'reg1:GND': 'GND',
          'reg1:OUT': 'vout',
          'load:A': 'vout',
          'load:B': 'GND',
        },
        sources: [],
      },
      electricalOf,
    );
    const reg = solution.results.get('reg1');
    expect(reg?.damageReport?.ruleId).toBe('REGULATOR_OVERHEAT');
    const bat = solution.results.get('bat1');
    expect(bat?.isDamaged).toBe(false);
    expect(Math.abs(bat?.branchCurrents.main ?? 0)).toBeLessThan(1);
  });
});

/* ------------------------------------------------------------------ */
/* 4. HC-SR04: kerusakan dinilai dari catu RELATIF pin GND-nya         */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — HC-SR04 catu relatif', () => {
  function build(vccVolts: number, gndVolts: number) {
    return {
      instances: [instance('hc1', 'hc-sr04')],
      pinNets: {
        'hc1:VCC': 'vccNet',
        'hc1:TRIG': 'trigNet',
        'hc1:ECHO': 'echoNet',
        'hc1:GND': 'gndNet',
      },
      sources: [
        { net: 'vccNet', volts: vccVolts, seriesOhms: 0.1 },
        { net: 'gndNet', volts: gndVolts, seriesOhms: 0.1 },
      ],
    };
  }

  it('VCC 9 V terhadap GND pin di 4 V (catuan sah 5 V): TIDAK rusak', () => {
    const solution = solveCircuit(build(9, 4), electricalOf);
    const result = solution.results.get('hc1');
    expect((result?.pinVoltages.VCC ?? 0) - (result?.pinVoltages.GND ?? 0)).toBeCloseTo(5, 0);
    expect(result?.isDamaged).toBe(false);
  });

  it('VCC 5,5 V terhadap GND pin di −1 V (catuan 6,5 V): rusak HCSR04_OVERVOLTAGE', () => {
    const solution = solveCircuit(build(5.5, -1), electricalOf);
    const result = solution.results.get('hc1');
    expect((result?.pinVoltages.VCC ?? 0) - (result?.pinVoltages.GND ?? 0)).toBeCloseTo(6.5, 0);
    expect(result?.damageReport?.ruleId).toBe('HCSR04_OVERVOLTAGE');
  });
});

/* ------------------------------------------------------------------ */
/* 5. Ambang kerusakan modul: vonis mengikuti nilai TERUKUR            */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — sapuan ambang kerusakan (vonis ⟺ terukur > batas)', () => {
  const MODULE_LIMITS: Array<{ type: string; limit: number; ruleId: string; volts: number[] }> = [
    { type: 'fc-51', limit: 5.5, ruleId: 'FC51_OVERVOLTAGE', volts: [5.3, 5.5, 5.7, 6] },
    { type: 'rain-sensor', limit: 5.5, ruleId: 'RAIN_OVERVOLTAGE', volts: [5.3, 5.5, 5.7, 6] },
    { type: 'flame-sensor', limit: 6, ruleId: 'FLAME_OVERVOLTAGE', volts: [5.8, 6, 6.2, 6.5] },
    { type: 'mq2', limit: 6, ruleId: 'MQ2_HEATER_BURNOUT', volts: [5.8, 6, 6.2, 6.5] },
    { type: 'sound-sensor', limit: 6, ruleId: 'SOUND_OVERVOLTAGE', volts: [5.8, 6, 6.2, 6.5] },
  ];

  for (const { type, limit, ruleId, volts } of MODULE_LIMITS) {
    it(`${type}: rusak tepat bila catu terukur > ${limit} V (${ruleId})`, () => {
      const meta = CATALOG_META[type];
      const vccPin = meta.pins.find((p) => p.type === 'power')?.id ?? 'VCC';
      const gndPin = meta.pins.find((p) => p.type === 'ground')?.id ?? 'GND';
      for (const voltsIn of volts) {
        const pinNets: Record<string, string> = {};
        for (const p of meta.pins) pinNets[`m1:${p.id}`] = `n_${p.id}`;
        pinNets[`m1:${vccPin}`] = 'vccNet';
        pinNets[`m1:${gndPin}`] = 'GND';
        const solution = solveCircuit(
          {
            instances: [instance('m1', type)],
            pinNets,
            sources: [{ net: 'vccNet', volts: voltsIn, seriesOhms: 0.01 }],
          },
          electricalOf,
        );
        const result = solution.results.get('m1');
        const measured =
          (result?.pinVoltages[vccPin] ?? 0) - (result?.pinVoltages[gndPin] ?? 0);
        if (measured > limit) {
          expect(result?.damageReport?.ruleId).toBe(ruleId);
        } else {
          expect(result?.isDamaged).toBe(false);
        }
      }
    });
  }

  it('mosfet: oksida gerbang rusak tepat bila |Vgs| terukur > 16 V (kedua polaritas)', () => {
    for (const gateVolts of [15, 16.5, -16.5, -15]) {
      const solution = solveCircuit(
        {
          instances: [instance('f1', 'mosfet')],
          pinNets: { 'f1:G': 'gNet', 'f1:D': 'dNet', 'f1:S': 'GND' },
          sources: [
            { net: 'gNet', volts: gateVolts, seriesOhms: 1 },
            { net: 'dNet', volts: 5, seriesOhms: 10 },
          ],
        },
        electricalOf,
      );
      const result = solution.results.get('f1');
      const vgs = (result?.pinVoltages.G ?? 0) - (result?.pinVoltages.S ?? 0);
      if (Math.abs(vgs) > 16) {
        expect(result?.damageReport?.ruleId).toBe('MOSFET_GATE_OXIDE');
      } else {
        expect(result?.isDamaged).toBe(false);
      }
    }
  });

  it('reed-switch: weld tepat bila arus kontak terukur > 0,5 A', () => {
    for (const loadOhms of [20, 10.1, 8, 4]) {
      const solution = solveCircuit(
        {
          instances: [
            instance('sw1', 'reed-switch', {}, { magnet: true }),
            instance('load', 'resistor', { resistance: loadOhms }),
          ],
          pinNets: {
            'sw1:A': 'V5',
            'sw1:B': 'midNet',
            'load:A': 'midNet',
            'load:B': 'GND',
          },
          sources: [{ net: 'V5', volts: 5, seriesOhms: 0.1 }],
        },
        electricalOf,
      );
      const result = solution.results.get('sw1');
      const amps = Math.abs(result?.branchCurrents.main ?? 0);
      if (amps > 0.5) {
        expect(result?.damageReport?.ruleId).toBe('REED_CONTACT_WELD');
      } else {
        expect(result?.isDamaged).toBe(false);
      }
    }
  });

  it('battery-9v: BATTERY_SHORT tepat bila arus keluar terukur > 1 A', () => {
    for (const loadOhms of [20, 8.5, 6.5, 3]) {
      const solution = solveCircuit(
        {
          instances: [
            instance('bat1', 'battery-9v'),
            instance('load', 'resistor', { resistance: loadOhms }),
          ],
          pinNets: {
            'bat1:PLUS': 'pNet',
            'bat1:MINUS': 'mNet',
            'load:A': 'pNet',
            'load:B': 'mNet',
          },
          sources: [],
        },
        electricalOf,
      );
      const result = solution.results.get('bat1');
      const amps = result?.branchCurrents.main ?? 0;
      if (amps > 1) {
        expect(result?.damageReport?.ruleId).toBe('BATTERY_SHORT');
      } else {
        expect(result?.isDamaged).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 6. Ambang keluaran digital modul (DO) di sekitar titik komparator   */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — ambang DO modul-modul KY/MQ', () => {
  function pinVoltage(
    type: string,
    state: Record<string, unknown>,
    pin: string,
  ): number {
    const meta = CATALOG_META[type];
    const pinNets: Record<string, string> = {};
    for (const p of meta.pins) pinNets[`m1:${p.id}`] = `n_${p.id}`;
    const vccPin = meta.pins.find((p) => p.type === 'power')?.id ?? 'VCC';
    const gndPin = meta.pins.find((p) => p.type === 'ground')?.id ?? 'GND';
    pinNets[`m1:${vccPin}`] = 'V5';
    pinNets[`m1:${gndPin}`] = 'GND';
    const solution = solveCircuit(
      {
        instances: [instance('m1', type, {}, state)],
        pinNets,
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    return solution.results.get('m1')?.pinVoltages[pin] ?? Number.NaN;
  }

  it('mq2 DO: 500 ppm → HIGH (≈5 V); 1500 ppm → LOW (≈0 V) — aktif-RENDAH', () => {
    expect(pinVoltage('mq2', { ppm: 500 }, 'DO')).toBeGreaterThan(4.5);
    expect(pinVoltage('mq2', { ppm: 1500 }, 'DO')).toBeLessThan(0.5);
  });

  it('flame-sensor DO: api 0,4 → HIGH; api 0,6 → LOW — aktif-RENDAH', () => {
    expect(pinVoltage('flame-sensor', { flame: 0.4 }, 'DO')).toBeGreaterThan(4.5);
    expect(pinVoltage('flame-sensor', { flame: 0.6 }, 'DO')).toBeLessThan(0.5);
  });

  it('rain-sensor DO: basah 0,4 → HIGH; basah 0,6 → LOW — aktif-RENDAH', () => {
    expect(pinVoltage('rain-sensor', { wetness: 0.4 }, 'DO')).toBeGreaterThan(4.5);
    expect(pinVoltage('rain-sensor', { wetness: 0.6 }, 'DO')).toBeLessThan(0.5);
  });

  it('sound-sensor DO: bising 0,5 → LOW; bising 0,7 → HIGH — aktif-HIGH (adopsi CircuitDigest)', () => {
    expect(pinVoltage('sound-sensor', { noise: 0.5 }, 'DO')).toBeLessThan(0.5);
    expect(pinVoltage('sound-sensor', { noise: 0.7 }, 'DO')).toBeGreaterThan(4.5);
  });

  it('ky-003 ambang catu: magnet dekat — S LOW tepat bila catu TERUKUR ≥ 4,5 V', () => {
    // Vonis dikondisikan pada tegangan pin terukur, bukan nominal
    // sumber: resistansi seri sumber selalu menurunkan tegangan pin
    // sedikit di bawah nominal (pada nominal 4,5 V pin menerima
    // ±4,4955 V lewat 1 Ω — di bawah gerbang, dan modul memang harus
    // diam di sana; itu perilaku benar, bukan bug).
    for (const nominal of [4.4, 4.51, 5]) {
      const solution = solveCircuit(
        {
          instances: [instance('h1', 'ky-003', {}, { magnet: true })],
          pinNets: { 'h1:GND': 'GND', 'h1:VCC': 'vccNet', 'h1:S': 'sNet' },
          sources: [{ net: 'vccNet', volts: nominal, seriesOhms: 0.01 }],
          links: [{ a: 'sNet', b: 'vccNet', ohms: 20000 }],
        },
        electricalOf,
      );
      const result = solution.results.get('h1');
      const measured = (result?.pinVoltages.VCC ?? 0) - (result?.pinVoltages.GND ?? 0);
      const vS = result?.pinVoltages.S ?? Number.NaN;
      if (measured >= 4.5) {
        expect(vS).toBeLessThan(0.1);
      } else {
        expect(vS).toBeGreaterThan(measured - 0.2);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* 7. Bar graph: sepuluh segmen serentak + segmen satu net             */
/* ------------------------------------------------------------------ */

describe('Audit ekspansi — LED bar graph beban penuh', () => {
  it('10 segmen menyala serentak lewat 220 Ω: tiap segmen 10–16 mA, tidak ada yang rusak', () => {
    const instances: ComponentInstanceState[] = [instance('bg1', 'led-bar-graph')];
    const pinNets: Record<string, string> = {};
    for (let seg = 1; seg <= 10; seg += 1) {
      instances.push(instance(`r${seg}`, 'resistor', { resistance: 220 }));
      pinNets[`r${seg}:A`] = 'V5';
      pinNets[`r${seg}:B`] = `a${seg}`;
      pinNets[`bg1:A${seg}`] = `a${seg}`;
      pinNets[`bg1:K${seg}`] = 'GND';
    }
    const solution = solveCircuit(
      { instances, pinNets, sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }] },
      electricalOf,
    );
    const result = solution.results.get('bg1');
    for (let seg = 1; seg <= 10; seg += 1) {
      const amps = result?.branchCurrents[`s${seg}`] ?? 0;
      expect(amps).toBeGreaterThan(0.01);
      expect(amps).toBeLessThan(0.016);
    }
    expect(result?.isDamaged).toBe(false);
  });

  it('anoda & katoda segmen yang sama di net yang sama: arus 0, tidak rusak, tidak NaN', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bg1', 'led-bar-graph')],
        pinNets: { 'bg1:A1': 'sameNet', 'bg1:K1': 'sameNet' },
        sources: [{ net: 'sameNet', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const result = solution.results.get('bg1');
    expect(Math.abs(result?.branchCurrents.s1 ?? 0)).toBeLessThan(1e-6);
    expect(result?.isDamaged).toBe(false);
  });
});
