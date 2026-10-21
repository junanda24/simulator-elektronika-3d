import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

/**
 * Resistansi konsumsi modul antara VCC–GND (Ω) — LED pemancar IR
 * menyala terus, arus kerja kelas modul ±15 mA pada 5 V (riset §5).
 */
const R_SUPPLY = 330;
/** Impedansi keluaran OUT (Ω) — didorong aktif dua arah, pola PIR. */
const R_OUT = 100;
/** Batas catu modul (V) — kelas komparator LM393 5 V; di atas ini rusak. */
export const FC51_MAX_SUPPLY_V = 5.5;
/** Ujung skala gizmo jarak (cm); di atas jangkauan deteksi = bebas. */
export const DISTANCE_MAX_CM = 35;
/**
 * Ambang deteksi (cm): halangan pada jarak ≤ nilai ini membuat OUT
 * LOW. Trimpot modul asli adalah properti visual; ambangnya TETAP
 * dan terdokumentasi di sini (riset §5: bawaan model ±15–20 cm).
 */
export const DETECT_THRESHOLD_CM = 20;
export const DISTANCE_DEFAULT_CM = DISTANCE_MAX_CM;

/** Jarak halangan (cm) dari interactiveState, dijepit 0..35 (default 35 = bebas). */
export function distanceCmOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.distanceCm ?? DISTANCE_DEFAULT_CM);
  if (!Number.isFinite(raw)) return DISTANCE_DEFAULT_CM;
  return Math.min(DISTANCE_MAX_CM, Math.max(0, raw));
}

/** True bila ada halangan di dalam ambang deteksi. */
export function obstacleOf(instance: ComponentInstanceState): boolean {
  return distanceCmOf(instance) <= DETECT_THRESHOLD_CM;
}

/** Target Thevenin OUT: aktif-RENDAH — halangan → 0 V, bebas → VCC. */
function outTarget(obstacle: boolean, vccVolts: number): { volts: number; ohms: number } {
  return obstacle ? { volts: 0, ohms: R_OUT } : { volts: vccVolts, ohms: R_OUT };
}

/**
 * Sensor halangan FC-51: modul bertenaga (konsumsi VCC–GND dari LED
 * pemancar yang menyala terus). OUT adalah keluaran digital Thevenin
 * aktif-RENDAH mengikuti pola PIR: halangan dalam ambang ditarik ke
 * 0 V, bebas didorong ke tegangan VCC.
 */
export const fc51Electrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const vcc = ctx.netOf(instance.id, 'VCC');
    const gnd = ctx.netOf(instance.id, 'GND');
    const out = ctx.netOf(instance.id, 'OUT');
    ctx.conductance(vcc, gnd, 1 / R_SUPPLY);
    const target = outTarget(obstacleOf(instance), ctx.prevVoltage(vcc));
    ctx.thevenin(out, target.volts, target.ohms);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const v = (pin: string) => voltages.get(netOf(instance.id, pin)) ?? 0;
    const target = outTarget(obstacleOf(instance), v('VCC'));
    return { out: (v('OUT') - target.volts) / target.ohms };
  },

  checkDamage: (_instance, result) => {
    const supply = (result.pinVoltages.VCC ?? 0) - (result.pinVoltages.GND ?? 0);
    if (supply > FC51_MAX_SUPPLY_V) {
      return {
        ruleId: 'FC51_OVERVOLTAGE',
        titleId: 'Sensor FC-51 Rusak — Tegangan Catu Berlebih',
        explanationId:
          'Modul FC-51 dirancang untuk catu 3,3–5 V; tegangan di atas 5,5 V merusak komparator LM393 dan LED pemancar IR di dalamnya secara permanen. Beri catu dari pin 5V atau 3V3 board, jangan langsung dari baterai 9 V.',
        measured: supply,
        limit: FC51_MAX_SUPPLY_V,
        unit: 'V',
      };
    }
    return null;
  },
};
