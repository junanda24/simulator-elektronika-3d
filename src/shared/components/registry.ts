import type { ComponentPlugin } from '../types';
import { resistorPlugin } from './catalog/resistor';
import { ledPlugin } from './catalog/led';
import { pushButtonPlugin } from './catalog/push-button';
import { potentiometerPlugin } from './catalog/potentiometer';

/**
 * Single source of truth seluruh komponen (ARCHITECTURE.md §1.3).
 * Menambah komponen = buat folder catalog/<slug> + daftarkan di sini.
 * Core (solver, stage, wiring) tidak pernah menyebut nama komponen.
 */
export const COMPONENT_REGISTRY: ComponentPlugin[] = [
  resistorPlugin,
  ledPlugin,
  pushButtonPlugin,
  potentiometerPlugin,
];

const BY_TYPE = new Map(COMPONENT_REGISTRY.map((p) => [p.type, p]));

export function getComponentPlugin(type: string): ComponentPlugin | undefined {
  return BY_TYPE.get(type);
}

/** Resolver elektrik untuk solver — didelegasikan ke peta elektrik murni. */
export { electricalOf } from './electricalRegistry';
