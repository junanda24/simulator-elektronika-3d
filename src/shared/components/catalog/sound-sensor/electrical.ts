import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/**
 * Resistansi konsumsi modul (Ω) — setara arus kerja terdokumentasi
 * 4–5 mA pada 5 V (riset komponen 2026-10-21 §12).
 */
const R_SUPPLY = 1000;
/** Impedansi keluaran AO (Ω). */
const R_OUT = 1000;
/** Pull lemah keluaran saat modul tidak berdaya / DO LOW (Ω) — pola idle LM35/PIR. */
const R_OUT_IDLE = 10000;
/** Impedansi DO saat HIGH (Ω). */
const R_DO_HIGH = 100;
/** Tegangan catu minimum agar keluaran dianggap sah (V) — pola gerbang LM35. */
const SUPPLY_MIN_V = 2.5;
/**
 * Ambang komparator DO pada skala kebisingan 0..1. Trimpot pada modul
 * asli adalah properti visual; ambangnya TETAP dan terdokumentasi.
 */
export const SOUND_DO_THRESHOLD = 0.6;
/** Batas catu modul (V) — di atas ini modul rusak (riset §12). */
export const SOUND_MAX_SUPPLY_V = 6;

/** Tingkat kebisingan 0..1 dari interactiveState (default 0 = hening). */
export function noiseOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.noise ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Target Thevenin A0. SIMPLIFIKASI TEGAS (riset komponen 2026-10-21
 * §12): yang dimodelkan HANYA envelope tingkat kebisingan sebagai
 * level DC — V(A0) = Vcatu × kebisingan. TIDAK ada gelombang audio,
 * tidak ada respons frekuensi mikrofon, dan A0 tidak berayun di
 * sekitar VCC/2 seperti modul asli yang keluarannya sinyal AC.
 */
function aoTarget(
  instance: ComponentInstanceState,
  supplyVolts: number,
): { volts: number; ohms: number } {
  return supplyVolts >= SUPPLY_MIN_V
    ? { volts: supplyVolts * noiseOf(instance), ohms: R_OUT }
    : { volts: 0, ohms: R_OUT_IDLE };
}

/**
 * Target Thevenin D0: HIGH saat kebisingan melewati ambang.
 * Polaritas antar-klon KY-038 tidak sepakat di sumber (sebagian
 * aktif-RENDAH gaya LM393) — diadopsi HIGH = suara terdeteksi
 * (CircuitDigest) dan perbedaan klon ini dinyatakan di kartu komponen.
 */
function doTarget(
  instance: ComponentInstanceState,
  vccVolts: number,
  supplyVolts: number,
): { volts: number; ohms: number } {
  if (supplyVolts < SUPPLY_MIN_V) return { volts: 0, ohms: R_OUT_IDLE };
  return noiseOf(instance) > SOUND_DO_THRESHOLD
    ? { volts: vccVolts, ohms: R_DO_HIGH }
    : { volts: 0, ohms: R_OUT_IDLE };
}

/**
 * Sensor suara KY-038: modul bertenaga dengan A0 envelope kebisingan
 * dan D0 komparator aktif-HIGH.
 */
export const soundSensorElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
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
      ao: (v('AO') - ao.volts) / ao.ohms,
      do: (v('DO') - dout.volts) / dout.ohms,
    };
  },

  checkDamage: (_instance, result) => {
    const supply = (result.pinVoltages.VCC ?? 0) - (result.pinVoltages.GND ?? 0);
    if (supply > SOUND_MAX_SUPPLY_V) {
      return {
        ruleId: 'SOUND_OVERVOLTAGE',
        titleId: 'Sensor Suara Rusak — Tegangan Catu Berlebih',
        explanationId:
          'Modul KY-038 dirancang untuk catu 3,3–5 V; tegangan di atas 6 V merusak komparator LM393 dan rangkaian mikrofon secara permanen. Beri catu dari pin 5V atau 3V3 board, jangan langsung dari baterai 9 V.',
        measured: supply,
        limit: SOUND_MAX_SUPPLY_V,
        unit: 'V',
      };
    }
    return null;
  },
};
