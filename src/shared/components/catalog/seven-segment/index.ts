import type { ComponentPlugin } from '../../../types';
import { SEVEN_SEGMENT_META } from './meta';
import { sevenSegmentElectrical } from './electrical';
import { SevenSegmentRender3D } from './model3d';

/** Plugin lengkap Display 7-Segment — perakitan meta + elektrik + render 3D. */
export const sevenSegmentPlugin: ComponentPlugin = {
  ...SEVEN_SEGMENT_META,
  Render3D: SevenSegmentRender3D,
  electrical: sevenSegmentElectrical,
};
