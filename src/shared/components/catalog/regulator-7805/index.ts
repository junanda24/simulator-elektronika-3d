import type { ComponentPlugin } from '../../../types';
import { REGULATOR_7805_META } from './meta';
import { regulator7805Electrical } from './electrical';
import { Regulator7805Render3D } from './model3d';

/** Plugin lengkap Regulator L7805 — perakitan meta + elektrik + render 3D. */
export const regulator7805Plugin: ComponentPlugin = {
  ...REGULATOR_7805_META,
  Render3D: Regulator7805Render3D,
  electrical: regulator7805Electrical,
};
