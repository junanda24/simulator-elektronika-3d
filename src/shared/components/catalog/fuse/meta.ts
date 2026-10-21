import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sekering/Fuse (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const FUSE_META: ComponentMeta = {
  type: 'fuse',
  name: 'Sekering (Fuse) 500mA',
  category: 'passive',
  descriptionId:
    'Sekering pelindung rangkaian: kawat tipis di dalam tabung kaca meleleh dan memutus rangkaian saat arus melebihi rating 500 mA, misalnya karena korsleting. Setelah putus, sekering harus diganti dan penyebab kelebihan arus diperbaiki dulu.',
  defaultProps: { rating: 500 },
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
