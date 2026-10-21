import type { ComponentPlugin } from '../../../types';
import { TILT_SWITCH_META } from './meta';
import { tiltSwitchElectrical } from './electrical';
import { TiltSwitchRender3D } from './model3d';

/** Plugin lengkap Saklar Miring (Tilt Switch) — perakitan meta + elektrik + render 3D. */
export const tiltSwitchPlugin: ComponentPlugin = {
  ...TILT_SWITCH_META,
  Render3D: TiltSwitchRender3D,
  electrical: tiltSwitchElectrical,
};
