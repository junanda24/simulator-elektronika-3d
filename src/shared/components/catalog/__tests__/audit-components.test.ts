import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type StampContext,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { electricalOf } from '../../electricalRegistry';
import { COMPONENT_REGISTRY, getComponentPlugin } from '../../registry';
import { CATALOG_META } from '../../catalogMeta';
import {
  computeFreePlacement,
  computePlacement,
  isFreePlacementType,
} from '../../../../features/wiring/placement';
import { buildNetlist, type TerminalRef } from '../../../../features/wiring/netlist';
import { terminalHoleId } from '../../../boards/breadboard';

/**
 * AUDIT KOMPONEN (perintah user: "audit lagi semua komponennya!").
 *
 * Tiga arah konsistensi untuk SEMUA tipe katalog:
 * (a) pin yang benar-benar dipakai elektrikal (direkam dari panggilan
 *     netOf pada stamp + computeCurrents) == pin di meta, dan engine
 *     memetakan semua pin meta ke pinVoltages tanpa pin hantu;
 * (b) kunci pin hasil computePlacement == kunci pin meta;
 * (c) setiap tipe terdaftar di registry plugin, registry elektrik,
 *     dan catalogMeta.
 * Ditambah probe elektrikal terhitung manual untuk komponen yang
 * cakupan tes gelombangnya tipis.
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

const ALL_TYPES = Object.keys(CATALOG_META).sort();
const SOURCE_5V = [{ net: 'V5', volts: 5, seriesOhms: 1 }];

/** Pin yang secara elektrik "rendah" untuk tegangan tiruan perekam. */
const LOW_PINS = new Set(['GND', 'E', 'MINUS', 'COM', 'CATHODE']);

/**
 * Jalankan stamp + computeCurrents dengan StampContext perekam:
 * setiap pinId yang dilewatkan ke netOf dicatat. Mengembalikan
 * gabungan pin dari beberapa varian interactiveState.
 */
function recordedPins(
  type: string,
  variants: Array<Record<string, unknown>>,
): Set<string> {
  const electrical = electricalOf(type);
  const meta = CATALOG_META[type];
  const pins = new Set<string>();
  for (const interactiveState of variants) {
    const inst = instance(
      'probe',
      type,
      { ...(meta?.defaultProps ?? {}) },
      interactiveState,
    );
    const netOf = (_id: string, pinId: string): string => {
      pins.add(pinId);
      return `n:${pinId}`;
    };
    const ctx: StampContext = {
      netOf,
      prevVoltage: (net) => (LOW_PINS.has(net.slice(2)) ? 0 : 5),
      conductance: () => {},
      current: () => {},
      thevenin: () => {},
    };
    electrical?.stamp(ctx, inst, 1 / 60);
    const voltages = new Map<string, number>();
    for (const p of meta?.pins ?? []) {
      voltages.set(`n:${p.id}`, LOW_PINS.has(p.id) ? 0 : 5);
    }
    electrical?.computeCurrents(inst, voltages, netOf);
  }
  return pins;
}

const STATE_VARIANTS: Array<Record<string, unknown>> = [
  {},
  { pressed: true },
  { tilted: true },
  { locked: true },
  { motion: true },
  // Kunci gizmo gelombang ekspansi 2026-10-21 (reed/Hall, ultrasonik,
  // modul KY/MQ) — memperluas cakupan arah (a) ke keadaan aktif
  // komponen baru; komponen lama mengabaikan kunci asing.
  { magnet: true },
  { echoOn: true },
  { distanceCm: 10 },
  { flame: 1 },
  { wetness: 1 },
  { ppm: 5000 },
  { noise: 1 },
  { tempC: 80 },
];

describe('Audit konsistensi — (c) registrasi tiga registry', () => {
  it('tepat 33 tipe, dan himpunan tipe registry == catalogMeta', () => {
    expect(ALL_TYPES).toHaveLength(33);
    expect(COMPONENT_REGISTRY.map((p) => p.type).sort()).toEqual(ALL_TYPES);
  });

  it.each(ALL_TYPES)('%s: terdaftar di plugin, elektrik, dan meta', (type) => {
    expect(getComponentPlugin(type)?.type).toBe(type);
    expect(electricalOf(type)).toBeDefined();
    expect(CATALOG_META[type]?.type).toBe(type);
  });
});

