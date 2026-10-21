import type { ComponentElectrical } from '../../../types';

/** Resistansi beban internal servo (Ω) — arus kerja khas SG90. */
const LOAD_OHMS = 35;
/** Impedansi masukan pin sinyal (Ω) — input logika, nyaris tanpa arus. */
const SIG_OHMS = 100_000;

/**
 * Motor servo SG90: beban ±35 Ω antara VCC–GND, pin SIG berimpedansi
 * tinggi. Kunci 'angle' di branchCurrents dibaca model 3D untuk memutar
 * tanduk servo.
 *
 * CATATAN SIMPLIFIKASI: servo asli membaca lebar pulsa 1–2 ms pada
 * sinyal 50 Hz. Di simulasi DC ini sudut dihitung dari rasio tegangan
 * rata-rata SIG terhadap VCC × 180°, sehingga analogWrite/PWM dari
 * sketch menggerakkan servo secara proporsional (duty 0 → 0°,
 * duty penuh → 180°). Servo tidak punya aturan kerusakan di sini.
 */
export const servoElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    const sig = ctx.netOf(instance.id, 'SIG');
    ctx.conductance(vcc, gnd, 1 / LOAD_OHMS);
    ctx.conductance(sig, gnd, 1 / SIG_OHMS);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const vcc = v('VCC') - v('GND');
    const sig = v('SIG') - v('GND');
    const ratio = Math.min(1, Math.max(0, sig / Math.max(vcc, 0.1)));
    return {
      coil: vcc / LOAD_OHMS,
      angle: ratio * 180,
    };
  },

  checkDamage: () => null,
};
