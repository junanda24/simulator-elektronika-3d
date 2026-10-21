import type { ComponentPlugin } from '../../../types';
import { JOYSTICK_META } from './meta';
import { joystickElectrical } from './electrical';
import { JoystickRender3D } from './model3d';

/** Plugin lengkap Joystick Analog — perakitan meta + elektrik + render 3D. */
export const joystickPlugin: ComponentPlugin = {
  ...JOYSTICK_META,
  Render3D: JoystickRender3D,
  electrical: joystickElectrical,
};
