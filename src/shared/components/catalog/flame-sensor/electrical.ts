import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi modul antara VCC–GND (Ω). */
const R_SUPPLY = 10000;
/** Impedansi keluaran AO (Ω). */
const R_OUT = 1000;
/** Pull lemah keluaran saat modul tidak berdaya (Ω) — pola idle LM35/PIR. */
const R_OUT_IDLE = 10000;
/** Impedansi D0 saat aktif-RENDAH (komparator menarik ke GND) (Ω). */
const R_DO_LOW = 100;
/** Impedansi D0 saat HIGH (pull-up on-board LM393) (Ω). */
const R_DO_HIGH = 10000;
/** Tegangan catu minimum agar keluaran dianggap sah (V) — pola gerbang LM35. */
const SUPPLY_MIN_V = 2.5;
/**
 * Ambang komparator D0 pada skala intensitas api 0..1. Trimpot pada modul
 * asli adalah properti visual; ambangnya TETAP dan terdokumentasi di
 * sini (penyederhanaan yang dinyatakan riset komponen 2026-10-21 §4).
 */
export const FLAME_DO_THRESHOLD = 0.5;
/** Batas catu modul (V) — di atas ini modul rusak. */
export const FLAME_MAX_SUPPLY_V = 6;

/** Intensitas api 0..1 dari interactiveState (default 0 = tidak ada api). */
export function flameOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.flame ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Target Thevenin A0. SIMPLIFIKASI TERDOKUMENTASI (riset §4): yang
 * dimodelkan adalah LEVEL inframerah DC — bukan spektrum api
 * 760–1100 nm, bukan jarak/ sudut deteksi. Arah A0 meniru rangkaian
 * asli KY-026: fototransistor makin menghantar saat kena IR, menarik
 * node A0 ke bawah, jadi V(A0) = Vcatu × (1 − api) — TURUN saat ada
 * api, kebalikan kebanyakan sensor analog. Di bawah catu minimum A0
 * ditahan ke GND lewat pull lemah (tidak ada bacaan hantu).
 */
function aoTarget(
  instance: ComponentInstanceState,
  supplyVolts: number,
): { volts: number; ohms: number } {
  return supplyVolts >= SUPPLY_MIN_V
    ? { volts: supplyVolts * (1 - flameOf(instance)), ohms: R_OUT }
    : { volts: 0, ohms: R_OUT_IDLE };
}

/** Target Thevenin D0: aktif-RENDAH (api melewati ambang → D0 ditarik ke 0 V). */
function doTarget(
  instance: ComponentInstanceState,
  vccVolts: number,
  supplyVolts: number,
): { volts: number; ohms: number } {
  if (supplyVolts < SUPPLY_MIN_V) return { volts: 0, ohms: R_OUT_IDLE };
  return flameOf(instance) > FLAME_DO_THRESHOLD
    ? { volts: 0, ohms: R_DO_LOW }
    : { volts: vccVolts, ohms: R_DO_HIGH };
}

/**
 * Sensor api KY-026: modul bertenaga (konsumsi kecil VCC–GND) dengan
 * A0 analog terbalik dan D0 digital aktif-RENDAH dari komparator LM393.
 */
export const flameSensorElectrical: ComponentElectrical = {
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
    if (supply > FLAME_MAX_SUPPLY_V) {
      return {
        ruleId: 'FLAME_OVERVOLTAGE',
        titleId: 'Sensor Api Rusak — Tegangan Catu Berlebih',
        explanationId:
          'Modul KY-026 dirancang untuk catu 3,3–5 V; tegangan di atas 6 V merusak komparator LM393 dan rangkaian modul secara permanen. Beri catu dari pin 5V atau 3V3 board, jangan langsung dari baterai 9 V.',
        measured: supply,
        limit: FLAME_MAX_SUPPLY_V,
        unit: 'V',
      };
    }
    return null;
  },
};
