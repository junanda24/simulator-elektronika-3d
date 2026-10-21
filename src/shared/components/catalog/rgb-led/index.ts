import type { ComponentPlugin } from '../../../types';
import { RGB_LED_META } from './meta';
import { rgbLedElectrical } from './electrical';
import { RgbLedRender3D } from './model3d';

/** Plugin lengkap LED RGB 5mm (Katoda Umum) — perakitan meta + elektrik + render 3D. */
export const rgbLedPlugin: ComponentPlugin = {
  ...RGB_LED_META,
  Render3D: RgbLedRender3D,
  electrical: rgbLedElectrical,
};
