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
import { ntcThermistorElectrical } from './catalog/ntc-thermistor/electrical';
import { reedSwitchElectrical } from './catalog/reed-switch/electrical';
import { fc51Electrical } from './catalog/fc-51/electrical';
import { ky003Electrical } from './catalog/ky-003/electrical';
import { mosfetElectrical } from './catalog/mosfet/electrical';
import { flameSensorElectrical } from './catalog/flame-sensor/electrical';
import { rainSensorElectrical } from './catalog/rain-sensor/electrical';
import { mq2Electrical } from './catalog/mq2/electrical';
import { soundSensorElectrical } from './catalog/sound-sensor/electrical';
import { ledBarGraphElectrical } from './catalog/led-bar-graph/electrical';
import { regulator7805Electrical } from './catalog/regulator-7805/electrical';
import { battery9vElectrical } from './catalog/battery-9v/electrical';
import { hcSr04Electrical } from './catalog/hc-sr04/electrical';

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
  'ntc-thermistor': ntcThermistorElectrical,
  'reed-switch': reedSwitchElectrical,
  'fc-51': fc51Electrical,
  'ky-003': ky003Electrical,
  mosfet: mosfetElectrical,
  'flame-sensor': flameSensorElectrical,
  'rain-sensor': rainSensorElectrical,
  mq2: mq2Electrical,
  'sound-sensor': soundSensorElectrical,
  'led-bar-graph': ledBarGraphElectrical,
  'regulator-7805': regulator7805Electrical,
  'battery-9v': battery9vElectrical,
  'hc-sr04': hcSr04Electrical,
};

export function electricalOf(type: string): ComponentElectrical | undefined {
  return ELECTRICAL_BY_TYPE[type];
}
