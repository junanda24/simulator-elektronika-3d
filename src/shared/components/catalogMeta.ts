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
import { HC_SR04_META } from './catalog/hc-sr04/meta';
import { NTC_THERMISTOR_META } from './catalog/ntc-thermistor/meta';
import { REED_SWITCH_META } from './catalog/reed-switch/meta';
import { FC51_META } from './catalog/fc-51/meta';
import { KY003_META } from './catalog/ky-003/meta';
import { MOSFET_META } from './catalog/mosfet/meta';
import { FLAME_SENSOR_META } from './catalog/flame-sensor/meta';
import { RAIN_SENSOR_META } from './catalog/rain-sensor/meta';
import { MQ2_META } from './catalog/mq2/meta';
import { SOUND_SENSOR_META } from './catalog/sound-sensor/meta';
import { LED_BAR_GRAPH_META } from './catalog/led-bar-graph/meta';
import { REGULATOR_7805_META } from './catalog/regulator-7805/meta';
import { BATTERY_9V_META } from './catalog/battery-9v/meta';

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
  // HC-SR04 (gelombang ultrasonik): meta didaftarkan lebih dulu karena
  // netlist sesi membutuhkan daftar pin untuk menamai net TRIG/ECHO;
  // plugin penuh, elektrik, dan ikon didaftarkan pada langkah integrasi
  // katalog (registry.ts / electricalRegistry.ts / catalogIcons.tsx).
  [HC_SR04_META.type]: HC_SR04_META,
  [NTC_THERMISTOR_META.type]: NTC_THERMISTOR_META,
  [REED_SWITCH_META.type]: REED_SWITCH_META,
  [FC51_META.type]: FC51_META,
  [KY003_META.type]: KY003_META,
  [MOSFET_META.type]: MOSFET_META,
  [FLAME_SENSOR_META.type]: FLAME_SENSOR_META,
  [RAIN_SENSOR_META.type]: RAIN_SENSOR_META,
  [MQ2_META.type]: MQ2_META,
  [SOUND_SENSOR_META.type]: SOUND_SENSOR_META,
  [LED_BAR_GRAPH_META.type]: LED_BAR_GRAPH_META,
  [REGULATOR_7805_META.type]: REGULATOR_7805_META,
  [BATTERY_9V_META.type]: BATTERY_9V_META,
};

export function getComponentMeta(type: string): ComponentMeta | undefined {
  return CATALOG_META[type];
}
