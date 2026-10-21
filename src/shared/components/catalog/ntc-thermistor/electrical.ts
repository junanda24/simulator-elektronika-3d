import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi nominal pada 25 °C (Ω) — MF52A1 103F3950, toleransi ±1%. */
export const NTC_R25 = 10000;
/** Konstanta B25/50 (K) dari datasheet MF52A1. */
export const NTC_BETA = 3950;
/** Temperatur referensi 25 °C dalam Kelvin. */
const T_REF_K = 298.15;
/** Rentang suhu gizmo (°C) — rentang ajar; elemen aslinya −55…+125 °C. */
export const TEMP_MIN_C = -10;
export const TEMP_MAX_C = 80;
export const TEMP_DEFAULT_C = 25;

/** Suhu (°C) dari interactiveState, dijepit ke rentang gizmo (default 25). */
export function tempCOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.tempC ?? TEMP_DEFAULT_C);
  if (!Number.isFinite(raw)) return TEMP_DEFAULT_C;
  return Math.min(TEMP_MAX_C, Math.max(TEMP_MIN_C, raw));
}

/**
 * Resistansi NTC dari persamaan Beta datasheet:
 * R(T) = R25 · exp(B · (1/T − 1/298,15)), T dalam Kelvin.
 * Jangkar: 25 °C → 10 kΩ; −10 °C → ±58 kΩ; 80 °C → ±1,27 kΩ.
 */
export function ntcResistance(tempC: number): number {
  const tK = tempC + 273.15;
  return NTC_R25 * Math.exp(NTC_BETA * (1 / tK - 1 / T_REF_K));
}

/**
 * Termistor NTC: resistor variabel murni dua kaki — satu konduktansi
 * yang nilainya ditentukan suhu pada interactiveState.tempC.
 * Tanpa aturan kerusakan: elemen pasif ini tidak punya ambang rusak
 * yang jujur pada tegangan rangkaian belajar (pemanasan-diri diabaikan
 * — simplifikasi nol-daya-pengukuran, dinyatakan di riset komponen).
 */
export const ntcThermistorElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const r = ntcResistance(tempCOf(instance));
    ctx.conductance(ctx.netOf(instance.id, 'A'), ctx.netOf(instance.id, 'B'), 1 / r);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const r = ntcResistance(tempCOf(instance));
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    return { main: (va - vb) / r };
  },

  checkDamage: () => null,
};
