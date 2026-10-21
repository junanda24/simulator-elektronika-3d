import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Reed Switch (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const REED_SWITCH_META: ComponentMeta = {
  type: 'reed-switch',
  name: 'Reed Switch (Saklar Magnet)',
  category: 'input',
  descriptionId:
    'Saklar magnet MKA14103 (Form A, normally open): dua bilah feromagnetik pipih di dalam kapsul kaca 2×14 mm saling menempel (±0,1 Ω) hanya saat magnet didekatkan, dan terlepas saat magnet dijauhkan. Tanpa polaritas. Klik kapsul untuk mendekatkan atau menjauhkan magnet. Arus kontak di atas 0,5 A dapat melengketkan bilah secara permanen.',
  defaultProps: {},
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [-3, 0, 0], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [3, 0, 0], type: 'passive' },
  ],
};
