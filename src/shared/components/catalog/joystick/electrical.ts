import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi total dua potensiometer sumbu antara VCC–GND (Ω). */
const R_SUPPLY = 5000;
/** Impedansi keluaran VRX/VRY (Ω). */
const R_OUT = 100;
/** Konduktansi tombol SW saat ditekan (Siemens) — kontak hampir ideal ke GND. */
const G_SW_PRESSED = 1000;

/** Posisi sumbu 0..1 dari interactiveState (default tengah 0,5), dijepit. */
function axisOf(instance: ComponentInstanceState, key: 'alphaX' | 'alphaY'): number {
  const raw = Number(instance.interactiveState[key] ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

export function alphaXOf(instance: ComponentInstanceState): number {
  return axisOf(instance, 'alphaX');
}

export function alphaYOf(instance: ComponentInstanceState): number {
  return axisOf(instance, 'alphaY');
}

/** Keadaan tombol tuas dari interactiveState. */
export function pressedOf(instance: ComponentInstanceState): boolean {
  return instance.interactiveState.pressed === true;
}

/**
 * Joystick analog: dua potensiometer 5 kΩ (konsumsi VCC–GND) yang
 * wipernya dimodelkan sebagai sumber Thevenin VRX = VCC × alphaX dan
 * VRY = VCC × alphaY lewat 100 Ω. Tombol SW menghubungkan pin SW ke
 * GND (konduktansi besar) selama ditekan, terbuka selain itu.
 */
export const joystickElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    const vVcc = ctx.prevVoltage(vcc);
    ctx.thevenin(ctx.netOf(instance.id, 'VRX'), vVcc * alphaXOf(instance), R_OUT);
    ctx.thevenin(ctx.netOf(instance.id, 'VRY'), vVcc * alphaYOf(instance), R_OUT);
    if (pressedOf(instance)) {
      ctx.conductance(ctx.netOf(instance.id, 'SW'), gnd, G_SW_PRESSED);
    }
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    return {
      vrx: (v('VRX') - v('VCC') * alphaXOf(instance)) / R_OUT,
      vry: (v('VRY') - v('VCC') * alphaYOf(instance)) / R_OUT,
      sw: pressedOf(instance) ? (v('SW') - v('GND')) * G_SW_PRESSED : 0,
    };
  },

  checkDamage: () => null,
};
