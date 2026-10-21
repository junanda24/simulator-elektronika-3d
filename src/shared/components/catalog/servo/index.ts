import type { ComponentPlugin } from '../../../types';
import { SERVO_META } from './meta';
import { servoElectrical } from './electrical';
import { ServoRender3D } from './model3d';

/** Plugin lengkap Motor Servo SG90 — perakitan meta + elektrik + render 3D. */
export const servoPlugin: ComponentPlugin = {
  ...SERVO_META,
  Render3D: ServoRender3D,
  electrical: servoElectrical,
};
