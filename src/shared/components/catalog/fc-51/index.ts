import type { ComponentPlugin } from '../../../types';
import { FC51_META } from './meta';
import { fc51Electrical } from './electrical';
import { Fc51Render3D } from './model3d';

/** Plugin lengkap Sensor Halangan IR FC-51 — perakitan meta + elektrik + render 3D. */
export const fc51Plugin: ComponentPlugin = {
  ...FC51_META,
  Render3D: Fc51Render3D,
  electrical: fc51Electrical,
};
