import type { ComponentPlugin } from '../types';
import { resistorPlugin } from './catalog/resistor';
import { ledPlugin } from './catalog/led';
import { pushButtonPlugin } from './catalog/push-button';
import { potentiometerPlugin } from './catalog/potentiometer';
import { capacitorPlugin } from './catalog/capacitor';
import { diodePlugin } from './catalog/diode';
import { transistorPlugin } from './catalog/transistor';
import { relayPlugin } from './catalog/relay';
import { rgbLedPlugin } from './catalog/rgb-led';
import { ldrPlugin } from './catalog/ldr';
import { pirPlugin } from './catalog/pir';
import { lm35Plugin } from './catalog/lm35';
import { joystickPlugin } from './catalog/joystick';
import { soilMoisturePlugin } from './catalog/soil-moisture';
import { servoPlugin } from './catalog/servo';
import { dcMotorPlugin } from './catalog/dc-motor';
import { buzzerPlugin } from './catalog/buzzer';
import { sevenSegmentPlugin } from './catalog/seven-segment';
import { fusePlugin } from './catalog/fuse';
import { tiltSwitchPlugin } from './catalog/tilt-switch';

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
  capacitorPlugin,
  diodePlugin,
  transistorPlugin,
  relayPlugin,
  rgbLedPlugin,
  ldrPlugin,
  pirPlugin,
  lm35Plugin,
  joystickPlugin,
  soilMoisturePlugin,
  servoPlugin,
  dcMotorPlugin,
  buzzerPlugin,
  sevenSegmentPlugin,
  fusePlugin,
  tiltSwitchPlugin,
];

const BY_TYPE = new Map(COMPONENT_REGISTRY.map((p) => [p.type, p]));

export function getComponentPlugin(type: string): ComponentPlugin | undefined {
  return BY_TYPE.get(type);
}

/** Resolver elektrik untuk solver — didelegasikan ke peta elektrik murni. */
export { electricalOf } from './electricalRegistry';
