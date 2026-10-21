import type { ComponentPlugin } from '../../../types';
import { RAIN_SENSOR_META } from './meta';
import { rainSensorElectrical } from './electrical';
import { RainSensorRender3D } from './model3d';

/** Plugin lengkap Sensor Hujan MH-RD — perakitan meta + elektrik + render 3D. */
export const rainSensorPlugin: ComponentPlugin = {
  ...RAIN_SENSOR_META,
  Render3D: RainSensorRender3D,
  electrical: rainSensorElectrical,
};
