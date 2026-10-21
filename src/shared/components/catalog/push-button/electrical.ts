import type { ComponentElectrical } from '../../../types';

/** Konduktansi kontak tertutup (Siemens) — setara resistansi kontak 1 mΩ. */
const CONTACT_G = 1000;

/**
 * Push button tactile 4 kaki (SIMULATION_RULES.md §3 butir 1):
 * - Pasangan se-sisi A1–A2 dan B1–B2 terhubung permanen (jembatan internal).
 * - Jembatan A1–B1 hanya tertutup saat interactiveState.pressed === true.
 * Tombol bersifat sesaat murni di level elektrik; logika latch ditangani
 * lapisan interaksi 3D (Shift+klik) yang mempertahankan state pressed.
 */
export const pushButtonElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const a1 = ctx.netOf(instance.id, 'A1');
    const a2 = ctx.netOf(instance.id, 'A2');
    const b1 = ctx.netOf(instance.id, 'B1');
    const b2 = ctx.netOf(instance.id, 'B2');
    ctx.conductance(a1, a2, CONTACT_G);
    ctx.conductance(b1, b2, CONTACT_G);
    if (instance.interactiveState.pressed === true) {
      ctx.conductance(a1, b1, CONTACT_G);
    }
  },

  computeCurrents: () => ({}),

  checkDamage: () => null,
};
