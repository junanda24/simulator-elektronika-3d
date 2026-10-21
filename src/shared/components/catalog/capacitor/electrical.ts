import type { ComponentElectrical } from '../../../types';

/** Resistansi bocor dielektrik (Ω) — kapasitor DC ideal = rangkaian terbuka. */
const LEAK_OHMS = 10_000_000;
/** Tegangan balik maksimum yang ditoleransi sebelum elektrolit rusak (V). */
const MAX_REVERSE_V = 1;
const DEFAULT_RATING_V = 25;

/** Rating tegangan valid dari props; fallback 25 V. */
function voltageRatingOf(props: Record<string, unknown>): number {
  const v = props.voltageRating;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_RATING_V;
}

/**
 * Kapasitor elektrolit pada analisis DC tunak: rangkaian terbuka, dimodelkan
 * sebagai resistor bocor 10 MΩ antar kaki. Karena terpolarisasi, tegangan
 * balik > 1 V atau tegangan maju melebihi rating merusaknya (Kartu Autopsi).
 */
export const capacitorElectrical: ComponentElectrical = {
  stamp: (ctx, instance, _dt) => {
    ctx.conductance(
      ctx.netOf(instance.id, 'PLUS'),
      ctx.netOf(instance.id, 'MINUS'),
      1 / LEAK_OHMS,
    );
  },

  computeCurrents: (instance, voltages, netOf) => {
    const vp = voltages.get(netOf(instance.id, 'PLUS')) ?? 0;
    const vm = voltages.get(netOf(instance.id, 'MINUS')) ?? 0;
    return { main: (vp - vm) / LEAK_OHMS };
  },

  checkDamage: (instance, result) => {
    const rating = voltageRatingOf(instance.props);
    const vp = result.pinVoltages.PLUS ?? 0;
    const vm = result.pinVoltages.MINUS ?? 0;
    if (vm - vp > MAX_REVERSE_V) {
      return {
        ruleId: 'CAP_REVERSE_POLARITY',
        titleId: 'Kapasitor Elektrolit Terbalik — Berisiko Meledak',
        explanationId:
          'Kapasitor elektrolit sangat sensitif polaritas: tegangan terbalik merusak lapisan oksida dielektriknya, menimbulkan gas dan panas hingga kapasitor bisa meledak. Kaki plus (panjang, tanpa garis) harus selalu berada pada potensial yang lebih tinggi daripada kaki minus (sisi bergaris perak).',
        measured: vm - vp,
        limit: MAX_REVERSE_V,
        unit: 'V',
      };
    }
    if (vp - vm > rating) {
      return {
        ruleId: 'CAP_OVERVOLTAGE',
        titleId: 'Kapasitor Rusak — Tegangan Melebihi Rating',
        explanationId:
          'Tegangan kerja melebihi rating kapasitor menembus dielektrik dan merusaknya secara permanen. Pilih kapasitor dengan rating tegangan di atas tegangan maksimum rangkaian, idealnya 1,5–2 kali lipat untuk margin aman.',
        measured: vp - vm,
        limit: rating,
        unit: 'V',
      };
    }
    return null;
  },
};
