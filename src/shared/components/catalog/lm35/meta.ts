import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Suhu LM35 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const LM35_META: ComponentMeta = {
  type: 'lm35',
  name: 'Sensor Suhu LM35',
  category: 'sensor',
  descriptionId:
    'Sensor suhu analog presisi: tegangan OUT naik linear 10 mV per derajat Celsius (25 °C → 0,25 V, 100 °C → 1,00 V) sehingga mudah dibaca analogRead. Seret badan sensor ke atas/bawah untuk mengubah suhu.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -1], type: 'power' },
    { id: 'OUT', label: 'OUT (analog)', localPosition: [0, 0, 0], type: 'analog' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, 1], type: 'ground' },
  ],
};
