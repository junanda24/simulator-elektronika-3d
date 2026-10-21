import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentElectrical,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { hcSr04Electrical } from '../hc-sr04/electrical';

/**
 * Elektrik HC-SR04 — jejak DC yang jujur saja (riset §11.4): beban
 * catu ekuivalen 15 mA, TRIG masukan 10 kΩ, ECHO Thevenin mengikuti
 * VCC & flag jadwal sesi (echoOn). Perilaku ukurnya hidup di sesi,
 * bukan di sini. Tes memanggil solveCircuit dengan peta elektrik
 * lokal agar berdiri sendiri sebelum integrasi registri katalog.
 */

const localElectricalOf = (type: string): ComponentElectrical | undefined =>
  type === 'hc-sr04' ? hcSr04Electrical : undefined;

function instance(
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id: 'hc1',
    type: 'hc-sr04',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const PIN_NETS = {
  'hc1:VCC': 'vcc',
  'hc1:TRIG': 'trig',
  'hc1:ECHO': 'echo',
  'hc1:GND': 'GND',
};
const SOURCES_5V = [{ net: 'vcc', volts: 5, seriesOhms: 1 }];

describe('HC-SR04 — elektrik DC', () => {
  it('beban catu ±15 mA pada 5 V (ekuivalen 333 Ω) dan TRIG tertahan ke GND', () => {
    const solution = solveCircuit(
      { instances: [instance()], pinNets: PIN_NETS, sources: SOURCES_5V },
      localElectricalOf,
    );
    const result = solution.results.get('hc1');
    expect(result).toBeDefined();
    const main = result?.branchCurrents.main ?? 0;
    expect(main).toBeGreaterThan(0.013);
    expect(main).toBeLessThan(0.017);
    // TRIG mengambang selain beban modul: 10 kΩ ke GND → ≈0 V.
    expect(Math.abs(solution.voltages.get('trig') ?? 0)).toBeLessThan(0.01);
    // Di luar jendela ECHO: keluaran push-pull menahan ECHO di LOW.
    expect(Math.abs(solution.voltages.get('echo') ?? 0)).toBeLessThan(0.01);
  });

  it('echoOn dari sesi: ECHO naik setegangan VCC modul (±5 V)', () => {
    const input = {
      instances: [instance({ echoOn: true })],
      pinNets: PIN_NETS,
      sources: SOURCES_5V,
    };
    // Thevenin ECHO membaca tegangan VCC iterasi sebelumnya (pola PIR):
    // solve kedua dengan seed solusi pertama meniru sesi nyata.
    const first = solveCircuit(input, localElectricalOf);
    const second = solveCircuit(input, localElectricalOf, first.voltages);
    expect(second.voltages.get('echo') ?? 0).toBeGreaterThan(4.5);
  });

  it('kerusakan: catu di atas 6 V dilaporkan, 5 V aman', () => {
    const damaged = hcSr04Electrical.checkDamage(instance(), {
      pinVoltages: { VCC: 9 },
      branchCurrents: {},
      isDamaged: false,
    });
    expect(damaged?.ruleId).toBe('HCSR04_OVERVOLTAGE');
    const safe = hcSr04Electrical.checkDamage(instance(), {
      pinVoltages: { VCC: 5 },
      branchCurrents: {},
      isDamaged: false,
    });
    expect(safe).toBeNull();
  });
});
