import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Kapasitor Elektrolit (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const CAPACITOR_META: ComponentMeta = {
  type: 'capacitor',
  name: 'Kapasitor Elektrolit 100µF',
  category: 'passive',
  descriptionId:
    'Kapasitor elektrolit terpolarisasi untuk menyimpan muatan dan menyaring riak catu daya; kaki plus (panjang) wajib menuju potensial yang lebih tinggi — memasang terbalik atau melebihi tegangan rating dapat membuat kapasitor meledak.',
  defaultProps: { capacitance: 100, voltageRating: 25 },
  pins: [
    { id: 'PLUS', label: 'Plus (+)', localPosition: [0, 0, -1], type: 'terminal' },
    { id: 'MINUS', label: 'Minus (-)', localPosition: [0, 0, 1], type: 'terminal' },
  ],
};
