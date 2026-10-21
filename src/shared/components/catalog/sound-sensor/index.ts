import type { ComponentPlugin } from '../../../types';
import { SOUND_SENSOR_META } from './meta';
import { soundSensorElectrical } from './electrical';
import { SoundSensorRender3D } from './model3d';

/** Plugin lengkap Sensor Suara KY-038 — perakitan meta + elektrik + render 3D. */
export const soundSensorPlugin: ComponentPlugin = {
  ...SOUND_SENSOR_META,
  Render3D: SoundSensorRender3D,
  electrical: soundSensorElectrical,
};
