import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi IC antara VCC–GND (Ω) — arus kerja A3144 ±5 mA. */
const R_SUPPLY = 1000;
/**
 * Cabang LED indikator on-board (LED + resistor 680 Ω seri): hanya
 * menghantar saat transistor keluaran aktif, mengikuti state gizmo
 * (pola LED status modul lain). Digabung sebagai konduktansi
 * VCC–GND ekuivalen saat aktif.
 */
const R_LED_BRANCH = 750;
/** Resistansi transistor keluaran jenuh menarik S ke GND (Ω). */
const R_OUT_ON = 25;
/**
 * Tegangan catu minimum A3144 (V) — rating IC 4,5–24 V. Di bawah ini
 * saklar Hall tidak beroperasi: keluaran tidak di-stamp sama sekali.
 */
export const SUPPLY_MIN_V = 4.5;

/** Keadaan magnet dari interactiveState: true = magnet didekatkan. */
export function magnetNearOf(instance: ComponentInstanceState): boolean {
  return instance.interactiveState.magnet === true;
}

/** Keluaran aktif = magnet dekat DAN catu mencapai rating minimum IC. */
function outputActive(instance: ComponentInstanceState, supplyVolts: number): boolean {
  return magnetNearOf(instance) && supplyVolts >= SUPPLY_MIN_V;
}

/**
 * Sensor Hall KY-003: modul bertenaga (konsumsi kecil VCC–GND;
 * cabang LED on-board ikut menghantar saat keluaran aktif).
 * Keluaran S adalah OPEN-COLLECTOR murni:
 * - aktif (magnet dekat, catu ≥ 4,5 V): S ditarik ke GND lewat
 *   ±25 Ω (transistor keluaran jenuh) — terbaca LOW;
 * - tidak aktif: S TIDAK di-stamp sama sekali (impedansi tinggi
 *   murni, persis aslinya) — net S melayang dan hanya tertahan oleh
 *   pull-up pembaca; tanpa INPUT_PULLUP di sketch, model masukan
 *   GPIO engine (bocor 10 MΩ ke GND) membuatnya terbaca LOW terus.
 *   Itulah pelajaran open-collector yang memang diajarkan modul ini.
 * Tanpa aturan kerusakan khusus di rentang rangkaian belajar.
 */
export const ky003Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    const s = ctx.netOf(instance.id, 'S');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    const supply = ctx.prevVoltage(vcc) - ctx.prevVoltage(gnd);
    if (outputActive(instance, supply)) {
      ctx.conductance(s, gnd, 1 / R_OUT_ON);
      ctx.conductance(vcc, gnd, 1 / R_LED_BRANCH);
    }
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const supply = v('VCC') - v('GND');
    return {
      s: outputActive(instance, supply) ? (v('S') - v('GND')) / R_OUT_ON : 0,
    };
  },

  checkDamage: () => null,
};
