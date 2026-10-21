import type { ComponentPlugin } from '../../../types';
import { CAPACITOR_META } from './meta';
import { capacitorElectrical } from './electrical';
import { CapacitorRender3D } from './model3d';

/** Plugin lengkap Kapasitor Elektrolit 100µF — perakitan meta + elektrik + render 3D. */
export const capacitorPlugin: ComponentPlugin = {
  ...CAPACITOR_META,
  Render3D: CapacitorRender3D,
  electrical: capacitorElectrical,
};
