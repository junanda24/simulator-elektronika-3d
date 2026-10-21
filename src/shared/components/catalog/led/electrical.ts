import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Tegangan maju (Vf) per warna LED, dalam volt — SIMULATION_RULES.md §1.3. */
export const LED_VF: Record<string, number> = {
  red: 2.0,
  yellow: 2.1,
  green: 2.2,
  blue: 3.0,
  white: 3.0,
};

/** Resistansi bocor saat LED OFF (Ω). */
const R_OFF = 10_000_000;
/** Resistansi dinamis saat LED ON (Ω). */
const R_ON = 5;
/** Batas arus aman mutlak; di atas ini LED terbakar (A). */
const MAX_CURRENT_A = 0.03;
/** Tegangan balik maksimum (Peak Inverse Voltage, V). */
const MAX_REVERSE_V = 5.0;

function vfOf(instance: ComponentInstanceState): number {
  const color = instance.props.color;
  return typeof color === 'string' ? (LED_VF[color] ?? LED_VF.red) : LED_VF.red;
}

/**
 * LED dimodelkan Piecewise-Linear 2-state (SIMULATION_RULES.md §1.3):
 * - OFF (V_anoda − V_katoda < Vf pada iterasi sebelumnya): resistor bocor 10 MΩ.
 * - ON: sumber tegangan Vf seri dengan Ron 5 Ω, distamp sebagai ekuivalen
 *   Norton — konduktansi 1/Ron antar anoda–katoda ditambah sumber arus
 *   Vf/Ron yang mengalir masuk ke anoda (dari katoda menuju anoda),
 *   sehingga arus cabang anoda→katoda = (Va − Vc − Vf) / Ron.
 */
export const ledElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vf = vfOf(instance);
    const anode = ctx.netOf(instance.id, 'ANODE');
    const cathode = ctx.netOf(instance.id, 'CATHODE');
    const prevDiff = ctx.prevVoltage(anode) - ctx.prevVoltage(cathode);
    if (prevDiff >= vf) {
      ctx.conductance(anode, cathode, 1 / R_ON);
      ctx.current(cathode, anode, vf / R_ON);
    } else {
      ctx.conductance(anode, cathode, 1 / R_OFF);
    }
  },

  computeCurrents: (instance, voltages, netOf) => {
    const vf = vfOf(instance);
    const va = voltages.get(netOf(instance.id, 'ANODE')) ?? 0;
    const vc = voltages.get(netOf(instance.id, 'CATHODE')) ?? 0;
    const led = va - vc >= vf ? (va - vc - vf) / R_ON : (va - vc) / R_OFF;
    return { led };
  },

  checkDamage: (_instance, result) => {
    const current = result.branchCurrents.led ?? 0;
    if (current > MAX_CURRENT_A) {
      return {
        ruleId: 'LED_OVERCURRENT',
        titleId: 'LED Terbakar — Arus Berlebih',
        explanationId:
          'LED membutuhkan pembatas arus. Menghubungkan LED langsung ke sumber tegangan membuat arus melonjak drastis (I = (Vs − Vf) / Ron) dan membakar semikonduktor di dalamnya. Pasang resistor seri (umumnya 220 Ω) agar arus tetap di bawah 20 mA.',
        measured: current * 1000,
        limit: MAX_CURRENT_A * 1000,
        unit: 'mA',
      };
    }
    const va = result.pinVoltages.ANODE ?? 0;
    const vc = result.pinVoltages.CATHODE ?? 0;
    if (vc - va > MAX_REVERSE_V) {
      return {
        ruleId: 'LED_REVERSE_BREAKDOWN',
        titleId: 'LED Rusak — Tegangan Balik Melebihi Batas',
        explanationId:
          'Polaritas LED terbalik melebihi tegangan Peak Inverse Voltage (5 V), menembus batas isolasi dioda. Periksa arah pemasangan: anoda (kaki panjang) harus menuju sisi positif dan katoda ke sisi negatif.',
        measured: vc - va,
        limit: MAX_REVERSE_V,
        unit: 'V',
      };
    }
    return null;
  },
};
