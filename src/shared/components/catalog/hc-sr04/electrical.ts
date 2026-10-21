import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/**
 * Elektrik HC-SR04 — hanya jejak DC yang JUJUR (bab khusus riset
 * komponen baru 2026-10-21 §11.4): perilaku ukurnya (lebar pulsa ECHO)
 * adalah perilaku WAKTU, bukan DC — ia hidup di model perangkat sesi
 * (simSession) + pulseIn analitik, BUKAN di solver. Yang di-stamp di
 * sini: beban catu, impedansi masukan TRIG, dan keluaran ECHO sebagai
 * Thevenin yang levelnya mengikuti isi jadwal sesi lewat flag
 * interactiveState.echoOn (sesi yang memasangnya per solve).
 */

/** Rentang ukur datasheet (cm). */
export const DIST_MIN_CM = 2;
export const DIST_MAX_CM = 400;
/** Jarak rintangan bawaan sebelum gizmo disentuh (cm). */
export const DIST_DEFAULT_CM = 100;
/** Rumus datasheet: lebar ECHO (µs) = jarak (cm) × 58. */
export const US_PER_CM = 58;
/** Jeda tepi-turun TRIG → ECHO naik: burst 8 siklus 40 kHz (200 µs) + proses internal. */
export const ECHO_DELAY_US = 250;
/** Lebar pulsa TRIG minimum yang diakui modul asli (µs, datasheet). */
export const TRIG_MIN_US = 10;
/** Siklus ukur minimum antar pemicu (µs; anjuran datasheet >60 ms). */
export const CYCLE_MIN_US = 60_000;
/** Gerbang catu: modul klasik hanya merespons pada VCC ≥ tegangan ini (V). */
export const VCC_MIN_V = 4.5;

/**
 * Resistansi ekuivalen beban catu (Ω): arus kerja datasheet ±15 mA pada
 * 5 V → 5 / 0,015 ≈ 333 Ω, di-stamp tetap antara VCC–GND (penyederha-
 * naan terdokumentasi: arus diam asli <2 mA tidak dibedakan).
 */
const R_SUPPLY = 333;
/** Impedansi masukan pin TRIG (Ω ke GND, ekuivalen masukan TTL modul). */
const R_TRIG_IN = 10_000;
/** Impedansi keluaran ECHO (Ω) — keluaran push-pull MCU modul. */
const R_ECHO_OUT = 100;
/** Tegangan catu maksimum sebelum modul rusak (V; di atas 5,5 V abs-max clone umum). */
const VCC_DAMAGE_V = 6;

/** Jarak rintangan (cm) dari interactiveState, dijepit ke rentang datasheet. */
export function distanceCmOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.distanceCm ?? DIST_DEFAULT_CM);
  if (!Number.isFinite(raw)) return DIST_DEFAULT_CM;
  return Math.min(DIST_MAX_CM, Math.max(DIST_MIN_CM, raw));
}

/** Keadaan "tanpa rintangan": ECHO tidak pernah naik. */
export function noObstacleOf(instance: ComponentInstanceState): boolean {
  return instance.interactiveState.noObstacle === true;
}

/** Jendela ECHO aktif menurut jadwal sesi (dipasang sesi, bukan UI). */
export function echoOnOf(instance: ComponentInstanceState): boolean {
  return instance.interactiveState.echoOn === true;
}

export const hcSr04Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    const trig = ctx.netOf(instance.id, 'TRIG');
    const echo = ctx.netOf(instance.id, 'ECHO');
    // Beban catu + masukan TRIG.
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    ctx.conductance(trig, gnd, 1 / R_TRIG_IN);
    // ECHO push-pull: HIGH setegangan VCC modul selama jendela jadwal
    // sesi, LOW aktif (bukan mengambang) di luar jendela — digitalRead
    // di luar pulsa membaca LOW seperti modul asli. Level mengikuti
    // tegangan VCC terukur (iterasi sebelumnya), jadi ECHO 5 V pada
    // board 3,3 V memicu aturan overvoltage engine secara alami.
    const echoVolts = echoOnOf(instance) ? ctx.prevVoltage(vcc) : 0;
    ctx.thevenin(echo, echoVolts, R_ECHO_OUT);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const echoTarget = echoOnOf(instance) ? v('VCC') : 0;
    return {
      // Arus catu modul (beban ekuivalen 333 Ω).
      main: (v('VCC') - v('GND')) / R_SUPPLY,
      // Arus keluaran ECHO terhadap target Thevenin-nya.
      echo: (v('ECHO') - echoTarget) / R_ECHO_OUT,
    };
  },

  checkDamage: (_instance, result) => {
    const vcc = result.pinVoltages.VCC ?? 0;
    if (vcc > VCC_DAMAGE_V) {
      return {
        ruleId: 'HCSR04_OVERVOLTAGE',
        titleId: 'HC-SR04 Rusak — Tegangan Catu Berlebih',
        explanationId:
          'HC-SR04 dirancang untuk catu 5 V. Memberi tegangan jauh di atas itu (mis. langsung dari adaptor 9 V) membakar regulator dan IC pengendali di modul. Beri catu 5 V dari pin 5V board atau regulator 7805.',
        measured: vcc,
        limit: VCC_DAMAGE_V,
        unit: 'V',
      };
    }
    return null;
  },
};