describe('Audit konsistensi — (a) pin elektrikal == pin meta', () => {
  it.each(ALL_TYPES)(
    '%s: pin yang dipakai stamp/computeCurrents == pin meta (tanpa pin hantu, tanpa pin hilang)',
    (type) => {
      const metaPins = (CATALOG_META[type]?.pins ?? []).map((p) => p.id).sort();
      const used = [...recordedPins(type, STATE_VARIANTS)].sort();
      expect(used).toEqual(metaPins);
    },
  );

  it.each(ALL_TYPES)(
    '%s: solveCircuit memetakan semua pin meta ke pinVoltages, semua terhingga',
    (type) => {
      const meta = CATALOG_META[type];
      const pinNets: Record<string, string> = {};
      for (const p of meta?.pins ?? []) {
        pinNets[`x1:${p.id}`] = `pv_${p.id}`;
      }
      const firstPin = meta?.pins[0]?.id ?? 'A';
      const solution = solveCircuit(
        {
          instances: [instance('x1', type, { ...(meta?.defaultProps ?? {}) })],
          pinNets,
          sources: [{ net: `pv_${firstPin}`, volts: 5, seriesOhms: 1 }],
        },
        electricalOf,
      );
      const result = solution.results.get('x1');
      expect(result).toBeDefined();
      expect(Object.keys(result?.pinVoltages ?? {}).sort()).toEqual(
        (meta?.pins ?? []).map((p) => p.id).sort(),
      );
      for (const v of Object.values(result?.pinVoltages ?? {})) {
        expect(Number.isFinite(v)).toBe(true);
      }
    },
  );
});

describe('Audit konsistensi — (b) placement == meta', () => {
  /** Lubang jangkar sah per tipe (precondition klik placement). */
  function anchorFor(type: string): string {
    if (type === 'push-button') return terminalHoleId('L', 30, 4);
    if (type === 'relay') return terminalHoleId('L', 30, 4);
    if (type === 'led-bar-graph') return terminalHoleId('L', 30, 4);
    return terminalHoleId('L', 30, 0);
  }

  // Tipe terminal-bebas (baterai 9V) memang TIDAK punya placement
  // lubang — properti "placement menghasilkan semua pin" untuknya
  // dibuktikan di describe (b2) lewat jalur terminal-bebasnya.
  const HOLE_TYPES = ALL_TYPES.filter((t) => !isFreePlacementType(t));

  it.each(HOLE_TYPES)(
    '%s: kunci pinHoles computePlacement == kunci pin meta',
    (type) => {
      const placement = computePlacement(type, anchorFor(type), new Set());
      expect(placement).not.toBeNull();
      expect(Object.keys(placement?.pinHoles ?? {}).sort()).toEqual(
        (CATALOG_META[type]?.pins ?? []).map((p) => p.id).sort(),
      );
    },
  );
});

