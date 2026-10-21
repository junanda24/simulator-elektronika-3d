import type { ComponentPlugin } from '../../../types';
import { DIODE_META } from './meta';
import { diodeElectrical } from './electrical';
import { DiodeRender3D } from './model3d';

/** Plugin lengkap Dioda Silikon 1N4007 — perakitan meta + elektrik + render 3D. */
export const diodePlugin: ComponentPlugin = {
  ...DIODE_META,
  Render3D: DiodeRender3D,
  electrical: diodeElectrical,
};
