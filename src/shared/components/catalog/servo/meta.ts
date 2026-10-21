import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Motor Servo SG90 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const SERVO_META: ComponentMeta = {
  type: 'servo',
  name: 'Motor Servo SG90',
  category: 'actuator',
  descriptionId:
    'Motor servo SG90 yang porosnya berputar ke sudut 0–180° mengikuti sinyal pada pin SIG. Sambungkan VCC ke 5V dan GND ke ground, lalu gerakkan sudutnya dari sketch memakai analogWrite (PWM) pada pin sinyal.',
  defaultProps: {},
  pins: [
    { id: 'GND', label: 'GND (kabel cokelat)', localPosition: [0, 0, -1], type: 'ground' },
    { id: 'VCC', label: 'VCC (kabel merah)', localPosition: [0, 0, 0], type: 'power' },
    { id: 'SIG', label: 'Sinyal (kabel oranye)', localPosition: [0, 0, 1], type: 'digital' },
  ],
};
