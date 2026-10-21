import type { ComponentPlugin } from '../../../types';
import { BUZZER_META } from './meta';
import { buzzerElectrical } from './electrical';
import { BuzzerRender3D } from './model3d';

/** Plugin lengkap Buzzer Aktif 5V — perakitan meta + elektrik + render 3D. */
export const buzzerPlugin: ComponentPlugin = {
  ...BUZZER_META,
  Render3D: BuzzerRender3D,
  electrical: buzzerElectrical,
};
