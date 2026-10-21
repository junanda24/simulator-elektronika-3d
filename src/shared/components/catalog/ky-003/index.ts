import type { ComponentPlugin } from '../../../types';
import { KY003_META } from './meta';
import { ky003Electrical } from './electrical';
import { Ky003Render3D } from './model3d';

/** Plugin lengkap Sensor Hall KY-003 — perakitan meta + elektrik + render 3D. */
export const ky003Plugin: ComponentPlugin = {
  ...KY003_META,
  Render3D: Ky003Render3D,
  electrical: ky003Electrical,
};
