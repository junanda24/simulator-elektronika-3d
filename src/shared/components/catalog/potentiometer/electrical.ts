import type { ComponentElectrical, ComponentInstanceState } from '../../../types';

const DEFAULT_VALUE = 10000;

/** Resistansi total valid dari props; fallback ke default bila tidak valid. */
function valueOf(props: Record<string, unknown>): number {
  const v = props.value;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_VALUE;
}

/**
 * Posisi putaran wiper α ∈ [0.001, 0.999] — SIMULATION_RULES.md §1 butir 2.
 * Nilai tak valid / di luar rentang dijepit agar kedua segmen resistansi
 * tidak pernah 0 Ω (konduktansi tak hingga).
 */
export function alphaOf(instance: ComponentInstanceState): number {
  const raw = Number(instance.interactiveState.alpha ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(0.999, Math.max(0.001, raw));
}

/**
 * Potensiometer: dua segmen resistor linear dari satu elemen resistif:
 * R(A–Wiper) = R · α dan R(Wiper–B) = R · (1 − α).
 */
export const potentiometerElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const r = valueOf(instance.props);
    const alpha = alphaOf(instance);
    ctx.conductance(
      ctx.netOf(instance.id, 'A'),
      ctx.netOf(instance.id, 'WIPER'),
      1 / (r * alpha),
    );
    ctx.conductance(
      ctx.netOf(instance.id, 'WIPER'),
      ctx.netOf(instance.id, 'B'),
      1 / (r * (1 - alpha)),
    );
  },

  computeCurrents: (instance, voltages, netOf) => {
    const r = valueOf(instance.props);
    const alpha = alphaOf(instance);
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vw = voltages.get(netOf(instance.id, 'WIPER')) ?? 0;
    return { main: (va - vw) / (r * alpha) };
  },

  checkDamage: () => null,
};
