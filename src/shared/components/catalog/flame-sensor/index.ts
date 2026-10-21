import type { ComponentPlugin } from '../../../types';
import { FLAME_SENSOR_META } from './meta';
import { flameSensorElectrical } from './electrical';
import { FlameSensorRender3D } from './model3d';

/** Plugin lengkap Sensor Api KY-026 — perakitan meta + elektrik + render 3D. */
export const flameSensorPlugin: ComponentPlugin = {
  ...FLAME_SENSOR_META,
  Render3D: FlameSensorRender3D,
  electrical: flameSensorElectrical,
};
