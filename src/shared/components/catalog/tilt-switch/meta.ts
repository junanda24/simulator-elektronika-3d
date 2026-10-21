import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Saklar Miring (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const TILT_SWITCH_META: ComponentMeta = {
  type: 'tilt-switch',
  name: 'Saklar Miring (Tilt Switch)',
  category: 'input',
  descriptionId:
    'Saklar miring berisi bola logam yang menghubungkan dua kaki hanya saat tabungnya dimiringkan ke arah tertentu. Di simulator ini, klik tabungnya untuk memiringkan atau menegakkannya kembali.',
  defaultProps: {},
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
