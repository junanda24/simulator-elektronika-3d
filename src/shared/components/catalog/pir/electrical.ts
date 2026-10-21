import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/** Resistansi konsumsi modul antara VCC–GND (Ω) — arus diam kecil. */
const R_SUPPLY = 10000;
/** Impedansi keluaran OUT saat aktif (Ω) — didorong ke tegangan VCC. */
const R_OUT_ACTIVE = 100;
/** Pull-down lemah OUT saat tidak aktif (Ω) — menuju 0 V. */
const R_OUT_IDLE = 10000;

/** Keadaan gerak dari interactiveState. */
export function motionOf(instance: ComponentInstanceState): boolean {
  return instance.interactiveState.motion === true;
}

/** Target Thevenin OUT: (tegangan, resistansi seri) mengikuti keadaan gerak. */
function outTarget(motion: boolean, vccVolts: number): { volts: number; ohms: number } {
  return motion ? { volts: vccVolts, ohms: R_OUT_ACTIVE } : { volts: 0, ohms: R_OUT_IDLE };
}

/**
 * Sensor PIR: modul bertenaga (konsumsi kecil VCC–GND). OUT adalah
 * keluaran digital yang dimodelkan sebagai sumber Thevenin — aktif
 * (gerakan terdeteksi) didorong ke tegangan VCC lewat 100 Ω, tidak
 * aktif ditahan ke GND lewat pull-down lemah 10 kΩ.
 */
export const pirElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    const out = ctx.netOf(instance.id, 'OUT');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    const target = outTarget(motionOf(instance), ctx.prevVoltage(vcc));
    ctx.thevenin(out, target.volts, target.ohms);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const target = outTarget(motionOf(instance), v('VCC'));
    return { out: (v('OUT') - target.volts) / target.ohms };
  },

  checkDamage: () => null,
};
