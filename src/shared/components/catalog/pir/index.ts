import type { ComponentPlugin } from '../../../types';
import { PIR_META } from './meta';
import { pirElectrical } from './electrical';
import { PirRender3D } from './model3d';

/** Plugin lengkap Sensor Gerak PIR — perakitan meta + elektrik + render 3D. */
export const pirPlugin: ComponentPlugin = {
  ...PIR_META,
  Render3D: PirRender3D,
  electrical: pirElectrical,
};