describe('Audit konsistensi — (b2) penempatan terminal-bebas == meta', () => {
  const FREE_TYPES = ALL_TYPES.filter((t) => isFreePlacementType(t));

  it('tepat satu tipe terminal-bebas: battery-9v', () => {
    expect(FREE_TYPES).toEqual(['battery-9v']);
  });

  it.each(FREE_TYPES)(
    '%s: jalur lubang null; jalur bebas menghasilkan instance di alas dengan pinHoles kosong',
    (type) => {
      expect(computePlacement(type, terminalHoleId('L', 30, 0), new Set())).toBeNull();
      const placement = computeFreePlacement(type, [45, 0], [], 0);
      expect(placement).not.toBeNull();
      expect(placement?.instance.type).toBe(type);
      expect(placement?.instance.position[1]).toBe(0);
      expect(placement?.pinHoles).toEqual({});
    },
  );

  it.each(FREE_TYPES)(
    '%s: semua pin meta menjadi terminal component yang bergabung ke net kabelnya',
    (type) => {
      const placement = computeFreePlacement(type, [45, 0], [], 0);
      expect(placement).not.toBeNull();
      const inst = placement!.instance;
      const meta = CATALOG_META[type];
      // Satu kabel per pin ke strip breadboard yang berbeda-beda.
      const wires = (meta?.pins ?? []).map((pin, i) => ({
        id: `w-${pin.id}`,
        a: { kind: 'component', instanceId: inst.id, pinId: pin.id } as TerminalRef,
        b: { kind: 'hole', holeId: terminalHoleId('L', 10 + i * 3, 0) } as TerminalRef,
        color: '#000000',
      }));
      const netlist = buildNetlist([inst], { [inst.id]: {} }, wires);
      for (const [i, pin] of (meta?.pins ?? []).entries()) {
        const holeRef: TerminalRef = {
          kind: 'hole',
          holeId: terminalHoleId('L', 10 + i * 3, 0),
        };
        // Net pin komponen == net lubang ujung kabelnya == net terminalnya.
        expect(netlist.netOfPin(inst.id, pin.id)).toBe(netlist.netOfTerminal(holeRef));
        expect(
          netlist.netOfTerminal({ kind: 'component', instanceId: inst.id, pinId: pin.id }),
        ).toBe(netlist.netOfPin(inst.id, pin.id));
      }
      // Pin-pin berbeda tetap net berbeda (tidak korslet oleh konstruksi).
      const nets = (meta?.pins ?? []).map((pin) => netlist.netOfPin(inst.id, pin.id));
      expect(new Set(nets).size).toBe(nets.length);
    },
  );
});

describe('Probe — Kapasitor: tegangan melebihi rating', () => {
  it('30 V pada kapasitor rating 25 V: rusak CAP_OVERVOLTAGE', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('cap1', 'capacitor', { capacitance: 100, voltageRating: 25 }),
        ],
        pinNets: { 'cap1:PLUS': 'V30', 'cap1:MINUS': 'GND' },
        sources: [{ net: 'V30', volts: 30, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const result = solution.results.get('cap1');
    // V(PLUS) = 30 × 10 MΩ / (10 MΩ + 1 Ω) ≈ 30,0 V > rating 25 V
    expect(result?.pinVoltages.PLUS ?? 0).toBeCloseTo(30, 0);
    expect(result?.isDamaged).toBe(true);
    expect(result?.damageReport?.ruleId).toBe('CAP_OVERVOLTAGE');
    expect(result?.damageReport?.limit).toBe(25);
    expect(solution.damageEvents).toHaveLength(1);
  });
});

describe('Probe — Transistor: saturasi membatasi Ic', () => {
  it('kolektor dijepit 0,1 V: Ic ≈ β·Ib × (Vce/0,25) ≈ 17 mA, bukan 43 mA penuh', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('tr1', 'transistor', { beta: 100 }),
          instance('rbase', 'resistor', { resistance: 10000 }),
        ],
        pinNets: {
          'tr1:E': 'GND',
          'tr1:B': 'bNet',
          'tr1:C': 'cNet',
          'rbase:A': 'V5',
          'rbase:B': 'bNet',
        },
        sources: [
          { net: 'V5', volts: 5, seriesOhms: 1 },
          // Sumber kaku 0,1 V menjepit Vce jauh di bawah VCE_SAT 0,25 V
          { net: 'cNet', volts: 0.1, seriesOhms: 0.1 },
        ],
      },
      electricalOf,
    );
    const result = solution.results.get('tr1');
    // Ib = (5 − 0,7) / (10001 + 25) ≈ 0,429 mA → β·Ib ≈ 42,9 mA (tak jenuh)
    // Faktor saturasi = Vce/0,25 ≈ 0,098/0,25 ≈ 0,39 → Ic ≈ 17 mA
    expect(result?.pinVoltages.C ?? 0).toBeGreaterThan(0.05);
    expect(result?.pinVoltages.C ?? 0).toBeLessThan(0.15);
    expect(result?.branchCurrents.ib ?? 0).toBeGreaterThan(0.0003);
    expect(result?.branchCurrents.ib ?? 0).toBeLessThan(0.0006);
    const ic = result?.branchCurrents.ic ?? 0;
    expect(ic).toBeGreaterThan(0.01);
    expect(ic).toBeLessThan(0.03);
    expect(ic).toBeLessThan(0.6 * 0.0429);
  });
});

