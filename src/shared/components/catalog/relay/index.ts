import type { ComponentPlugin } from '../../../types';
import { RELAY_META } from './meta';
import { relayElectrical } from './electrical';
import { RelayRender3D } from './model3d';

/** Plugin lengkap Modul Relay 5V — perakitan meta + elektrik + render 3D. */
export const relayPlugin: ComponentPlugin = {
  ...RELAY_META,
  Render3D: RelayRender3D,
  electrical: relayElectrical,
};
