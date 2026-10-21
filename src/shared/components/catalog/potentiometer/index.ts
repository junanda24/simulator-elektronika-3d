import type { ComponentPlugin } from '../../../types';
import { POTENTIOMETER_META } from './meta';
import { potentiometerElectrical } from './electrical';
import { PotentiometerRender3D } from './model3d';

/** Plugin lengkap Potensiometer 10k — perakitan meta + elektrik + render 3D. */
export const potentiometerPlugin: ComponentPlugin = {
  ...POTENTIOMETER_META,
  Render3D: PotentiometerRender3D,
  electrical: potentiometerElectrical,
};
