import type { ComponentPlugin } from '../../../types';
import { HC_SR04_META } from './meta';
import { hcSr04Electrical } from './electrical';
import { HcSr04Render3D } from './model3d';

/** Plugin lengkap Sensor Ultrasonik HC-SR04 — perakitan meta + elektrik + render 3D. */
export const hcSr04Plugin: ComponentPlugin = {
  ...HC_SR04_META,
  Render3D: HcSr04Render3D,
  electrical: hcSr04Electrical,
};
