import type { ComponentPlugin } from '../../../types';
import { LED_META } from './meta';
import { ledElectrical } from './electrical';
import { LedRender3D } from './model3d';

/** Plugin lengkap LED 5mm — perakitan meta + elektrik + render 3D. */
export const ledPlugin: ComponentPlugin = {
  ...LED_META,
  Render3D: LedRender3D,
  electrical: ledElectrical,
};
