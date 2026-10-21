import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Hall KY-003 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const KY003_META: ComponentMeta = {
  type: 'ky-003',
  name: 'Sensor Hall A3144 (KY-003)',
  category: 'sensor',
  descriptionId:
    'Modul sensor Hall KY-003 (IC A3144): saklar magnet solid-state — keluaran S aktif-RENDAH saat kutub selatan magnet didekatkan ke muka bermerek IC. S adalah keluaran OPEN-COLLECTOR: saat aktif S ditarik ke GND, saat tidak aktif S melayang (impedansi tinggi murni), jadi sketch wajib memakai pinMode INPUT_PULLUP agar terbaca HIGH stabil. Klik modul untuk mendekatkan atau menjauhkan magnet. Catu modul 4,5–24 V — pada board 3,3 V modul ini berada di bawah ratingnya.',
  defaultProps: {},
  pins: [
    { id: 'GND', label: '− (GND)', localPosition: [0, 0, -1], type: 'ground' },
    { id: 'VCC', label: '+ (VCC)', localPosition: [0, 0, 0], type: 'power' },
    { id: 'S', label: 'S (sinyal)', localPosition: [0, 0, 1], type: 'digital' },
  ],
};
