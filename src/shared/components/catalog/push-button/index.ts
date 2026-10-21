import type { ComponentPlugin } from '../../../types';
import { PUSH_BUTTON_META } from './meta';
import { pushButtonElectrical } from './electrical';
import { PushButtonRender3D } from './model3d';

/** Plugin lengkap Push Button (Tactile) — perakitan meta + elektrik + render 3D. */
export const pushButtonPlugin: ComponentPlugin = {
  ...PUSH_BUTTON_META,
  Render3D: PushButtonRender3D,
  electrical: pushButtonElectrical,
};
