import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Motor DC Kecil (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const DC_MOTOR_META: ComponentMeta = {
  type: 'dc-motor',
  name: 'Motor DC Kecil',
  category: 'actuator',
  descriptionId:
    'Motor DC kecil yang berputar saat dialiri arus dari kaki PLUS ke MINUS. Klik motornya untuk mengunci poros (stall): poros yang terkunci menarik arus berlebih dan dapat membakar motor, persis seperti di dunia nyata.',
  defaultProps: {},
  pins: [
    { id: 'PLUS', label: 'Plus (+)', localPosition: [0, 0, -1], type: 'terminal' },
    { id: 'MINUS', label: 'Minus (-)', localPosition: [0, 0, 1], type: 'terminal' },
  ],
};
