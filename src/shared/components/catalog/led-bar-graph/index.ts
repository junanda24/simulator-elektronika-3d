import type { ComponentPlugin } from '../../../types';
import { LED_BAR_GRAPH_META } from './meta';
import { ledBarGraphElectrical } from './electrical';
import { LedBarGraphRender3D } from './model3d';

/** Plugin lengkap LED Bar Graph 10-Segment — perakitan meta + elektrik + render 3D. */
export const ledBarGraphPlugin: ComponentPlugin = {
  ...LED_BAR_GRAPH_META,
  Render3D: LedBarGraphRender3D,
  electrical: ledBarGraphElectrical,
};
