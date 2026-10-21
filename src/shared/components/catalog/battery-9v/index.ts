import type { ComponentPlugin } from '../../../types';
import { BATTERY_9V_META } from './meta';
import { battery9vElectrical } from './electrical';
import { Battery9vRender3D } from './model3d';

/** Plugin lengkap Baterai 9V — perakitan meta + elektrik + render 3D. */
export const battery9vPlugin: ComponentPlugin = {
  ...BATTERY_9V_META,
  Render3D: Battery9vRender3D,
  electrical: battery9vElectrical,
};
