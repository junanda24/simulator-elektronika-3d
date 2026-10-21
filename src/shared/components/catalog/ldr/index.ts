import type { ComponentPlugin } from '../../../types';
import { LDR_META } from './meta';
import { ldrElectrical } from './electrical';
import { LdrRender3D } from './model3d';

/** Plugin lengkap LDR (Sensor Cahaya) — perakitan meta + elektrik + render 3D. */
export const ldrPlugin: ComponentPlugin = {
  ...LDR_META,
  Render3D: LdrRender3D,
  electrical: ldrElectrical,
};
