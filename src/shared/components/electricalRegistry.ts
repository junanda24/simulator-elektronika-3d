import type { ComponentElectrical } from '../types';
import { resistorElectrical } from './catalog/resistor/electrical';
import { ledElectrical } from './catalog/led/electrical';
import { pushButtonElectrical } from './catalog/push-button/electrical';
import { potentiometerElectrical } from './catalog/potentiometer/electrical';

/**
 * Peta elektrik murni per tipe komponen — TANPA render 3D/React,
 * aman diimpor dari Web Worker simulasi maupun thread utama.
 */
export const ELECTRICAL_BY_TYPE: Record<string, ComponentElectrical> = {
  resistor: resistorElectrical,
  'led-5mm': ledElectrical,
  'push-button': pushButtonElectrical,
  potentiometer: potentiometerElectrical,
};

export function electricalOf(type: string): ComponentElectrical | undefined {
  return ELECTRICAL_BY_TYPE[type];
}
