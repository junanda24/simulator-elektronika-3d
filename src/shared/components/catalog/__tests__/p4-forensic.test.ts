import { describe, expect, it } from 'vitest';
import { EMPTY_SIM_RESULT, type ComponentInstanceState } from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { electricalOf } from '../../electricalRegistry';

/**
 * AUDIT P4 (Fase 4 forensik + Gerbang 7, rencana audit user 2026-10-21).
 * Sudut yang belum teruji gelombang audit siang: push button ujung-ke-
 * ujung, gerbang daya sensor, servo 3,3 V, saturasi transistor arus
 * basis kuat, ambang bunyi buzzer, inrush kapasitor, sapuan 3,3 V.
 * Semua ekspektasi adalah hitungan tangan dari nilai komponen model.
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

/** Beban 10 kΩ dari net keluaran sensor ke GND (meniru input board). */
function load10k(id: string, net: string) {
  return {
    instances: [instance(id, 'resistor', { resistance: 10000 })],
    pinNets: { [`${id}:A`]: net, [`${id}:B`]: 'GND' },
  };
}

describe('P4 F1 — Push button ujung-ke-ujung: pin OUTPUT → tombol → 220 Ω → LED → GND', () => {
  function build(pressed: boolean) {
    return {
      instances: [
        instance('btn1', 'push-button', {}, { pressed }),
        instance('r1', 'resistor', { resistance: 220 }),
        instance('led1', 'led-5mm', { color: 'red' }),
      ],
      pinNets: {
        'btn1:A1': 'D13',
        'btn1:A2': 'floatA2',
        'btn1:B1': 'mid',
        'btn1:B2': 'floatB2',
        'r1:A': 'mid',
        'r1:B': 'ledA',
        'led1:ANODE': 'ledA',
        'led1:CATHODE': 'GND',
      },
      // Pin board OUTPUT 5 V, resistansi pin 25 Ω (SIMULATION_RULES §1.4)
      sources: [{ net: 'D13', volts: 5, seriesOhms: 25 }],
    };
  }

  it('tidak ditekan: arus LED = 0 persis (kontak A–B terbuka)', () => {
    const sol = solveCircuit(build(false), electricalOf);
    expect(sol.results.get('led1')?.branchCurrents.led ?? -1).toBe(0);
    expect(sol.results.get('led1')?.isDamaged).toBe(false);
  });

  it('ditekan: LED menyala ±12 mA — I = (5 − Vf 2,0)/(25 + 220 + Ron 5) = 12,0 mA', () => {
    const sol = solveCircuit(build(true), electricalOf);
    const led = sol.results.get('led1')?.branchCurrents.led ?? 0;
    expect(led).toBeGreaterThan(0.011);
    expect(led).toBeLessThan(0.013);
    expect(sol.results.get('led1')?.isDamaged).toBe(false);
    expect(sol.damageEvents).toHaveLength(0);
  });

  it('kaki diagonal A2→B2 sama sahnya: jembatan se-sisi + A1–B1 membuat semua A terhubung ke semua B', () => {
    const sol = solveCircuit(
      {
        instances: [
          instance('btn1', 'push-button', {}, { pressed: true }),
          instance('r1', 'resistor', { resistance: 220 }),
          instance('led1', 'led-5mm', { color: 'red' }),
        ],
        pinNets: {
          'btn1:A1': 'floatA1',
          'btn1:A2': 'D13',
          'btn1:B1': 'floatB1',
          'btn1:B2': 'mid',
          'r1:A': 'mid',
          'r1:B': 'ledA',
          'led1:ANODE': 'ledA',
          'led1:CATHODE': 'GND',
        },
        sources: [{ net: 'D13', volts: 5, seriesOhms: 25 }],
      },
      electricalOf,
    );
    const led = sol.results.get('led1')?.branchCurrents.led ?? 0;
    expect(led).toBeGreaterThan(0.011);
    expect(led).toBeLessThan(0.013);
  });
});

