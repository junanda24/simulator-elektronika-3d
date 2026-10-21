import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Gas MQ-2 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const MQ2_META: ComponentMeta = {
  type: 'mq2',
  name: 'Sensor Gas MQ-2',
  category: 'sensor',
  descriptionId:
    'Modul sensor gas MQ-2: elemen SnO2 berpemanas (menarik ±150 mA nyata dari rel catu) yang resistansinya turun saat ada gas mudah terbakar/asap — AO naik mengikuti konsentrasi, dan keluaran digital DO aktif-RENDAH saat melewati ambang trimpot. Satu nilai ppm gabungan tanpa selektivitas antar-gas, seperti sifat aslinya. Perhatian: urutan sablon pin berbeda antar-klon modul; di sini VCC-GND-DO-AO.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -1.5], type: 'power' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, -0.5], type: 'ground' },
    { id: 'DO', label: 'DO (digital)', localPosition: [0, 0, 0.5], type: 'digital' },
    { id: 'AO', label: 'AO (analog)', localPosition: [0, 0, 1.5], type: 'analog' },
  ],
};
