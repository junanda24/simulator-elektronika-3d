import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Suara KY-038 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const SOUND_SENSOR_META: ComponentMeta = {
  type: 'sound-sensor',
  name: 'Sensor Suara KY-038',
  category: 'sensor',
  descriptionId:
    'Modul sensor suara KY-038 (mikrofon electret + komparator LM393): yang dimodelkan hanya TINGKAT kebisingan lingkungan sebagai level DC — A0 sebanding intensitas suara dan D0 menjadi HIGH saat melewati ambang trimpot; gelombang audio tidak dimodelkan sama sekali. Seret panel gizmo untuk mengubah kebisingan. Urutan pin header mengikuti sablon umum modul: A0-G-+-D0.',
  defaultProps: {},
  pins: [
    { id: 'AO', label: 'A0 (analog)', localPosition: [0, 0, -1.5], type: 'analog' },
    { id: 'GND', label: 'G (GND)', localPosition: [0, 0, -0.5], type: 'ground' },
    { id: 'VCC', label: '+ (VCC)', localPosition: [0, 0, 0.5], type: 'power' },
    { id: 'DO', label: 'D0 (digital)', localPosition: [0, 0, 1.5], type: 'digital' },
  ],
};
