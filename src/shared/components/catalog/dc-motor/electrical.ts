import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi belitan saat poros berputar bebas (Ω). */
const R_RUN = 12;
/** Resistansi belitan saat poros terkunci/stall (Ω) — arus melonjak. */
const R_LOCKED = 2;
/** Batas arus aman motor (A); di atas ini belitan terbakar. */
const MAX_CURRENT_A = 1;

function resistanceOf(instance: ComponentInstanceState): number {
  return instance.interactiveState.locked === true ? R_LOCKED : R_RUN;
}

/**
 * Motor DC kecil dimodelkan sebagai beban resistif: 12 Ω saat berputar
 * bebas, turun menjadi 2 Ω saat poros dikunci (stall) karena tidak ada
 * GGL lawan dari putaran. Arus di atas 1 A membakar belitan motor.
 */
export const dcMotorElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const plus = ctx.netOf(instance.id, 'PLUS');
    const minus = ctx.netOf(instance.id, 'MINUS');
    ctx.conductance(plus, minus, 1 / resistanceOf(instance));
  },

  computeCurrents: (instance, voltages, netOf) => {
    const va = voltages.get(netOf(instance.id, 'PLUS')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'MINUS')) ?? 0;
    return { main: (va - vb) / resistanceOf(instance) };
  },

  checkDamage: (_instance, result) => {
    const current = Math.abs(result.branchCurrents.main ?? 0);
    if (current > MAX_CURRENT_A) {
      return {
        ruleId: 'MOTOR_STALL',
        titleId: 'Motor DC Terbakar — Poros Terkunci (Stall)',
        explanationId:
          'Poros motor yang terkunci membuat belitan menarik arus stall yang jauh lebih besar dari arus kerja normal, dan panasnya membakar isolasi belitan. Jangan menahan poros motor yang sedang diberi daya; bila beban mekanis terlalu berat, kurangi beban atau naikkan kapasitas catu daya dan driver motor.',
        measured: current * 1000,
        limit: MAX_CURRENT_A * 1000,
        unit: 'mA',
      };
    }
    return null;
  },
};
