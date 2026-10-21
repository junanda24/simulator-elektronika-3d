import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi modul antara VCC–GND (Ω). */
const R_SUPPLY = 10000;
/** Impedansi keluaran AO (Ω). */
const R_OUT = 1000;

/** Kelembaban 0..1 dari interactiveState (default 0,5; 0 = kering, 1 = basah). */
export function moistureOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.moisture ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Sensor kelembaban tanah: modul bertenaga (konsumsi kecil VCC–GND)
 * dengan keluaran analog Thevenin berbanding terbalik —
 * V(AO) = V(VCC) × (1 − moisture) lewat 1 kΩ.
 */
export const soilMoistureElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    ctx.thevenin(
      ctx.netOf(instance.id, 'AO'),
      ctx.prevVoltage(vcc) * (1 - moistureOf(instance)),
      R_OUT,
    );
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const target = v('VCC') * (1 - moistureOf(instance));
    return { ao: (v('AO') - target) / R_OUT };
  },

  checkDamage: () => null,
};
