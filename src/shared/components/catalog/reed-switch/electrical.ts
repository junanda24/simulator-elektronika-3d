import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Konduktansi kontak tertutup (Siemens) — setara resistansi kontak 0,1 Ω. */
const CLOSED_G = 1 / 0.1;
/** Konduktansi saat kontak terbuka (Siemens) — bocor 10 MΩ. */
const OPEN_G = 1 / 10_000_000;
/** Arus kontak maksimum sebelum bilah lengket permanen (A) — kelas MKA14103. */
const MAX_CONTACT_A = 0.5;

/** Keadaan magnet dari interactiveState: true = magnet didekatkan. */
export function magnetNearOf(instance: ComponentInstanceState): boolean {
  return instance.interactiveState.magnet === true;
}

/**
 * Reed switch: saklar mekanik bermagnet murni — bilah di dalam kapsul
 * kaca menghubungkan kaki A–B (±0,1 Ω) hanya saat
 * interactiveState.magnet === true (klik kapsul pada model 3D).
 * Arus kontak melewati 0,5 A melengketkan bilah (REED_CONTACT_WELD):
 * saklar sinyal kecil ini bukan saklar daya.
 */
export const reedSwitchElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const a = ctx.netOf(instance.id, 'A');
    const b = ctx.netOf(instance.id, 'B');
    ctx.conductance(a, b, magnetNearOf(instance) ? CLOSED_G : OPEN_G);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    const g = magnetNearOf(instance) ? CLOSED_G : OPEN_G;
    return { main: (va - vb) * g };
  },

  checkDamage: (_instance, result) => {
    const current = Math.abs(result.branchCurrents.main ?? 0);
    if (current > MAX_CONTACT_A) {
      return {
        ruleId: 'REED_CONTACT_WELD',
        titleId: 'Reed Switch Rusak — Kontak Lengket (Weld)',
        explanationId:
          'Arus yang melewati kontak reed switch melebihi batas kelasnya (0,5 A) sehingga titik kontak bilah feromagnetik meleleh sesaat dan lengket permanen — saklar tidak bisa membuka lagi. Reed switch hanya untuk sinyal kecil; gunakan relay atau MOSFET untuk mengalihkan beban berarus besar.',
        measured: current * 1000,
        limit: MAX_CONTACT_A * 1000,
        unit: 'mA',
      };
    }
    return null;
  },
};
