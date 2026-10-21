import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/**
 * Resistansi pemanas elemen MQ-2 (Ω) — datasheet Hanwei RH 31 Ω ±3.
 * Di-stamp sebagai beban rel NYATA: ±160 mA pada 5 V yang terhitung
 * oleh aturan arus board, persis perilaku modul asli.
 */
export const MQ2_R_HEATER = 31;
/** Impedansi keluaran AO (Ω). */
const R_OUT = 1000;
/** Pull lemah keluaran saat modul tidak berdaya (Ω) — pola idle LM35/PIR. */
const R_OUT_IDLE = 10000;
/** Impedansi DO saat aktif-RENDAH (Ω). */
const R_DO_LOW = 100;
/** Impedansi DO saat HIGH (pull-up on-board LM393) (Ω). */
const R_DO_HIGH = 10000;
/** Tegangan catu minimum agar keluaran dianggap sah (V) — pola gerbang LM35. */
const SUPPLY_MIN_V = 2.5;
/** Resistor beban RL pada rangkaian uji standar MQ-2 (Ω) — datasheet. */
const R_LOAD = 5000;
/** Ro: resistansi elemen pada 1000 ppm isobutana acuan kurva (Ω, rentang datasheet 3–30 kΩ). */
const R_O = 10000;
/**
 * Jangkar kurva log-log LPG/isobutana (fit dua titik terdokumentasi):
 * Rs/Ro ≈ 2,0 @200 ppm dan ≈ 0,18 @10.000 ppm → Rs/Ro = 52,2 × ppm^(−0,6155).
 */
const CURVE_A = 52.2;
const CURVE_K = -0.6155;
/** Lantai ppm efektif: udara bersih diperlakukan ±20 ppm agar AO ≈ 0,3 V seperti modul asli. */
const PPM_FLOOR = 20;
/** Ambang komparator DO (ppm); trimpot = properti visual, ambang tetap terdokumentasi. */
export const MQ2_DO_THRESHOLD_PPM = 1000;
/** Batas catu (V) — di atas ini pemanas elemen terbakar (datasheet: pemanas 5 V). */
export const MQ2_MAX_SUPPLY_V = 6;

/** Konsentrasi gas gabungan (ppm) dari interactiveState, 0..10.000 (default 0). */
export function ppmOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.ppm ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(10000, Math.max(0, raw));
}

/** Resistansi elemen Rs (Ω) dari kurva log-log terdokumentasi. */
export function mq2Rs(ppm: number): number {
  const eff = Math.max(ppm, PPM_FLOOR);
  return R_O * CURVE_A * Math.pow(eff, CURVE_K);
}

/**
 * Target Thevenin AO. SIMPLIFIKASI TERDOKUMENTASI (riset komponen
 * 2026-10-21 §3): satu kurva ppm gabungan "gas mudah terbakar/asap"
 * untuk semua gas (MQ-2 asli memang tak selektif, tetapi kurva tiap
 * gas berbeda — di sini satu kurva LPG/isobutana), tanpa drift
 * pemanasan awal 24–48 jam, tanpa pengaruh kelembapan/suhu.
 * V(AO) = Vcatu × RL/(Rs + RL): udara bersih ≈ 0,3 V, gas pekat → ±4 V.
 */
function aoTarget(
  instance: ComponentInstanceState,
  supplyVolts: number,
): { volts: number; ohms: number } {
  if (supplyVolts < SUPPLY_MIN_V) return { volts: 0, ohms: R_OUT_IDLE };
  const rs = mq2Rs(ppmOf(instance));
  return { volts: (supplyVolts * R_LOAD) / (rs + R_LOAD), ohms: R_OUT };
}

/** Target Thevenin DO: aktif-RENDAH saat ppm melewati ambang (mayoritas sumber vendor). */
function doTarget(
  instance: ComponentInstanceState,
  vccVolts: number,
  supplyVolts: number,
): { volts: number; ohms: number } {
  if (supplyVolts < SUPPLY_MIN_V) return { volts: 0, ohms: R_OUT_IDLE };
  return ppmOf(instance) > MQ2_DO_THRESHOLD_PPM
    ? { volts: 0, ohms: R_DO_LOW }
    : { volts: vccVolts, ohms: R_DO_HIGH };
}

/**
 * Sensor gas MQ-2: pemanas elemen adalah beban rel nyata 31 Ω;
 * AO mengikuti kurva log-log elemen; DO dari komparator LM393.
 */
export const mq2Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    ctx.conductance(vcc, gnd, 1 / MQ2_R_HEATER);
    const supply = ctx.prevVoltage(vcc) - ctx.prevVoltage(gnd);
    const ao = aoTarget(instance, supply);
    ctx.thevenin(ctx.netOf(instance.id, 'AO'), ao.volts, ao.ohms);
    const dout = doTarget(instance, ctx.prevVoltage(vcc), supply);
    ctx.thevenin(ctx.netOf(instance.id, 'DO'), dout.volts, dout.ohms);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const supply = v('VCC') - v('GND');
    const ao = aoTarget(instance, supply);
    const dout = doTarget(instance, v('VCC'), supply);
    return {
      heater: supply / MQ2_R_HEATER,
      ao: (v('AO') - ao.volts) / ao.ohms,
      do: (v('DO') - dout.volts) / dout.ohms,
    };
  },

  checkDamage: (_instance, result) => {
    const supply = (result.pinVoltages.VCC ?? 0) - (result.pinVoltages.GND ?? 0);
    if (supply > MQ2_MAX_SUPPLY_V) {
      return {
        ruleId: 'MQ2_HEATER_BURNOUT',
        titleId: 'Sensor Gas Rusak — Pemanas Elemen Terbakar',
        explanationId:
          'Pemanas elemen MQ-2 dirancang untuk 5 V; catu di atas 6 V (misalnya langsung dari baterai 9 V) membakar filamen pemanas dan mematikan sensor secara permanen. Beri catu 5 V dari board atau turunkan dulu dengan regulator.',
        measured: supply,
        limit: MQ2_MAX_SUPPLY_V,
        unit: 'V',
      };
    }
    return null;
  },
};
