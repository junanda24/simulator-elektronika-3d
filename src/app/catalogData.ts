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
