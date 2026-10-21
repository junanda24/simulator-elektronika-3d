import type { ComponentPlugin } from '../../../types';
import { SOIL_MOISTURE_META } from './meta';
import { soilMoistureElectrical } from './electrical';
import { SoilMoistureRender3D } from './model3d';

/** Plugin lengkap Sensor Kelembaban Tanah — perakitan meta + elektrik + render 3D. */
export const soilMoisturePlugin: ComponentPlugin = {
  ...SOIL_MOISTURE_META,
  Render3D: SoilMoistureRender3D,
  electrical: soilMoistureElectrical,
};