describe('Probe — Servo: SIG dibebani tahanan pin', () => {
  it('SIG 2,5 V lewat 25 Ω: sudut terbaca ±92°, arus koil ±0,14 A', () => {
    const solution = solveCircuit(
      {
        instances: [instance('srv1', 'servo')],
        pinNets: { 'srv1:VCC': 'V5', 'srv1:GND': 'GND', 'srv1:SIG': 'sigNet' },
        sources: [
          { net: 'V5', volts: 5, seriesOhms: 1 },
          // Pin board PWM rata-rata 2,5 V dengan resistansi pin 25 Ω
          { net: 'sigNet', volts: 2.5, seriesOhms: 25 },
        ],
      },
      electricalOf,
    );
    const result = solution.results.get('srv1');
    // V(VCC) = 5 × 35/36 ≈ 4,86 V (beban servo 35 Ω dari sumber 1 Ω)
    // V(SIG) = 2,5 × 100 kΩ/(100 kΩ + 25 Ω) ≈ 2,499 V (input SIG 100 kΩ)
    // sudut = 2,499/4,86 × 180° ≈ 92,5°
    expect(result?.pinVoltages.SIG ?? 0).toBeGreaterThan(2.45);
    expect(result?.pinVoltages.SIG ?? 0).toBeLessThan(2.55);
    expect(result?.branchCurrents.angle ?? 0).toBeGreaterThan(88);
    expect(result?.branchCurrents.angle ?? 0).toBeLessThan(97);
    // I koil = 4,86/35 ≈ 0,139 A
    expect(result?.branchCurrents.coil ?? 0).toBeGreaterThan(0.12);
    expect(result?.branchCurrents.coil ?? 0).toBeLessThan(0.16);
  });
});

describe('Probe — Joystick: SW dengan pull-up internal board', () => {
  function build(pressed: boolean) {
    return {
      instances: [instance('joy1', 'joystick', {}, { pressed })],
      pinNets: {
        'joy1:VCC': 'V33',
        'joy1:GND': 'GND',
        'joy1:VRX': 'vrxNet',
        'joy1:VRY': 'vryNet',
        'joy1:SW': 'swNet',
      },
      sources: [{ net: 'V33', volts: 3.3, seriesOhms: 1 }],
      // Pull-up internal 20 kΩ pin INPUT_PULLUP (SIMULATION_RULES §1.4)
      links: [{ a: 'swNet', b: 'V33', ohms: 20000 }],
    };
  }

  it('SW lepas: net terbaca HIGH (≈3,3 V); SW ditekan: LOW (≈0 V)', () => {
    const released = solveCircuit(build(false), electricalOf);
    expect(released.voltages.get('swNet') ?? 0).toBeGreaterThan(3.2);
    const pressed = solveCircuit(build(true), electricalOf);
    // Kontak 1000 S ke GND melawan pull-up 20 kΩ → V ≈ 3,3 × (1/1000)/(1000) ≈ 0 V
    expect(pressed.voltages.get('swNet') ?? 0).toBeLessThan(0.01);
  });
});

