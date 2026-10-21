import type { ComponentPlugin } from '../../../types';
import { MOSFET_META } from './meta';
import { mosfetElectrical } from './electrical';
import { MosfetRender3D } from './model3d';

/** Plugin lengkap MOSFET IRLZ44N — perakitan meta + elektrik + render 3D. */
export const mosfetPlugin: ComponentPlugin = {
  ...MOSFET_META,
  Render3D: MosfetRender3D,
  electrical: mosfetElectrical,
};
