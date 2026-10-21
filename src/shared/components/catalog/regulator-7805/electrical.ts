import type { ComponentElectrical } from '../../../types';

/** Tegangan keluaran teregulasi L7805 (V). */
const VOUT_TARGET = 5;
/** Dropout khas @1 A — di bawah Vin − 2 V keluaran mengikuti masukan. */
const DROPOUT_V = 2;
/**
 * Resistansi Norton stamp keluaran (Ω). Engine `ctx.thevenin` terikat
 * ground global, jadi regulator TIDAK boleh memakainya: keluaran harus
 * diregulasi relatif terhadap pin GND komponen itu sendiri, yang bisa
 * saja tidak menancap di net 'GND'. Pola Norton melayang antar-net
 * (konduktansi + sumber arus dari tegangan iterasi sebelumnya) adalah
 * pola yang sama dengan sambungan B–E transistor.
 */
const R_NORTON = 0.5;
/** Arus diam (quiescent) IN → pin GND (datasheet Iq 5–8 mA). */
const IQ_A = 0.006;
/**
 * Gerbang Iq: arus diam hanya mengalir bila regulator benar-benar
 * diberi masukan (Vin relatif pin GND di atas nilai ini). Tanpa gerbang
 * ini, stamp arus tetap 6 mA pada pin IN yang belum tersambung akan
 * menarik net IN ke tegangan absurd (−6 mA / gmin 1e-9 S = −6.000.000 V)
 * dan memicu REGULATOR_REVERSED palsu pada komponen yang tidak berdaya
 * (terbukti probe audit ekspansi 2026-10-21). Regulator asli pada
 * Vin ≈ 0 memang tidak menarik arus diam yang berarti.
 */
const IQ_GATE_V = 1;
/** Tegangan masukan absolut maksimum L7805 (V). */
const VIN_MAX = 35;
/** Batas disipasi tanpa heatsink (W) — ambang sesaat, bukan model termal. */
const P_MAX_W = 2;

/** Target keluaran relatif pin GND dari tegangan masukan relatif. */
function vTargetOf(vinRel: number): number {
  return Math.max(0, Math.min(VOUT_TARGET, vinRel - DROPOUT_V));
}

/**
 * L7805 sebagai sumber tegangan melayang: antara net OUT dan net
 * pin-GND komponen distamp ekuivalen Norton (g = 1/0,5 Ω + arus
 * Vtarget/0,5 Ω dari pin-GND menuju OUT), dengan Vtarget =
 * min(5, Vin−2) dari `prevVoltage` relatif pin-GND. Arus diam Iq
 * distamp sebagai arus tetap IN → pin-GND.
 */
export const regulator7805Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const netIn = ctx.netOf(instance.id, 'IN');
    const netGnd = ctx.netOf(instance.id, 'GND');
    const netOut = ctx.netOf(instance.id, 'OUT');
    const vinPrev = ctx.prevVoltage(netIn) - ctx.prevVoltage(netGnd);
    const vTarget = vTargetOf(vinPrev);
    ctx.conductance(netOut, netGnd, 1 / R_NORTON);
    if (vTarget > 0) ctx.current(netGnd, netOut, vTarget / R_NORTON);
    if (vinPrev > IQ_GATE_V) ctx.current(netIn, netGnd, IQ_A);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const vGnd = voltages.get(netOf(instance.id, 'GND')) ?? 0;
    const vin = (voltages.get(netOf(instance.id, 'IN')) ?? 0) - vGnd;
    const vout = (voltages.get(netOf(instance.id, 'OUT')) ?? 0) - vGnd;
    // Arus yang diserahkan pin OUT ke beban luar: selisih tegangan
    // target vs aktual dibagi resistansi Norton stamp di atas.
    // Arus masuk = arus keluar + Iq — dengan gerbang Iq yang sama
    // seperti stamp, agar tampilan inspektor konsisten (regulator tak
    // berdaya tidak melaporkan arus masuk hantu 6 mA).
    const out = (vTargetOf(vin) - vout) / R_NORTON;
    return { in: out + (vin > IQ_GATE_V ? IQ_A : 0), out };
  },

  checkDamage: (_instance, result) => {
    const vGnd = result.pinVoltages.GND ?? 0;
    const vin = (result.pinVoltages.IN ?? 0) - vGnd;
    const vout = (result.pinVoltages.OUT ?? 0) - vGnd;
    if (vin > VIN_MAX) {
      return {
        ruleId: 'REGULATOR_INPUT_OVERVOLTAGE',
        titleId: 'Regulator Terbakar — Tegangan Masukan Berlebih',
        explanationId:
          'L7805 hanya menerima tegangan masukan sampai 35 V. Di atas itu, transistor pass di dalamnya tembus dan regulator rusak permanen — keluaran bisa ikut melonjak dan membahayakan rangkaian 5 V. Periksa tegangan sumber sebelum masuk pin INPUT.',
        measured: vin,
        limit: VIN_MAX,
        unit: 'V',
      };
    }
    if (vin < -1) {
      return {
        ruleId: 'REGULATOR_REVERSED',
        titleId: 'Regulator Rusak — Polaritas Terbalik',
        explanationId:
          'Pin INPUT menerima tegangan lebih rendah dari pin GND — polaritas catu terbalik. L7805 tidak punya proteksi polaritas: arus mengalir lewat jalur parasit di dalam chip dan merusakkannya. Ingat urutan kaki dari muka depan: 1 INPUT, 2 GND, 3 OUTPUT, dan tab logam adalah GND.',
        measured: -vin,
        limit: 1,
        unit: 'V',
      };
    }
    const iout = result.branchCurrents.out ?? 0;
    const dissipation = (vin - vout) * iout;
    if (iout > 0 && dissipation > P_MAX_W) {
      return {
        ruleId: 'REGULATOR_OVERHEAT',
        titleId: 'Regulator Kepanasan — Disipasi Berlebih',
        explanationId:
          'Regulator linear membuang seluruh selisih (Vin − Vout) × Iout sebagai panas. Tanpa pendingin, paket TO-220 hanya sanggup membuang sekitar 2 W; di atas itu suhu junction melewati batas dan regulator mati. Turunkan tegangan masukan, kurangi arus beban, atau pasang heatsink.',
        measured: dissipation,
        limit: P_MAX_W,
        unit: 'W',
      };
    }
    return null;
  },
};
