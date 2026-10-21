import type { ComponentElectrical } from '../../../types';

/** Tegangan basis–emitor saat transistor menghantar (V). */
const VBE_ON = 0.7;
/** Resistansi dinamis sambungan basis–emitor saat ON (Ω). */
const R_BE_ON = 25;
/** Resistansi bocor basis–emitor saat OFF (Ω). */
const R_BE_OFF = 1_000_000;
/** Tegangan kolektor–emitor di bawah ini transistor masuk saturasi (V). */
const VCE_SAT = 0.25;
/** Arus kolektor maksimum 2N2222 sebelum rusak (A). */
const MAX_IC_A = 0.8;
const DEFAULT_BETA = 100;

/** Faktor penguatan arus (β) valid dari props; fallback 100. */
function betaOf(props: Record<string, unknown>): number {
  const b = props.beta;
  return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : DEFAULT_BETA;
}

/** Arus basis dari tegangan basis–emitor (model dioda PWL sambungan B–E). */
function ibFromVbe(vbe: number): number {
  return vbe > VBE_ON ? (vbe - VBE_ON) / R_BE_ON : 0;
}

/**
 * Arus kolektor model saklar: Ic = β × Ib, diklem oleh faktor saturasi
 * linier Vce/0,25 saat Vce < 0,25 V (arus dibatasi rangkaian luar).
 */
function icFromState(vbe: number, vce: number, beta: number): number {
  let ic = beta * ibFromVbe(vbe);
  if (vce < VCE_SAT) ic *= Math.max(0, vce) / VCE_SAT;
  return ic;
}

/**
 * Transistor NPN sebagai saklar terkendali arus (model pembelajaran):
 * - Sambungan B–E seperti dioda PWL: ON = Norton 0,7 V + 25 Ω, OFF = 1 MΩ.
 * - Kolektor = sumber arus dependen Ic dari keadaan iterasi PWL sebelumnya,
 *   arah konvensional: masuk kolektor, keluar emitor (arus C→E di dalam
 *   komponen, distamp ctx.current(netC, netE, Ic)).
 */
export const transistorElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const beta = betaOf(instance.props);
    const e = ctx.netOf(instance.id, 'E');
    const b = ctx.netOf(instance.id, 'B');
    const c = ctx.netOf(instance.id, 'C');
    const vbePrev = ctx.prevVoltage(b) - ctx.prevVoltage(e);
    const vcePrev = ctx.prevVoltage(c) - ctx.prevVoltage(e);

    if (vbePrev >= VBE_ON) {
      ctx.conductance(b, e, 1 / R_BE_ON);
      ctx.current(e, b, VBE_ON / R_BE_ON);
    } else {
      ctx.conductance(b, e, 1 / R_BE_OFF);
    }

    const ic = icFromState(vbePrev, vcePrev, beta);
    if (ic !== 0) ctx.current(c, e, ic);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const beta = betaOf(instance.props);
    const ve = voltages.get(netOf(instance.id, 'E')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    const vc = voltages.get(netOf(instance.id, 'C')) ?? 0;
    const vbe = vb - ve;
    return { ib: ibFromVbe(vbe), ic: icFromState(vbe, vc - ve, beta) };
  },

  checkDamage: (_instance, result) => {
    const ic = result.branchCurrents.ic ?? 0;
    if (ic > MAX_IC_A) {
      return {
        ruleId: 'TRANSISTOR_OVERCURRENT',
        titleId: 'Transistor Terbakar — Arus Kolektor Berlebih',
        explanationId:
          'Arus kolektor melebihi batas maksimum 2N2222 (800 mA) membuat transistor kepanasan dan rusak permanen. Perkecil arus basis dengan resistor basis yang lebih besar, atau pilih transistor dengan rating arus yang lebih tinggi.',
        measured: ic * 1000,
        limit: MAX_IC_A * 1000,
        unit: 'mA',
      };
    }
    return null;
  },
};
