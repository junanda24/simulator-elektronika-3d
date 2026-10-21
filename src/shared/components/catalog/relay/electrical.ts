import type { ComponentElectrical } from '../../../types';

/** Resistansi koil relay 5 V (Ω) — arus koil khas ≈ 71 mA. */
const COIL_OHMS = 70;
/** Konduktansi kontak tertutup (Siemens) — setara resistansi kontak 1 mΩ. */
const CONTACT_G = 1000;
/** Ambang tegangan IN (terhadap GND) agar relay dianggap aktif (V). */
const IN_THRESHOLD_V = 2.5;

/**
 * Modul relay 5 V: koil = beban 70 Ω antara VCC–GND. Kontak mekanis
 * mengikuti keadaan iterasi PWL sebelumnya: aktif (IN − GND > 2,5 V) →
 * COM terhubung ke NO; tidak aktif → COM terhubung ke NC.
 * Kunci 'active' di branchCurrents (1/0) dibaca model 3D untuk LED
 * indikator modul. Relay tidak punya aturan kerusakan di gelombang ini.
 */
export const relayElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    const input = ctx.netOf(instance.id, 'IN');
    const com = ctx.netOf(instance.id, 'COM');
    const no = ctx.netOf(instance.id, 'NO');
    const nc = ctx.netOf(instance.id, 'NC');

    ctx.conductance(vcc, gnd, 1 / COIL_OHMS);
    const active = ctx.prevVoltage(input) - ctx.prevVoltage(gnd) > IN_THRESHOLD_V;
    if (active) {
      ctx.conductance(com, no, CONTACT_G);
    } else {
      ctx.conductance(com, nc, CONTACT_G);
    }
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    return {
      coil: (v('VCC') - v('GND')) / COIL_OHMS,
      active: v('IN') - v('GND') > IN_THRESHOLD_V ? 1 : 0,
    };
  },

  checkDamage: () => null,
};