describe('P4 F1b — Tilt switch pola yang sama', () => {
  function build(tilted: boolean) {
    return {
      instances: [
        instance('til1', 'tilt-switch', {}, { tilted }),
        instance('rload', 'resistor', { resistance: 10000 }),
      ],
      pinNets: { 'til1:A': 'V5', 'til1:B': 'outNet', 'rload:A': 'outNet', 'rload:B': 'GND' },
      sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
    };
  }

  it('tegak (terbuka 10 MΩ): V(out) = 5 × 10 kΩ/(10 MΩ + 10 kΩ) ≈ 0,005 V; miring: ≈ 5 V', () => {
    expect(solveCircuit(build(false), electricalOf).voltages.get('outNet') ?? 9).toBeLessThan(0.01);
    expect(solveCircuit(build(true), electricalOf).voltages.get('outNet') ?? 0).toBeGreaterThan(4.9);
  });
});

describe('P4 F2 — Gerbang daya sensor: tanpa catu, tanpa keluaran hantu', () => {
  it('LM35 TANPA daya (VCC mengambang): OUT ≈ 0 V — bukan 0,25 V suhu hantu', () => {
    const load = load10k('rload', 'outNet');
    const sol = solveCircuit(
      {
        instances: [instance('t1', 'lm35', {}, { tempC: 25 }), ...load.instances],
        pinNets: { 't1:VCC': 'vccFloat', 't1:OUT': 'outNet', 't1:GND': 'GND', ...load.pinNets },
        sources: [],
      },
      electricalOf,
    );
    expect(Math.abs(sol.voltages.get('outNet') ?? 9)).toBeLessThan(0.01);
  });

  it('LM35 catu kurang (2,0 V < gerbang 2,5 V): OUT tetap ≈ 0 V', () => {
    const load = load10k('rload', 'outNet');
    const sol = solveCircuit(
      {
        instances: [instance('t1', 'lm35', {}, { tempC: 25 }), ...load.instances],
        pinNets: { 't1:VCC': 'V2', 't1:OUT': 'outNet', 't1:GND': 'GND', ...load.pinNets },
        sources: [{ net: 'V2', volts: 2, seriesOhms: 1 }],
      },
      electricalOf,
    );
    expect(Math.abs(sol.voltages.get('outNet') ?? 9)).toBeLessThan(0.01);
  });

  it('LM35 berdaya 3,3 V (board ESP32): OUT = 0,25 V × 10 kΩ/(10 kΩ + 50 Ω) ≈ 0,2488 V', () => {
    const load = load10k('rload', 'outNet');
    const sol = solveCircuit(
      {
        instances: [instance('t1', 'lm35', {}, { tempC: 25 }), ...load.instances],
        pinNets: { 't1:VCC': 'V33', 't1:OUT': 'outNet', 't1:GND': 'GND', ...load.pinNets },
        sources: [{ net: 'V33', volts: 3.3, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const v = sol.voltages.get('outNet') ?? 0;
    expect(v).toBeGreaterThan(0.23);
    expect(v).toBeLessThan(0.26);
  });

  it('PIR tanpa daya + gerakan: OUT = 0 (target mengikuti VCC terukur)', () => {
    const load = load10k('rload', 'outNet');
    const sol = solveCircuit(
      {
        instances: [instance('pir1', 'pir', {}, { motion: true }), ...load.instances],
        pinNets: { 'pir1:VCC': 'vccFloat', 'pir1:OUT': 'outNet', 'pir1:GND': 'GND', ...load.pinNets },
        sources: [],
      },
      electricalOf,
    );
    expect(Math.abs(sol.voltages.get('outNet') ?? 9)).toBeLessThan(0.01);
  });

  it('Soil-moisture tanpa daya + tanah kering (keluaran maksimum): AO = 0', () => {
    const load = load10k('rload', 'aoNet');
    const sol = solveCircuit(
      {
        instances: [instance('s1', 'soil-moisture', {}, { moisture: 0 }), ...load.instances],
        pinNets: { 's1:VCC': 'vccFloat', 's1:AO': 'aoNet', 's1:GND': 'GND', ...load.pinNets },
        sources: [],
      },
      electricalOf,
    );
    expect(Math.abs(sol.voltages.get('aoNet') ?? 9)).toBeLessThan(0.01);
  });

  it('Joystick tanpa daya + sumbu penuh (alpha 1): VRX = 0', () => {
    const load = load10k('rload', 'xNet');
    const sol = solveCircuit(
      {
        instances: [
          instance('j1', 'joystick', {}, { alphaX: 1, alphaY: 1 }),
          ...load.instances,
        ],
        pinNets: {
          'j1:VCC': 'vccFloat',
          'j1:GND': 'GND',
          'j1:VRX': 'xNet',
          'j1:VRY': 'yNet',
          'j1:SW': 'swFloat',
          ...load.pinNets,
        },
        sources: [],
      },
      electricalOf,
    );
    expect(Math.abs(sol.voltages.get('xNet') ?? 9)).toBeLessThan(0.01);
  });
});

describe('P4 F3 — Servo di board 3,3 V: penyebut sudut = VCC terukur', () => {
  function build(sigVolts: number, powered: boolean) {
    return {
      instances: [instance('srv1', 'servo')],
      pinNets: {
        'srv1:VCC': powered ? 'V33' : 'vccFloat',
        'srv1:GND': 'GND',
        'srv1:SIG': 'sigNet',
      },
      sources: [
        ...(powered ? [{ net: 'V33', volts: 3.3, seriesOhms: 1 }] : []),
        { net: 'sigNet', volts: sigVolts, seriesOhms: 25 },
      ],
    };
  }

  it('SIG penuh 3,3 V → sudut 180° PENUH (klaim "bagi tetap 5,0 V" gugur)', () => {
    // V(VCC) = 3,3 × 35/36 ≈ 3,21 V; V(SIG) ≈ 3,30 V → rasio dijepit 1 → 180°
    const sol = solveCircuit(build(3.3, true), electricalOf);
    expect(sol.results.get('srv1')?.branchCurrents.angle ?? 0).toBeGreaterThan(175);
  });

  it('SIG rata-rata 1,65 V → sudut ±92,5° (rasio terhadap 3,21 V, bukan 5,0 V)', () => {
    // 1,65/3,21 × 180 ≈ 92,5° — bila penyebut 5,0 hasilnya hanya ±59°
    const angle = solveCircuit(build(1.65, true), electricalOf).results.get('srv1')
      ?.branchCurrents.angle ?? 0;
    expect(angle).toBeGreaterThan(88);
    expect(angle).toBeLessThan(97);
  });

  it('TANPA daya (VCC mengambang) + SIG 3,3 V: kunci angle tidak diterbitkan (tanduk tidak bergerak hantu)', () => {
    const sol = solveCircuit(build(3.3, false), electricalOf);
    expect(sol.results.get('srv1')?.branchCurrents.angle).toBeUndefined();
    expect(sol.results.get('srv1')?.branchCurrents.coil ?? 9).toBeLessThan(0.001);
  });
});

describe('P4 F4 — Transistor: arus basis kuat tidak membuat Vc negatif', () => {
  it('Rb 100 Ω (Ib ±34 mA, tuntutan β·Ib ±3,4 A): Vc ≈ +0,002 V (jenuh), Ic ±22,5 mA, tidak rusak', () => {
    const sol = solveCircuit(
      {
        instances: [
          instance('tr1', 'transistor', { beta: 100 }),
          instance('rb', 'resistor', { resistance: 100 }),
          instance('rc', 'resistor', { resistance: 220 }),
        ],
        pinNets: {
          'tr1:E': 'GND',
          'tr1:B': 'bNet',
          'tr1:C': 'cNet',
          'rb:A': 'V5',
          'rb:B': 'bNet',
          'rc:A': 'V5',
          'rc:B': 'cNet',
        },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const r = sol.results.get('tr1');
    // Vb = 0,7 + Ib × 25 Ω; Ib = (5 − 0,7)/(100 + 1 + 25) ≈ 34,1 mA
    expect(r?.branchCurrents.ib ?? 0).toBeGreaterThan(0.03);
    expect(r?.branchCurrents.ib ?? 0).toBeLessThan(0.038);
    // Konduktansi saturasi g = β·Ib/0,25 ≈ 13,6 S → Vc = Ic × (1/g) ≈ +0,0017 V ≥ 0
    expect(r?.pinVoltages.C ?? -9).toBeGreaterThanOrEqual(0);
    expect(r?.pinVoltages.C ?? 9).toBeLessThan(0.05);
    // Ic dibatasi beban kolektor: (5 − Vc)/(220 + 1) ≈ 22,6 mA — BUKAN 3,4 A
    expect(r?.branchCurrents.ic ?? 0).toBeGreaterThan(0.019);
    expect(r?.branchCurrents.ic ?? 0).toBeLessThan(0.026);
    expect(r?.isDamaged).toBe(false);
  });
});

describe('P4 F5 — Buzzer: ambang bunyi 5 mA (model 3D) tercapai di kasus sah', () => {
  function build(volts: number) {
    return {
      instances: [instance('bz1', 'buzzer')],
      pinNets: { 'bz1:PLUS': 'pinNet', 'bz1:MINUS': 'GND' },
      // Pin board: tegangan rata-rata + resistansi pin 25 Ω
      sources: [{ net: 'pinNet', volts, seriesOhms: 25 }],
    };
  }

  it('(a) board 3,3 V digitalWrite HIGH: I = 3,3/(150 + 25) ≈ 18,9 mA > 5 mA → berbunyi', () => {
    const r = solveCircuit(build(3.3), electricalOf).results.get('bz1');
    expect(r?.pinVoltages.PLUS ?? 0).toBeGreaterThan(2.7);
    expect(r?.pinVoltages.PLUS ?? 0).toBeLessThan(2.95);
    expect(r?.branchCurrents.main ?? 0).toBeGreaterThan(0.017);
    expect(r?.branchCurrents.main ?? 0).toBeLessThan(0.021);
  });

  it('(b) Uno analogWrite 128 (rata-rata 2,5 V): I = 2,5/175 ≈ 14,3 mA > 5 mA → berbunyi', () => {
    const r = solveCircuit(build(2.5), electricalOf).results.get('bz1');
    expect(r?.branchCurrents.main ?? 0).toBeGreaterThan(0.012);
    expect(r?.branchCurrents.main ?? 0).toBeLessThan(0.016);
  });
});

describe('P4 F6 — Kapasitor: tidak ada inrush C·dV/dt di model DC → tidak ada false-positive', () => {
  it('rangkaian seri 220 Ω → kapasitor 100 µF → LED: arus tunak = bocor 10 MΩ saja (±0,3 µA), nol kerusakan', () => {
    const sol = solveCircuit(
      {
        instances: [
          instance('cap1', 'capacitor', { capacitance: 100, voltageRating: 25 }),
          instance('led1', 'led-5mm', { color: 'red' }),
          instance('r1', 'resistor', { resistance: 220 }),
        ],
        pinNets: {
          'r1:A': 'V5',
          'r1:B': 'capP',
          'cap1:PLUS': 'capP',
          'cap1:MINUS': 'ledA',
          'led1:ANODE': 'ledA',
          'led1:CATHODE': 'GND',
        },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      electricalOf,
    );
    // Model kapasitor = resistor bocor murni; arus seri dibatasi 10 MΩ → ±0,3 µA
    expect(Math.abs(sol.results.get('cap1')?.branchCurrents.main ?? 9)).toBeLessThan(2e-6);
    expect(Math.abs(sol.results.get('led1')?.branchCurrents.led ?? 9)).toBeLessThan(2e-6);
    expect(sol.results.get('cap1')?.isDamaged).toBe(false);
    expect(sol.results.get('led1')?.isDamaged).toBe(false);
    expect(sol.damageEvents).toHaveLength(0);
  });
});

describe('P4 F7 — Sapuan cepat 3,3 V', () => {
  it('relay: IN 3,3 V > ambang 2,5 V → aktif; koil ±43 mA; motor di NO menarik ±0,25 A', () => {
    const sol = solveCircuit(
      {
        instances: [instance('rel1', 'relay'), instance('mot1', 'dc-motor')],
        pinNets: {
          'rel1:VCC': 'V33',
          'rel1:IN': 'V33',
          'rel1:GND': 'GND',
          'rel1:COM': 'V33',
          'rel1:NO': 'noNet',
          'rel1:NC': 'ncNet',
          'mot1:PLUS': 'noNet',
          'mot1:MINUS': 'GND',
        },
        sources: [{ net: 'V33', volts: 3.3, seriesOhms: 1 }],
      },
      electricalOf,
    );
    expect(sol.results.get('rel1')?.branchCurrents.active).toBe(1);
    // V(VCC) tertekan beban koil+motor → I koil = V(VCC)/70 ≈ 43 mA
    expect(sol.results.get('rel1')?.branchCurrents.coil ?? 0).toBeGreaterThan(0.035);
    expect(sol.results.get('rel1')?.branchCurrents.coil ?? 0).toBeLessThan(0.05);
    expect(sol.results.get('mot1')?.branchCurrents.main ?? 0).toBeGreaterThan(0.22);
    expect(sol.results.get('mot1')?.branchCurrents.main ?? 0).toBeLessThan(0.28);
  });

  it('relay: IN 2,4 V < ambang 2,5 V → tidak aktif (tepi ambang konsisten)', () => {
    const sol = solveCircuit(
      {
        instances: [instance('rel1', 'relay')],
        pinNets: {
          'rel1:VCC': 'V5',
          'rel1:IN': 'inNet',
          'rel1:GND': 'GND',
          'rel1:COM': 'cFloat',
          'rel1:NO': 'noFloat',
          'rel1:NC': 'ncFloat',
        },
        sources: [
          { net: 'V5', volts: 5, seriesOhms: 1 },
          { net: 'inNet', volts: 2.4, seriesOhms: 25 },
        ],
      },
      electricalOf,
    );
    expect(sol.results.get('rel1')?.branchCurrents.active).toBe(0);
  });

  it('seven-segment di 3,3 V lewat 220 Ω: I segmen = (3,3 − 2,0)/(1 + 220 + 10) ≈ 5,6 mA, tidak rusak', () => {
    const sol = solveCircuit(
      {
        instances: [
          instance('ss1', 'seven-segment'),
          instance('ra', 'resistor', { resistance: 220 }),
        ],
        pinNets: { 'ra:A': 'V33', 'ra:B': 'aNet', 'ss1:A': 'aNet', 'ss1:COM': 'GND' },
        sources: [{ net: 'V33', volts: 3.3, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const i = sol.results.get('ss1')?.branchCurrents.a ?? 0;
    expect(i).toBeGreaterThan(0.0045);
    expect(i).toBeLessThan(0.0068);
    expect(sol.results.get('ss1')?.isDamaged).toBe(false);
  });

  it('dc-motor di 3,3 V: I = 3,3/(1 + 12) ≈ 0,254 A → berputar, tidak rusak', () => {
    const sol = solveCircuit(
      {
        instances: [instance('mot1', 'dc-motor')],
        pinNets: { 'mot1:PLUS': 'V33', 'mot1:MINUS': 'GND' },
        sources: [{ net: 'V33', volts: 3.3, seriesOhms: 1 }],
      },
      electricalOf,
    );
    const i = sol.results.get('mot1')?.branchCurrents.main ?? 0;
    expect(i).toBeGreaterThan(0.23);
    expect(i).toBeLessThan(0.28);
    expect(sol.results.get('mot1')?.isDamaged).toBe(false);
  });
});
