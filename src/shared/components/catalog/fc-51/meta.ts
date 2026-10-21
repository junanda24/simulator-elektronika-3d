import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Halangan IR FC-51 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const FC51_META: ComponentMeta = {
  type: 'fc-51',
  name: 'Sensor Halangan IR FC-51',
  category: 'sensor',
  descriptionId:
    'Modul pendeteksi halangan inframerah FC-51: LED pemancar IR menyala terus dan penerima memantau pantulannya (jangkauan asli 2–30 cm, sudut 35°). OUT aktif-RENDAH: HIGH setegangan VCC saat jalan bebas, LOW (0 V) saat ada halangan — ambang trimpot pada model ini tetap ±20 cm. Geser panel gizmo untuk mengubah jarak halangan. Catu 3,3–5 V; di atas 5,5 V modul rusak.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -1], type: 'power' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, 0], type: 'ground' },
    { id: 'OUT', label: 'OUT (sinyal)', localPosition: [0, 0, 1], type: 'digital' },
  ],
};
