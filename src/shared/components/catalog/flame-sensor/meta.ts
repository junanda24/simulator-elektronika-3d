import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Api KY-026 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const FLAME_SENSOR_META: ComponentMeta = {
  type: 'flame-sensor',
  name: 'Sensor Api KY-026',
  category: 'sensor',
  descriptionId:
    'Modul sensor api KY-026 (fototransistor inframerah + komparator LM393): keluaran analog A0 TURUN saat api terdeteksi (tanpa api A0 mendekati VCC) — arah terbalik ini disengaja dari rangkaian aslinya; keluaran digital D0 aktif-RENDAH saat intensitas api melewati ambang trimpot. Seret panel gizmo untuk mengubah intensitas api.',
  defaultProps: {},
  pins: [
    { id: 'GND', label: 'G (GND)', localPosition: [0, 0, -1.5], type: 'ground' },
    { id: 'VCC', label: '+ (VCC)', localPosition: [0, 0, -0.5], type: 'power' },
    { id: 'DO', label: 'D0 (digital)', localPosition: [0, 0, 0.5], type: 'digital' },
    { id: 'AO', label: 'A0 (analog)', localPosition: [0, 0, 1.5], type: 'analog' },
  ],
};
