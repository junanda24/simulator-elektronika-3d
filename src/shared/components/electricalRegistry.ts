import type { ComponentElectrical } from '../types';
import { resistorElectrical } from './catalog/resistor/electrical';
import { ledElectrical } from './catalog/led/electrical';
import { pushButtonElectrical } from './catalog/push-button/electrical';
import { potentiometerElectrical } from './catalog/potentiometer/electrical';
import { capacitorElectrical } from './catalog/capacitor/electrical';
import { diodeElectrical } from './catalog/diode/electrical';
import { transistorElectrical } from './catalog/transistor/electrical';
import { relayElectrical } from './catalog/relay/electrical';
import { rgbLedElectrical } from './catalog/rgb-led/electrical';
import { ldrElectrical } from './catalog/ldr/electrical';
import { pirElectrical } from './catalog/pir/electrical';
import { lm35Electrical } from './catalog/lm35/electrical';
import { joystickElectrical } from './catalog/joystick/electrical';
import { soilMoistureElectrical } from './catalog/soil-moisture/electrical';
import { servoElectrical } from './catalog/servo/electrical';
import { dcMotorElectrical } from './catalog/dc-motor/electrical';
import { buzzerElectrical } from './catalog/buzzer/electrical';
import { sevenSegmentElectrical } from './catalog/seven-segment/electrical';
import { fuseElectrical } from './catalog/fuse/electrical';
import { tiltSwitchElectrical } from './catalog/tilt-switch/electrical';

/**
 * Peta elektrik murni per tipe komponen — TANPA render 3D/React,
 * aman diimpor dari Web Worker simulasi maupun thread utama.
 */
export const ELECTRICAL_BY_TYPE: Record<string, ComponentElectrical> = {
  resistor: resistorElectrical,
  'led-5mm': ledElectrical,
  'push-button': pushButtonElectrical,
  potentiometer: potentiometerElectrical,
  capacitor: capacitorElectrical,
  diode: diodeElectrical,
  transistor: transistorElectrical,
  relay: relayElectrical,
  'rgb-led': rgbLedElectrical,
  ldr: ldrElectrical,
  pir: pirElectrical,
  lm35: lm35Electrical,
  joystick: joystickElectrical,
  'soil-moisture': soilMoistureElectrical,
  servo: servoElectrical,
  'dc-motor': dcMotorElectrical,
  buzzer: buzzerElectrical,
  'seven-segment': sevenSegmentElectrical,
  fuse: fuseElectrical,
  'tilt-switch': tiltSwitchElectrical,
};

export function electricalOf(type: string): ComponentElectrical | undefined {
  return ELECTRICAL_BY_TYPE[type];
}
