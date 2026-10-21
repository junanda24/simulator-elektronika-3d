import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi sensor antara VCC–GND (Ω). */
const R_SUPPLY = 10000;
/** Impedansi keluaran OUT (Ω). */
const R_OUT = 50;
/** Pull-down lemah OUT saat sensor tidak berdaya (Ω) — pola idle PIR. */
const R_OUT_IDLE = 10000;
/**
 * Tegangan catu minimum agar keluaran suhu dianggap sah (V). Di bawah
 * ini tahap keluaran LM35 mati: OUT tidak boleh mengambang membawa
 * tegangan suhu hantu hanya karena pin OUT terhubung ke suatu net.
 */
const SUPPLY_MIN_V = 2.5;
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
 * Target Thevenin OUT mengikuti gerbang daya (pola yang sama dengan
 * PIR & sensor bertenaga lain di katalog): berdaya (VCC−GND ≥ 2,5 V) →
 * tegangan suhu lewat 50 Ω; tidak berdaya → OUT ditahan ke GND lewat
 * pull-down lemah 10 kΩ, BUKAN didorong ke tegangan suhu. Tanpa gerbang
 * ini OUT mengeluarkan 0,25 V (25 °C) bahkan saat pin VCC tidak
 * terhubung sama sekali — pembacaan suhu hantu (audit P4 F2).
 */
function outTarget(
  instance: ComponentInstanceState,
  supplyVolts: number,
): { volts: number; ohms: number } {
  return supplyVolts >= SUPPLY_MIN_V
    ? { volts: tempCOf(instance) * VOLTS_PER_C, ohms: R_OUT }
    : { volts: 0, ohms: R_OUT_IDLE };
}

/**
 * LM35: sensor bertenaga (konsumsi kecil VCC–GND) dengan keluaran
 * analog Thevenin — V(OUT) = suhu × 10 mV lewat 50 Ω, hanya selama
 * sensor benar-benar berdaya (lihat outTarget).
 */
export const lm35Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    const supply = ctx.prevVoltage(vcc) - ctx.prevVoltage(gnd);
    const target = outTarget(instance, supply);
    ctx.thevenin(ctx.netOf(instance.id, 'OUT'), target.volts, target.ohms);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const target = outTarget(instance, v('VCC') - v('GND'));
    return { out: (v('OUT') - target.volts) / target.ohms };
  },

  checkDamage: () => null,
};
