import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi saat gelap total (light = 0) — 20 kΩ. */
export const LDR_R_DARK = 20000;
/** Resistansi saat terang penuh (light = 1) — 200 Ω. */
export const LDR_R_BRIGHT = 200;

/** Intensitas cahaya 0..1 dari interactiveState (default 0,5). */
export function lightOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.light ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Resistansi LDR mengikuti kurva logaritmik:
 * R = R_dark × (R_bright / R_dark)^light — light 0 → 20 kΩ,
 * light 0,5 → ±2 kΩ, light 1 → 200 Ω.
 */
export function ldrResistance(light: number): number {
  return LDR_R_DARK * Math.pow(LDR_R_BRIGHT / LDR_R_DARK, light);
}

/**
 * LDR: resistor variabel murni dua kaki — resistansi ditentukan
 * intensitas cahaya pada interactiveState.light.
 */
export const ldrElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const r = ldrResistance(lightOf(instance));
    ctx.conductance(ctx.netOf(instance.id, 'A'), ctx.netOf(instance.id, 'B'), 1 / r);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const r = ldrResistance(lightOf(instance));
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    return { main: (va - vb) / r };
  },

  checkDamage: () => null,
};
