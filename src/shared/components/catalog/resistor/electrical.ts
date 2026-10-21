import type { ComponentElectrical } from '../../../types';

const DEFAULT_RESISTANCE = 220;

/** Nilai resistansi valid dari props; fallback ke default bila tidak valid. */
function resistanceOf(props: Record<string, unknown>): number {
  const r = props.resistance;
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : DEFAULT_RESISTANCE;
}

/**
 * Resistor: komponen linear murni, G = 1/R antar kaki A–B.
 * Tidak pernah rusak pada Batch 1 (aturan daya disipasi menyusul).
 */
export const resistorElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    const r = resistanceOf(instance.props);
    ctx.conductance(ctx.netOf(instance.id, 'A'), ctx.netOf(instance.id, 'B'), 1 / r);
  },

  computeCurrents: (instance, voltages, netOf) => {
    const r = resistanceOf(instance.props);
    const va = voltages.get(netOf(instance.id, 'A')) ?? 0;
    const vb = voltages.get(netOf(instance.id, 'B')) ?? 0;
    return { main: (va - vb) / r };
  },

  checkDamage: () => null,
};
