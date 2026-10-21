import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Hujan MH-RD (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const RAIN_SENSOR_META: ComponentMeta = {
  type: 'rain-sensor',
  name: 'Sensor Hujan MH-RD',
  category: 'sensor',
  descriptionId:
    'Modul sensor hujan MH-RD: papan deteksi berjejak sisir (interdigitasi) terhubung ke modul komparator LM393 — makin basah papan, makin RENDAH tegangan analog AO, dan keluaran digital DO aktif-RENDAH saat kebasahan melewati ambang trimpot. Papan deteksi digambar rata di samping breadboard seperti benda aslinya. Seret panel gizmo untuk mengubah kebasahan.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -1.5], type: 'power' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, -0.5], type: 'ground' },
    { id: 'DO', label: 'DO (digital)', localPosition: [0, 0, 0.5], type: 'digital' },
    { id: 'AO', label: 'AO (analog)', localPosition: [0, 0, 1.5], type: 'analog' },
  ],
};
