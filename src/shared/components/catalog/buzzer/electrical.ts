import type { ComponentElectrical } from '../../../types';

/** Resistansi kerja buzzer aktif saat berbunyi (Ω) — arus khas ±33 mA di 5 V. */
const R_ACTIVE = 150;
/** Resistansi saat mati / polaritas terbalik (Ω). */
const R_OFF = 10_000_000;
/** Tegangan maju minimum agar osilator internal buzzer bekerja (V). */
const THRESHOLD_V = 0.5;

function resistanceOf(vPlus: number, vMinus: number): number {
  return vPlus - vMinus > THRESHOLD_V ? R_ACTIVE : R_OFF;
}

/**
 * Buzzer aktif 5 V peka polaritas: rangkaian osilator internalnya hanya
 * bekerja bila PLUS lebih positif dari MINUS (ambang 0,5 V dibaca dari
 * iterasi PWL sebelumnya). Polaritas terbalik = buzzer diam (bocor 10 MΩ).
 */
export const buzzerElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const plus = ctx.netOf(instance.id, 'PLUS');
    const minus = ctx.netOf(instance.id, 'MINUS');
    const r = resistanceOf(ctx.prevVoltage(plus), ctx.prevVoltage(minus));
    ctx.conductance(plus, minus, 1 / r);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const va = voltages.get(netOf(instance.id, 'PLUS')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'MINUS')) ?? 0;
    return { main: (va - vb) / resistanceOf(va, vb) };
  },

  checkDamage: () => null,
};