describe('Probe — Soil moisture: AO dibebani 10 kΩ', () => {
  it('kelembaban 0,5 + beban 10 kΩ: AO turun dari ideal 2,50 V ke ±2,27 V', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('soil1', 'soil-moisture', {}, { moisture: 0.5 }),
          instance('rload', 'resistor', { resistance: 10000 }),
        ],
        pinNets: {
          'soil1:VCC': 'V5',
          'soil1:AO': 'aoNet',
          'soil1:GND': 'GND',
          'rload:A': 'aoNet',
          'rload:B': 'GND',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('soil1');
    // Thevenin ideal AO = 5 × (1 − 0,5) = 2,50 V lewat 1 kΩ;
    // dibebani 10 kΩ → V(AO) = 2,50 × 10/(10+1) ≈ 2,27 V
    expect(result?.pinVoltages.AO ?? 0).toBeGreaterThan(2.2);
    expect(result?.pinVoltages.AO ?? 0).toBeLessThan(2.34);
    expect(result?.pinVoltages.AO ?? 0).toBeLessThan(2.42);
    // Arus keluar pin AO = (2,27 − 2,50)/1 kΩ ≈ −0,227 mA
    expect(result?.branchCurrents.ao ?? 0).toBeGreaterThan(-0.00026);
    expect(result?.branchCurrents.ao ?? 0).toBeLessThan(-0.00019);
  });
});

describe('Probe — 7-segment: segmen A, B, dan DP bersamaan', () => {
  it('tiga segmen menyala independen ±13 mA, segmen lain mati, tidak rusak', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('ss1', 'seven-segment'),
          instance('ra', 'resistor', { resistance: 220 }),
          instance('rb', 'resistor', { resistance: 220 }),
          instance('rdp', 'resistor', { resistance: 220 }),
        ],
        pinNets: {
          'ra:A': 'V5',
          'ra:B': 'aNet',
          'rb:A': 'V5',
          'rb:B': 'bNet',
          'rdp:A': 'V5',
          'rdp:B': 'dpNet',
          'ss1:A': 'aNet',
          'ss1:B': 'bNet',
          'ss1:DP': 'dpNet',
          'ss1:COM': 'GND',
          // Segmen C–G sengaja tidak disambungkan
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('ss1');
    const currents = result?.branchCurrents ?? {};
    // Per segmen: I = (5 − 2,0)/(1 + 220 + 10) ≈ 13,0 mA — independen
    for (const key of ['a', 'b', 'dp']) {
      expect(currents[key] ?? 0).toBeGreaterThan(0.01);
      expect(currents[key] ?? 0).toBeLessThan(0.016);
    }
    for (const key of ['c', 'd', 'e', 'f', 'g']) {
      expect(Math.abs(currents[key] ?? 0)).toBeLessThan(0.0001);
    }
    expect(result?.isDamaged).toBe(false);
  });
});

describe('Probe — Relay mengalihkan motor DC nyata', () => {
  function build(inNet: string) {
    return {
      instances: [instance('rel1', 'relay'), instance('mot1', 'dc-motor')],
      pinNets: {
        'rel1:VCC': 'V5',
        'rel1:IN': inNet,
        'rel1:GND': 'GND',
        'rel1:COM': 'V5',
        'rel1:NO': 'noNet',
        'rel1:NC': 'ncNet',
        'mot1:PLUS': 'noNet',
        'mot1:MINUS': 'GND',
      },
      sources: SOURCE_5V,
    };
  }

  it('koil mati: motor di NO tidak berputar (arus ≈ 0); koil aktif: motor menarik ±0,38 A', () => {
    const off = solveCircuit(build('GND'), electricalOf);
    expect(off.results.get('rel1')?.branchCurrents.active).toBe(0);
    expect(Math.abs(off.results.get('mot1')?.branchCurrents.main ?? 0)).toBeLessThan(0.001);
    const on = solveCircuit(build('V5'), electricalOf);
    expect(on.results.get('rel1')?.branchCurrents.active).toBe(1);
    // I motor = 5/(1 Ω sumber + 12 Ω motor + kontak ±0) ≈ 0,385 A
    const motorAmps = on.results.get('mot1')?.branchCurrents.main ?? 0;
    expect(motorAmps).toBeGreaterThan(0.34);
    expect(motorAmps).toBeLessThan(0.43);
    expect(on.results.get('mot1')?.isDamaged).toBe(false);
  });
});

