import { getComponentPlugin } from '../shared/components/registry';
import type { ComponentInstanceState } from '../shared/types';

/**
 * Model tampilan popover inspektor komponen — HANYA field yang benar-benar
 * dicat ke layar (nama, status rusak, teks arus yang SUDAH diformat).
 *
 * Kenapa lapisan ini ada: applySnapshot mengganti objek instance setiap
 * solve yang angka mentahnya berubah (jitter solver di bawah presisi
 * tampil pun cukup membuat identitas baru), sehingga inspektor yang
 * dirender sebaris di App ikut dicat ulang sampai 60×/detik selama drag
 * slider — terlihat sebagai kedip/"refresh berkali-kali". Selector di
 * berkas ini membandingkan pada PRESISI TAMPIL: selama teks yang akan
 * dicat tidak berubah, referensi view yang sama dikembalikan dan React
 * melewati render ulang sepenuhnya.
 */
export interface InspectorCurrentRow {
  key: string;
  /** Arus yang sudah diformat pada presisi tampil (0,1 mA), mis. "12.3". */
  text: string;
}

export interface InspectorView {
  id: string;
  name: string;
  isDamaged: boolean;
  currents: InspectorCurrentRow[];
}

/**
 * Format arus (ampere) ke miliampere dengan 1 desimal. Nilai yang
 * membulat ke nol TIDAK boleh bertanda minus: arus solver mungil seperti
 * -0,04 mA sebelumnya tercetak "-0.0 mA" (dan berkedip bolak-balik
 * melawan "0.0"). Dibulatkan dulu, lalu -0 dinormalkan ke 0.
 */
export function formatMilliAmps(amps: number): string {
  const rounded = Math.round(amps * 1000 * 10) / 10;
  const normalized = rounded === 0 ? 0 : rounded;
  return normalized.toFixed(1);
}

/** Bangun model tampilan dari satu instance (murni, tanpa cache). */
export function buildInspectorView(instance: ComponentInstanceState): InspectorView {
  return {
    id: instance.id,
    name: getComponentPlugin(instance.type)?.name ?? instance.type,
    isDamaged: instance.simState.isDamaged,
    currents: Object.entries(instance.simState.branchCurrents).map(([key, amps]) => ({
      key,
      text: formatMilliAmps(amps),
    })),
  };
}

/**
 * Kesetaraan pada presisi tampil: dua view dianggap sama bila semua yang
 * dicat ke layar identik — termasuk status rusak (boolean, dibandingkan
 * apa adanya sehingga perubahan Normal↔Rusak seketika, tidak ditahan).
 */
export function inspectorViewsEqual(a: InspectorView, b: InspectorView): boolean {
  if (a.id !== b.id || a.name !== b.name || a.isDamaged !== b.isDamaged) return false;
  if (a.currents.length !== b.currents.length) return false;
  return a.currents.every(
    (row, i) => row.key === b.currents[i].key && row.text === b.currents[i].text,
  );
}

/** Bentuk state minimum yang dibutuhkan selector inspektor. */
export interface InspectorSelectorState {
  instances: ComponentInstanceState[];
  selectedInstanceId: string | null;
}

let cachedView: InspectorView | null = null;

/**
 * Selector zustand untuk popover inspektor. Mengembalikan referensi view
 * yang STABIL selama data tampil tidak berubah (cache satu entri +
 * inspectorViewsEqual), sehingga perubahan store lain — snapshot solver
 * saat komponen mana pun digeser, dsb. — tidak memicu render ulang
 * inspektor. Hanya perubahan yang benar-benar mengubah teks/status di
 * layar yang menghasilkan view baru.
 */
export function selectInspectorView(state: InspectorSelectorState): InspectorView | null {
  const instance = state.selectedInstanceId
    ? state.instances.find((i) => i.id === state.selectedInstanceId)
    : undefined;
  if (!instance) {
    cachedView = null;
    return null;
  }
  const next = buildInspectorView(instance);
  if (cachedView && inspectorViewsEqual(cachedView, next)) return cachedView;
  cachedView = next;
  return next;
}

/** Kait uji: kosongkan cache selector agar tiap kasus mulai bersih. */
export function resetInspectorViewCache(): void {
  cachedView = null;
}
