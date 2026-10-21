import type { ComponentPlugin } from '../../../types';
import { TRANSISTOR_META } from './meta';
import { transistorElectrical } from './electrical';
import { TransistorRender3D } from './model3d';

/** Plugin lengkap Transistor NPN 2N2222 — perakitan meta + elektrik + render 3D. */
export const transistorPlugin: ComponentPlugin = {
  ...TRANSISTOR_META,
  Render3D: TransistorRender3D,
  electrical: transistorElectrical,
};
