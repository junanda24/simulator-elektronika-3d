import type { ComponentPlugin } from '../../../types';
import { DC_MOTOR_META } from './meta';
import { dcMotorElectrical } from './electrical';
import { DcMotorRender3D } from './model3d';

/** Plugin lengkap Motor DC Kecil — perakitan meta + elektrik + render 3D. */
export const dcMotorPlugin: ComponentPlugin = {
  ...DC_MOTOR_META,
  Render3D: DcMotorRender3D,
  electrical: dcMotorElectrical,
};
