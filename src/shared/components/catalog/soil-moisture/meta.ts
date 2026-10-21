import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Kelembaban Tanah (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const SOIL_MOISTURE_META: ComponentMeta = {
  type: 'soil-moisture',
  name: 'Sensor Kelembaban Tanah',
  category: 'sensor',
  descriptionId:
    'Sensor kelembaban tanah kapasitif/resistif: keluaran analog AO berbanding terbalik dengan kelembaban — tanah kering AO mendekati VCC, tanah basah AO mendekati 0 V. Seret papan sensor ke atas/bawah untuk mengubah kelembaban.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -1], type: 'power' },
    { id: 'AO', label: 'AO (analog)', localPosition: [0, 0, 0], type: 'analog' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, 1], type: 'ground' },
  ],
};
