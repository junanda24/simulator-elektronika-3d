import type { ComponentPlugin } from '../../../types';
import { FUSE_META } from './meta';
import { fuseElectrical } from './electrical';
import { FuseRender3D } from './model3d';

/** Plugin lengkap Sekering (Fuse) — perakitan meta + elektrik + render 3D. */
export const fusePlugin: ComponentPlugin = {
  ...FUSE_META,
  Render3D: FuseRender3D,
  electrical: fuseElectrical,
};
