import type { ComponentPlugin } from '../../../types';

/** Metadata katalog resistor (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const RESISTOR_META: ComponentMeta = {
  type: 'resistor',
  name: 'Resistor',
  category: 'passive',
  descriptionId:
    'Komponen pasif yang menghambat arus listrik; nilai resistansinya (ohm) menentukan seberapa besar arus yang boleh mengalir dalam rangkaian.',
  defaultProps: { resistance: 220 },
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [-2, 0, 0], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [2, 0, 0], type: 'passive' },
  ],
};
