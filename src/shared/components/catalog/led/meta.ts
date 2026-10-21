import type { ComponentPlugin } from '../../../types';

/** Metadata katalog LED (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const LED_META: ComponentMeta = {
  type: 'led-5mm',
  name: 'LED 5mm',
  category: 'output',
  descriptionId:
    'Dioda pemancar cahaya yang menyala saat dialiri arus maju dari anoda ke katoda; wajib memakai resistor seri sebagai pembatas arus agar tidak terbakar.',
  defaultProps: { color: 'red' },
  pins: [
    { id: 'ANODE', label: 'Anoda (+)', localPosition: [0, 0, -1], type: 'terminal' },
    { id: 'CATHODE', label: 'Katoda (-)', localPosition: [0, 0, 1], type: 'terminal' },
  ],
};
