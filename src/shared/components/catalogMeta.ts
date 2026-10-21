import type { ComponentPlugin } from '../types';
import { RESISTOR_META } from './catalog/resistor/meta';
import { LED_META } from './catalog/led/meta';
import { PUSH_BUTTON_META } from './catalog/push-button/meta';
import { POTENTIOMETER_META } from './catalog/potentiometer/meta';
import { CAPACITOR_META } from './catalog/capacitor/meta';
import { DIODE_META } from './catalog/diode/meta';
import { TRANSISTOR_META } from './catalog/transistor/meta';
import { RELAY_META } from './catalog/relay/meta';
import { RGB_LED_META } from './catalog/rgb-led/meta';
import { LDR_META } from './catalog/ldr/meta';
import { PIR_META } from './catalog/pir/meta';
import { LM35_META } from './catalog/lm35/meta';
import { JOYSTICK_META } from './catalog/joystick/meta';
import { SOIL_MOISTURE_META } from './catalog/soil-moisture/meta';
import { SERVO_META } from './catalog/servo/meta';
import { DC_MOTOR_META } from './catalog/dc-motor/meta';
import { BUZZER_META } from './catalog/buzzer/meta';
import { SEVEN_SEGMENT_META } from './catalog/seven-segment/meta';
import { FUSE_META } from './catalog/fuse/meta';
import { TILT_SWITCH_META } from './catalog/tilt-switch/meta';

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
  [CAPACITOR_META.type]: CAPACITOR_META,
  [DIODE_META.type]: DIODE_META,
  [TRANSISTOR_META.type]: TRANSISTOR_META,
  [RELAY_META.type]: RELAY_META,
  [RGB_LED_META.type]: RGB_LED_META,
  [LDR_META.type]: LDR_META,
  [PIR_META.type]: PIR_META,
  [LM35_META.type]: LM35_META,
  [JOYSTICK_META.type]: JOYSTICK_META,
  [SOIL_MOISTURE_META.type]: SOIL_MOISTURE_META,
  [SERVO_META.type]: SERVO_META,
  [DC_MOTOR_META.type]: DC_MOTOR_META,
  [BUZZER_META.type]: BUZZER_META,
  [SEVEN_SEGMENT_META.type]: SEVEN_SEGMENT_META,
  [FUSE_META.type]: FUSE_META,
  [TILT_SWITCH_META.type]: TILT_SWITCH_META,
};

export function getComponentMeta(type: string): ComponentMeta | undefined {
  return CATALOG_META[type];
}
