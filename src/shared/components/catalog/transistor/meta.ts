import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Transistor NPN 2N2222 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const TRANSISTOR_META: ComponentMeta = {
  type: 'transistor',
  name: 'Transistor NPN 2N2222',
  category: 'passive',
  descriptionId:
    'Transistor NPN 2N2222 sebagai saklar/penguat: arus basis kecil yang masuk ke B dan keluar lewat E mengendalikan arus kolektor yang jauh lebih besar mengikuti Ic = β × Ib; urutan kaki dari sisi datar adalah E-B-C.',
  defaultProps: { beta: 100 },
  pins: [
    { id: 'E', label: 'Emitor (E)', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'B', label: 'Basis (B)', localPosition: [0, 0, 0], type: 'passive' },
    { id: 'C', label: 'Kolektor (C)', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
