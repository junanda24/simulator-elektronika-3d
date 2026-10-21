import type { ComponentPlugin } from '../../../types';
import { MQ2_META } from './meta';
import { mq2Electrical } from './electrical';
import { Mq2Render3D } from './model3d';

/** Plugin lengkap Sensor Gas MQ-2 — perakitan meta + elektrik + render 3D. */
export const mq2Plugin: ComponentPlugin = {
  ...MQ2_META,
  Render3D: Mq2Render3D,
  electrical: mq2Electrical,
};
