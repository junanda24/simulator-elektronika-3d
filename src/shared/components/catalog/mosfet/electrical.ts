import type { ComponentElectrical } from '../../../types';

/**
 * Model DC tunak IRLZ44N (riset komponen 2026-10-21 §2 — SIMPLIFIKASI
 * TERDOKUMENTASI: hanya perilaku DC tunak; tanpa kapasitansi gerbang,
 * tanpa dinamika switching, tanpa model termal transien):
 * - Gerbang tidak menarik arus DC: stamp kebocoran Gate–Source 10 MΩ.
 * - Saluran D–S = resistor yang dikendalikan Vgs: mati (Vgs ≤ Vth) →
 *   10 MΩ; transisi Vth…4,5 V diinterpolasi logaritmik; menyala penuh
 *   (Vgs ≥ 4,5 V) → RDS(on) 0,03 Ω. Nilai 0,03 Ω adalah nilai model
 *   pada penggerak gerbang logika 5 V (datasheet: maks 22 mΩ pada
 *   Vgs 10 V; pada 5 V resistansi saluran memang lebih tinggi).
 *   Pada catu 3,3 V transisi lebih landai — konsisten dengan kurva
 *   transfer asli level-logic.
 * - PWM dari sketch terbaca sebagai tegangan rata-rata oleh solver,
 *   sama seperti perlakuan servo/motor di katalog.
 */
/** Tegangan ambang gerbang model (V) — titik tengah rentang datasheet 1,0–2,0 V. */
export const MOSFET_VTH = 1.5;
/** Vgs saat saluran dianggap terbuka penuh (V). */
export const MOSFET_VGS_FULL = 4.5;
/** RDS(on) model saat terbuka penuh (Ω). */
export const MOSFET_RDS_ON = 0.03;
/** Resistansi saluran saat mati (Ω). */
const R_DS_OFF = 10_000_000;
/** Kebocoran gerbang Gate–Source (Ω) — gerbang ideal tak berarus DC. */
const R_GS = 10_000_000;
/** Batas tegangan gerbang absolut datasheet (V) — oksida gerbang jebol. */
export const MOSFET_VGS_MAX = 16;
/** Batas disipasi sesaat tanpa heatsink (W) — ambang instan terdokumentasi. */
export const MOSFET_MAX_DISSIPATION_W = 2;

/** Resistansi saluran D–S (Ω) untuk Vgs tertentu, interpolasi log pada pita transisi. */
export function mosfetRds(vgs: number): number {
  if (vgs <= MOSFET_VTH) return R_DS_OFF;
  if (vgs >= MOSFET_VGS_FULL) return MOSFET_RDS_ON;
  const t = (vgs - MOSFET_VTH) / (MOSFET_VGS_FULL - MOSFET_VTH);
  const logR =
    Math.log10(R_DS_OFF) + t * (Math.log10(MOSFET_RDS_ON) - Math.log10(R_DS_OFF));
  return Math.pow(10, logR);
}

export const mosfetElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const g = ctx.netOf(instance.id, 'G');
    const d = ctx.netOf(instance.id, 'D');
    const s = ctx.netOf(instance.id, 'S');
    const vgsPrev = ctx.prevVoltage(g) - ctx.prevVoltage(s);
    ctx.conductance(g, s, 1 / R_GS);
    ctx.conductance(d, s, 1 / mosfetRds(vgsPrev));
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const vgs = v('G') - v('S');
    return {
      id: (v('D') - v('S')) / mosfetRds(vgs),
      ig: (v('G') - v('S')) / R_GS,
    };
  },

  checkDamage: (_instance, result) => {
    const vgs = (result.pinVoltages.G ?? 0) - (result.pinVoltages.S ?? 0);
    if (Math.abs(vgs) > MOSFET_VGS_MAX) {
      return {
        ruleId: 'MOSFET_GATE_OXIDE',
        titleId: 'MOSFET Rusak — Oksida Gerbang Jebol',
        explanationId:
          'Tegangan Gate–Source melebihi batas absolut IRLZ44N (±16 V) menembus lapisan oksida gerbang yang sangat tipis dan merusak MOSFET secara permanen. Gerbang MOSFET cukup digerakkan tegangan logika 3,3–5 V; jangan pernah menyambungkan gerbang ke catu 9 V/12 V tanpa pembagi tegangan atau driver yang sesuai.',
        measured: Math.abs(vgs),
        limit: MOSFET_VGS_MAX,
        unit: 'V',
      };
    }
    const id = result.branchCurrents.id ?? 0;
    const vds = (result.pinVoltages.D ?? 0) - (result.pinVoltages.S ?? 0);
    const dissipation = Math.abs(vds * id);
    if (dissipation > MOSFET_MAX_DISSIPATION_W) {
      return {
        ruleId: 'MOSFET_OVERHEAT',
        titleId: 'MOSFET Terbakar — Disipasi Berlebih',
        explanationId:
          'Disipasi daya pada saluran Drain–Source (Vds × Id) melebihi ±2 W tanpa heatsink — biasanya karena MOSFET dibiarkan setengah terbuka di daerah transisi (Vgs terlalu rendah sehingga RDS(on) masih besar) sambil memikul arus beban besar. Pastikan gerbang digerakkan penuh (5 V untuk logika) atau pasang heatsink pada tab TO-220.',
        measured: dissipation,
        limit: MOSFET_MAX_DISSIPATION_W,
        unit: 'W',
      };
    }
    return null;
  },
};
