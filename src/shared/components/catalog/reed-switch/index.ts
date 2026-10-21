import type { ComponentPlugin } from '../../../types';
import { REED_SWITCH_META } from './meta';
import { reedSwitchElectrical } from './electrical';
import { ReedSwitchRender3D } from './model3d';

/** Plugin lengkap Reed Switch — perakitan meta + elektrik + render 3D. */
export const reedSwitchPlugin: ComponentPlugin = {
  ...REED_SWITCH_META,
  Render3D: ReedSwitchRender3D,
  electrical: reedSwitchElectrical,
};
