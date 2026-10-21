import type { ComponentElectrical } from '../../../types';

/** Konduktansi kawat sekering utuh (Siemens) — setara ±0,01 Ω. */
const FUSE_G = 100;

/**
 * Sekering: kawat nyaris ideal (0,01 Ω) selama arus di bawah rating
 * props.rating (mA). Melebihi rating, kawat meleleh dan sekering
 * dinyatakan rusak (FUSE_BLOWN). Instance yang sudah rusak otomatis
 * dilewati solver, sehingga rangkaian menjadi terbuka — persis perilaku
 * sekering putus di dunia nyata, dan memang itulah yang diinginkan.
 */
export const fuseElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const a = ctx.netOf(instance.id, 'A');
    const b = ctx.netOf(instance.id, 'B');
    ctx.conductance(a, b, FUSE_G);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    return { main: (va - vb) * FUSE_G };
  },

  checkDamage: (instance, result) => {
    const ratingMa = typeof instance.props.rating === 'number' ? instance.props.rating : 500;
    const limitA = ratingMa / 1000;
    const current = Math.abs(result.branchCurrents.main ?? 0);
    if (current > limitA) {
      return {
        ruleId: 'FUSE_BLOWN',
        titleId: 'Sekering Putus — Arus Melebihi Rating',
        explanationId:
          'Arus rangkaian melebihi rating sekering sehingga kawat di dalamnya meleleh dan memutus aliran, melindungi komponen lain dari kerusakan yang lebih parah. Cari dulu penyebab kelebihan arusnya (korsleting atau beban terlalu besar), perbaiki, lalu ganti sekering dengan rating yang sama.',
        measured: current * 1000,
        limit: ratingMa,
        unit: 'mA',
      };
    }
    return null;
  },
};
