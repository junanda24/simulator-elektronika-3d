import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi modul antara VCC–GND (Ω). */
const R_SUPPLY = 10000;
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
/** Resistansi papan deteksi saat kering (Ω) — titik jangkar riset. */
export const RAIN_R_PLATE_DRY = 1_000_000;
/** Resistansi papan deteksi saat terendam penuh (Ω) — titik jangkar riset. */
export const RAIN_R_PLATE_WET = 5_000;
/** Resistor pembagi tetap di modul kontrol (Ω). */
const R_DIVIDER = 10_000;
/** Ambang komparator DO pada skala kebasahan 0..1 (trimpot = properti visual, ambang tetap). */
export const RAIN_DO_THRESHOLD = 0.5;
/** Batas catu modul (V) — di atas ini modul rusak (riset §8). */
export const RAIN_MAX_SUPPLY_V = 5.5;

/** Kebasahan 0..1 dari interactiveState (default 0 = kering). */
export function wetnessOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.wetness ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Resistansi papan deteksi mengikuti kurva logaritmik dua titik jangkar
 * (pola LDR): kering 1 MΩ → terendam 5 kΩ.
 */
export function rainPlateResistance(wetness: number): number {
  return RAIN_R_PLATE_DRY * Math.pow(RAIN_R_PLATE_WET / RAIN_R_PLATE_DRY, wetness);
}

/**
 * Target Thevenin AO. SIMPLIFIKASI TERDOKUMENTASI (riset komponen
 * 2026-10-21 §8): satu nilai kebasahan tunggal untuk seluruh papan
 * (tanpa distribusi tetes/spasial), resistansi papan didekati dua
 * titik jangkar kering–basah, korosi papan akibat DC tidak
 * disimulasikan. Papan adalah kaki bawah pembagi terhadap resistor
 * tetap modul, jadi V(AO) = Vcatu × R_papan/(R_papan + 10 kΩ):
 * kering ≈ Vcatu, terendam ≈ 0,33 × Vcatu — AO TURUN saat basah.
 */
function aoTarget(
  instance: ComponentInstanceState,
  supplyVolts: number,
): { volts: number; ohms: number } {
  if (supplyVolts < SUPPLY_MIN_V) return { volts: 0, ohms: R_OUT_IDLE };
  const rPlate = rainPlateResistance(wetnessOf(instance));
  return { volts: (supplyVolts * rPlate) / (rPlate + R_DIVIDER), ohms: R_OUT };
}

/** Target Thevenin DO: aktif-RENDAH saat kebasahan melewati ambang. */
function doTarget(
  instance: ComponentInstanceState,
  vccVolts: number,
  supplyVolts: number,
): { volts: number; ohms: number } {
  if (supplyVolts < SUPPLY_MIN_V) return { volts: 0, ohms: R_OUT_IDLE };
  return wetnessOf(instance) > RAIN_DO_THRESHOLD
    ? { volts: 0, ohms: R_DO_LOW }
    : { volts: vccVolts, ohms: R_DO_HIGH };
}

/**
 * Sensor hujan MH-RD: modul komparator bertenaga dengan AO dari
 * pembagi papan deteksi dan DO aktif-RENDAH.
 */
export const rainSensorElectrical: ComponentElectrical = {
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
    if (supply > RAIN_MAX_SUPPLY_V) {
      return {
        ruleId: 'RAIN_OVERVOLTAGE',
        titleId: 'Sensor Hujan Rusak — Tegangan Catu Berlebih',
        explanationId:
          'Modul kontrol MH-RD dirancang untuk catu 3,3–5 V; tegangan di atas 5,5 V merusak komparator LM393 dan rangkaian modul secara permanen. Beri catu dari pin 5V atau 3V3 board, jangan langsung dari baterai 9 V.',
        measured: supply,
        limit: RAIN_MAX_SUPPLY_V,
        unit: 'V',
      };
    }
    return null;
  },
};
