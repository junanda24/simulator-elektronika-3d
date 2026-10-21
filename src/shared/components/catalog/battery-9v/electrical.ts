import type { ComponentElectrical } from '../../../types';

/** Tegangan nominal yang dijaga tetap (simplifikasi terdokumentasi). */
const V_NOMINAL = 9;
/** Resistansi internal khas alkalin 6LR61 (Ω, nilai tipikal kelas). */
const R_INTERNAL = 1.5;
/** Batas arus keluar aman sebelum baterai dianggap korslet/rusak (A). */
const I_SHORT_A = 1;

/**
 * Baterai 9V sebagai sumber tegangan MELAYANG antar dua terminalnya —
 * pola Norton yang sama dengan regulator/basis-emitor: konduktansi
 * 1/1,5 Ω antara net PLUS dan MINUS ditambah sumber arus 9/1,5 = 6 A
 * dari MINUS menuju PLUS. Sengaja BUKAN `ctx.thevenin` (terikat
 * ground global): MINUS baterai bebas dihubungkan ke net mana pun.
 * Tegangan dijaga tetap 9,0 V dan kapasitas tak terbatas —
 * simplifikasi yang dinyatakan di kartu komponen.
 *
 * Arus cabang 'main' = arus yang diserahkan baterai ke rangkaian
 * luar (positif saat mengosong): (9 − (V+ − V−)) / 1,5 Ω. Terminal
 * yang terhubung langsung membuat V+−V− = 0 sehingga main = 6 A —
 * tertangkap aturan BATTERY_SHORT di bawah. Aturan ini hidup di
 * checkDamage komponen sendiri (bukan aturan board) karena aturan
 * board POWER_SHORT_CIRCUIT hanya membaca pin catu board dan tidak
 * pernah melihat terminal baterai; ambangnya sesaat mengikuti pola
 * ambang instan terdokumentasi proyek (bdk. REGULATOR_OVERHEAT).
 */
export const battery9vElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const plus = ctx.netOf(instance.id, 'PLUS');
    const minus = ctx.netOf(instance.id, 'MINUS');
    ctx.conductance(plus, minus, 1 / R_INTERNAL);
    ctx.current(minus, plus, V_NOMINAL / R_INTERNAL);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const vp = voltages.get(netOf(instance.id, 'PLUS')) ?? 0;
    const vm = voltages.get(netOf(instance.id, 'MINUS')) ?? 0;
    return { main: (V_NOMINAL - (vp - vm)) / R_INTERNAL };
  },

  checkDamage: (_instance, result) => {
    const main = result.branchCurrents.main ?? 0;
    if (main > I_SHORT_A) {
      return {
        ruleId: 'BATTERY_SHORT',
        titleId: 'Baterai Korslet — Arus Berlebih',
        explanationId:
          'Arus keluar baterai melewati 1 A — penyebab tersering adalah kabel yang menghubungkan terminal + langsung ke terminal − tanpa beban. Baterai 9V punya resistansi internal kecil (±1,5 Ω) sehingga korsleting penuh mengalirkan ±6 A: baterai cepat panas, bocor, dan rusak. Selalu beri beban atau regulator di antara kedua terminalnya.',
        measured: main * 1000,
        limit: I_SHORT_A * 1000,
        unit: 'mA',
      };
    }
    return null;
  },
};
