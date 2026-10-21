import type { ComponentPlugin } from '../../../types';
import { NTC_THERMISTOR_META } from './meta';
import { ntcThermistorElectrical } from './electrical';
import { NtcThermistorRender3D } from './model3d';

/** Plugin lengkap Termistor NTC 10K — perakitan meta + elektrik + render 3D. */
export const ntcThermistorPlugin: ComponentPlugin = {
  ...NTC_THERMISTOR_META,
  Render3D: NtcThermistorRender3D,
  electrical: ntcThermistorElectrical,
};
