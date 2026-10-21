import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Potensiometer (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const POTENTIOMETER_META: ComponentMeta = {
  type: 'potentiometer',
  name: 'Potensiometer 10k',
  category: 'input',
  descriptionId:
    'Resistor variabel tiga kaki: putaran knop (alpha) membagi resistansi total antara kaki A–Wiper dan Wiper–B, lazim dipakai sebagai pembagi tegangan untuk input analog. Seret knop 3D ke atas/bawah untuk memutar.',
  defaultProps: { value: 10000 },
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'WIPER', label: 'Wiper (tengah)', localPosition: [0, 0, 0], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
