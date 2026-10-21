import type { ComponentPlugin } from '../../../types';

/** Metadata katalog MOSFET kanal-N IRLZ44N (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const MOSFET_META: ComponentMeta = {
  type: 'mosfet',
  name: 'MOSFET IRLZ44N',
  category: 'passive',
  descriptionId:
    'MOSFET kanal-N level-logic IRLZ44N (paket TO-220): tegangan Gate terhadap Source (Vgs) membuka saluran Drain–Source — di atas ±4,5 V saluran terbuka penuh (RDS(on) ±0,03 Ω) sehingga beban ampere besar bisa disaklar langsung dari pin mikrokontroler tanpa arus gerbang. Urutan kaki dari muka bercetak: G-D-S; tab logam di belakang terhubung ke Drain.',
  defaultProps: {},
  pins: [
    { id: 'G', label: 'Gate (G)', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'D', label: 'Drain (D)', localPosition: [0, 0, 0], type: 'passive' },
    { id: 'S', label: 'Source (S)', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
