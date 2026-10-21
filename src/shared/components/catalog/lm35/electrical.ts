import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi sensor antara VCC–GND (Ω). */
const R_SUPPLY = 10000;
/** Impedansi keluaran OUT (Ω). */
const R_OUT = 50;
/** Skala LM35: 10 mV per °C. */
const VOLTS_PER_C = 0.01;
export const TEMP_MIN_C = 0;
export const TEMP_MAX_C = 100;
export const TEMP_DEFAULT_C = 25;

/** Suhu (°C) dari interactiveState, dijepit ke rentang 0..100 (default 25). */
export function tempCOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.tempC ?? TEMP_DEFAULT_C);
  if (!Number.isFinite(raw)) return TEMP_DEFAULT_C;
  return Math.min(TEMP_MAX_C, Math.max(TEMP_MIN_C, raw));
}

/**
 * LM35: sensor bertenaga (konsumsi kecil VCC–GND) dengan keluaran
 * analog Thevenin — V(OUT) = suhu × 10 mV lewat 50 Ω.
 */
export const lm35Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    ctx.conductance(ctx.netOf(instance.id, 'VCC'), ctx.netOf(instance.id, 'GND'), 1 / R_SUPPLY);
    ctx.thevenin(ctx.netOf(instance.id, 'OUT'), tempCOf(instance) * VOLTS_PER_C, R_OUT);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const vOut = voltages.get(netOf(instance.id, 'OUT')) ?? 0;
    return { out: (vOut - tempCOf(instance) * VOLTS_PER_C) / R_OUT };
  },

  checkDamage: () => null,
};
