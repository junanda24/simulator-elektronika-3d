import type { ComponentCategory } from '../shared/types';
import { RESISTOR_META } from '../shared/components/catalog/resistor/meta';
import { LED_META } from '../shared/components/catalog/led/meta';
import { PUSH_BUTTON_META } from '../shared/components/catalog/push-button/meta';
import { POTENTIOMETER_META } from '../shared/components/catalog/potentiometer/meta';
import { CAPACITOR_META } from '../shared/components/catalog/capacitor/meta';
import { DIODE_META } from '../shared/components/catalog/diode/meta';
import { TRANSISTOR_META } from '../shared/components/catalog/transistor/meta';
import { RELAY_META } from '../shared/components/catalog/relay/meta';
import { RGB_LED_META } from '../shared/components/catalog/rgb-led/meta';
import { LDR_META } from '../shared/components/catalog/ldr/meta';
import { PIR_META } from '../shared/components/catalog/pir/meta';
import { LM35_META } from '../shared/components/catalog/lm35/meta';
import { JOYSTICK_META } from '../shared/components/catalog/joystick/meta';
import { SOIL_MOISTURE_META } from '../shared/components/catalog/soil-moisture/meta';
import { SERVO_META } from '../shared/components/catalog/servo/meta';
import { DC_MOTOR_META } from '../shared/components/catalog/dc-motor/meta';
import { BUZZER_META } from '../shared/components/catalog/buzzer/meta';
import { SEVEN_SEGMENT_META } from '../shared/components/catalog/seven-segment/meta';
import { FUSE_META } from '../shared/components/catalog/fuse/meta';
import { TILT_SWITCH_META } from '../shared/components/catalog/tilt-switch/meta';
import { NTC_THERMISTOR_META } from '../shared/components/catalog/ntc-thermistor/meta';
import { REED_SWITCH_META } from '../shared/components/catalog/reed-switch/meta';
import { FC51_META } from '../shared/components/catalog/fc-51/meta';
import { KY003_META } from '../shared/components/catalog/ky-003/meta';
import { MOSFET_META } from '../shared/components/catalog/mosfet/meta';
import { FLAME_SENSOR_META } from '../shared/components/catalog/flame-sensor/meta';
import { RAIN_SENSOR_META } from '../shared/components/catalog/rain-sensor/meta';
import { MQ2_META } from '../shared/components/catalog/mq2/meta';
import { SOUND_SENSOR_META } from '../shared/components/catalog/sound-sensor/meta';
import { LED_BAR_GRAPH_META } from '../shared/components/catalog/led-bar-graph/meta';
import { REGULATOR_7805_META } from '../shared/components/catalog/regulator-7805/meta';
import { BATTERY_9V_META } from '../shared/components/catalog/battery-9v/meta';
import { HC_SR04_META } from '../shared/components/catalog/hc-sr04/meta';
import type { ComponentMeta } from '../shared/components/catalog/resistor/meta';

export type { ComponentMeta };
export {
  RESISTOR_META,
  LED_META,
  PUSH_BUTTON_META,
  POTENTIOMETER_META,
  CAPACITOR_META,
  DIODE_META,
  TRANSISTOR_META,
  RELAY_META,
  RGB_LED_META,
  LDR_META,
  PIR_META,
  LM35_META,
  JOYSTICK_META,
  SOIL_MOISTURE_META,
  SERVO_META,
  DC_MOTOR_META,
  BUZZER_META,
  SEVEN_SEGMENT_META,
  FUSE_META,
  TILT_SWITCH_META,
  NTC_THERMISTOR_META,
  REED_SWITCH_META,
  FC51_META,
  KY003_META,
  MOSFET_META,
  FLAME_SENSOR_META,
  RAIN_SENSOR_META,
  MQ2_META,
  SOUND_SENSOR_META,
  LED_BAR_GRAPH_META,
  REGULATOR_7805_META,
  BATTERY_9V_META,
  HC_SR04_META,
};

/** Katalog Left Dock — bersumber dari meta plugin asli (single source of truth). */
export const CATALOG: ComponentMeta[] = [
  RESISTOR_META,
  LED_META,
  PUSH_BUTTON_META,
  POTENTIOMETER_META,
  CAPACITOR_META,
  DIODE_META,
  TRANSISTOR_META,
  RELAY_META,
  RGB_LED_META,
  LDR_META,
  PIR_META,
  LM35_META,
  JOYSTICK_META,
  SOIL_MOISTURE_META,
  SERVO_META,
  DC_MOTOR_META,
  BUZZER_META,
  SEVEN_SEGMENT_META,
  FUSE_META,
  TILT_SWITCH_META,
  NTC_THERMISTOR_META,
  REED_SWITCH_META,
  FC51_META,
  KY003_META,
  MOSFET_META,
  FLAME_SENSOR_META,
  RAIN_SENSOR_META,
  MQ2_META,
  SOUND_SENSOR_META,
  LED_BAR_GRAPH_META,
  REGULATOR_7805_META,
  BATTERY_9V_META,
  HC_SR04_META,
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
    } else if (key === 'rating' && typeof value === 'number') {
      parts.push(`Rating bawaan ${value} mA`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join(' · ');
}
