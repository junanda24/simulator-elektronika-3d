import type { ComponentPlugin } from '../../../types';

/** Metadata katalog LED RGB 5mm katoda umum (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const RGB_LED_META: ComponentMeta = {
  type: 'rgb-led',
  name: 'LED RGB 5mm (Katoda Umum)',
  category: 'output',
  descriptionId:
    'LED RGB 5mm berkaki empat dengan katoda umum: kaki COM (terpanjang) terhubung ke GND, sedangkan kanal R, G, dan B masing-masing wajib diberi resistor pembatas ke sisi positif; campuran ketiga kanal menghasilkan warna gabungan.',
  defaultProps: {},
  pins: [
    { id: 'COM', label: 'Katoda Umum (COM)', localPosition: [0, 0, -1.5], type: 'terminal' },
    { id: 'R', label: 'Kanal Merah (R)', localPosition: [0, 0, -0.5], type: 'terminal' },
    { id: 'G', label: 'Kanal Hijau (G)', localPosition: [0, 0, 0.5], type: 'terminal' },
    { id: 'B', label: 'Kanal Biru (B)', localPosition: [0, 0, 1.5], type: 'terminal' },
  ],
};
