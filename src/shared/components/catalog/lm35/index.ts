import type { ComponentPlugin } from '../../../types';
import { LM35_META } from './meta';
import { lm35Electrical } from './electrical';
import { Lm35Render3D } from './model3d';

/** Plugin lengkap Sensor Suhu LM35 — perakitan meta + elektrik + render 3D. */
export const lm35Plugin: ComponentPlugin = {
  ...LM35_META,
  Render3D: Lm35Render3D,
  electrical: lm35Electrical,
};
