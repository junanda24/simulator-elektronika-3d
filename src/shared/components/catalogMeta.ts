import type { ComponentPlugin } from '../types';
import { RESISTOR_META } from './catalog/resistor/meta';
import { LED_META } from './catalog/led/meta';
import { PUSH_BUTTON_META } from './catalog/push-button/meta';
import { POTENTIOMETER_META } from './catalog/potentiometer/meta';

export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

/**
 * Meta katalog TANPA React/elektrik — aman diimpor Web Worker
 * (netlist, placement, runtime). Registry penuh ada di registry.ts.
 */
export const CATALOG_META: Record<string, ComponentMeta> = {
  [RESISTOR_META.type]: RESISTOR_META,
  [LED_META.type]: LED_META,
  [PUSH_BUTTON_META.type]: PUSH_BUTTON_META,
  [POTENTIOMETER_META.type]: POTENTIOMETER_META,
};

export function getComponentMeta(type: string): ComponentMeta | undefined {
  return CATALOG_META[type];
}
