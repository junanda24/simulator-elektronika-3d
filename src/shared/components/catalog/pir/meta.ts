import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Gerak PIR (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const PIR_META: ComponentMeta = {
  type: 'pir',
  name: 'Sensor Gerak PIR',
  category: 'sensor',
  descriptionId:
    'Sensor inframerah pasif (mis. HC-SR501): pin OUT menjadi HIGH (setegangan VCC) saat mendeteksi gerakan dan kembali LOW saat tidak ada gerakan. Klik kubah lensa pada model 3D untuk mensimulasikan gerakan.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -1], type: 'power' },
    { id: 'OUT', label: 'OUT (sinyal)', localPosition: [0, 0, 0], type: 'digital' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, 1], type: 'ground' },
  ],
};
