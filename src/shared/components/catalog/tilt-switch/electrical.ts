import type { ComponentElectrical } from '../../../types';

/** Konduktansi kontak tertutup (Siemens) — setara resistansi kontak 1 mΩ. */
const CONTACT_G = 1000;
/** Konduktansi saat kontak terbuka (Siemens) — bocor 10 MΩ. */
const OPEN_G = 1 / 10_000_000;

/**
 * Saklar miring: bola logam di dalam tabung menghubungkan kaki A–B
 * hanya saat interactiveState.tilted === true (tabung dimiringkan
 * lewat klik pada model 3D). Tanpa kerusakan.
 */
export const tiltSwitchElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const a = ctx.netOf(instance.id, 'A');
    const b = ctx.netOf(instance.id, 'B');
    const g = instance.interactiveState.tilted === true ? CONTACT_G : OPEN_G;
    ctx.conductance(a, b, g);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    const g = instance.interactiveState.tilted === true ? CONTACT_G : OPEN_G;
    return { main: (va - vb) * g };
  },

  checkDamage: () => null,
};