describe('Probe — LED RGB: tiga kanal bersamaan', () => {
  it('R/G/B lewat 220 Ω masing-masing: arus sesuai Vf per kanal', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('rgb1', 'rgb-led'),
          instance('rr', 'resistor', { resistance: 220 }),
          instance('rg', 'resistor', { resistance: 220 }),
          instance('rb', 'resistor', { resistance: 220 }),
        ],
        pinNets: {
          'rr:A': 'V5',
          'rr:B': 'rNet',
          'rg:A': 'V5',
          'rg:B': 'gNet',
          'rb:A': 'V5',
          'rb:B': 'bNet',
          'rgb1:R': 'rNet',
          'rgb1:G': 'gNet',
          'rgb1:B': 'bNet',
          'rgb1:COM': 'GND',
        },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('rgb1');
    const currents = result?.branchCurrents ?? {};
    // I = (5 − Vf)/(1 + 220 + 5): R (Vf 2,0) ≈ 13,3 mA; G (Vf 2,2) ≈ 12,4 mA; B (Vf 3,0) ≈ 8,8 mA
    expect(currents.r ?? 0).toBeGreaterThan(0.01);
    expect(currents.r ?? 0).toBeLessThan(0.016);
    expect(currents.g ?? 0).toBeGreaterThan(0.009);
    expect(currents.g ?? 0).toBeLessThan(0.015);
    expect(currents.b ?? 0).toBeGreaterThan(0.006);
    expect(currents.b ?? 0).toBeLessThan(0.011);
    expect(result?.isDamaged).toBe(false);
  });
});

describe('Probe — PIR menggerakkan basis transistor', () => {
  function build(motion: boolean) {
    return {
      instances: [
        instance('pir1', 'pir', {}, { motion }),
        instance('tr1', 'transistor', { beta: 100 }),
        instance('rbase', 'resistor', { resistance: 10000 }),
        instance('rcol', 'resistor', { resistance: 220 }),
        instance('led1', 'led-5mm', { color: 'red' }),
      ],
      pinNets: {
        'pir1:VCC': 'V5',
        'pir1:OUT': 'outNet',
        'pir1:GND': 'GND',
        'rbase:A': 'outNet',
        'rbase:B': 'bNet',
        'tr1:E': 'GND',
        'tr1:B': 'bNet',
        'tr1:C': 'cNet',
        'rcol:A': 'V5',
        'rcol:B': 'aNet',
        'led1:ANODE': 'aNet',
        'led1:CATHODE': 'cNet',
      },
      sources: SOURCE_5V,
    };
  }

  it('ada gerakan: OUT HIGH → LED kolektor menyala > 3 mA; tanpa gerakan: LED mati', () => {
    const on = solveCircuit(build(true), electricalOf);
    // OUT ≈ 5 V (Thevenin 100 Ω) → Ib ≈ (5 − 0,7)/(10 kΩ + 100 Ω) ≈ 0,42 mA
    expect(on.results.get('led1')?.branchCurrents.led ?? 0).toBeGreaterThan(0.003);
    const off = solveCircuit(build(false), electricalOf);
    // OUT ditahan 0 V lewat pull-down 10 kΩ → basis 0 V → transistor mati
    expect(Math.abs(off.results.get('led1')?.branchCurrents.led ?? 0)).toBeLessThan(0.0001);
  });
});

describe('Probe — Buzzer polaritas terbalik tetap aman', () => {
  it('PLUS ke GND, MINUS ke 5 V: arus bocor < 2 µA dan tidak rusak', () => {
    const solution = solveCircuit(
      {
        instances: [instance('bz1', 'buzzer')],
        pinNets: { 'bz1:PLUS': 'GND', 'bz1:MINUS': 'V5' },
        sources: SOURCE_5V,
      },
      electricalOf,
    );
    const result = solution.results.get('bz1');
    // Osilator internal tidak bekerja pada polaritas terbalik: R = 10 MΩ
    // I = −5 V/10 MΩ = −0,5 µA
    expect(Math.abs(result?.branchCurrents.main ?? 0)).toBeLessThan(2e-6);
    expect(result?.isDamaged).toBe(false);
    expect(solution.damageEvents).toHaveLength(0);
  });
});
