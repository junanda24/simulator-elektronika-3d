import type { ComponentCategory } from '../shared/types';
import { RESISTOR_META } from '../shared/components/catalog/resistor/meta';
import { LED_META } from '../shared/components/catalog/led/meta';
import { PUSH_BUTTON_META } from '../shared/components/catalog/push-button/meta';
import { POTENTIOMETER_META } from '../shared/components/catalog/potentiometer/meta';
import type { ComponentMeta } from '../shared/components/catalog/resistor/meta';

export type { ComponentMeta };
export { RESISTOR_META, LED_META, PUSH_BUTTON_META, POTENTIOMETER_META };

/** Katalog Left Dock — bersumber dari meta plugin asli (single source of truth). */
export const CATALOG: ComponentMeta[] = [
  RESISTOR_META,
  LED_META,
  PUSH_BUTTON_META,
  POTENTIOMETER_META,
];

export const CATEGORY_LABEL_ID: Record<ComponentCategory, string> = {
  passive: 'Pasif',
  output: 'Keluaran',
  input: 'Masukan',
  sensor: 'Sensor',
  actuator: 'Aktuator',
  display: 'Tampilan',
};

const LED_COLOR_LABEL_ID: Record<string, string> = {
  red: 'Merah',
  yellow: 'Kuning',
  green: 'Hijau',
  blue: 'Biru',
  white: 'Putih',
};

/** Ringkasan properti bawaan untuk kartu katalog. */
export function describeDefaultProps(meta: ComponentMeta): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta.defaultProps)) {
    if (key === 'resistance' && typeof value === 'number') {
      parts.push(`Nilai bawaan ${value} Ω`);
    } else if (key === 'value' && typeof value === 'number') {
      parts.push(`Nilai bawaan ${value.toLocaleString('id-ID')} Ω`);
    } else if (key === 'color' && typeof value === 'string') {
      parts.push(`Warna bawaan ${LED_COLOR_LABEL_ID[value] ?? value}`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join(' · ');
}
