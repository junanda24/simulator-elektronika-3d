import type { ComponentPlugin } from '../../../types';
import { RESISTOR_META } from './meta';
import { resistorElectrical } from './electrical';
import { ResistorRender3D } from './model3d';

/** Plugin lengkap Resistor — perakitan meta + elektrik + render 3D. */
export const resistorPlugin: ComponentPlugin = {
  ...RESISTOR_META,
  Render3D: ResistorRender3D,
  electrical: resistorElectrical,
};
