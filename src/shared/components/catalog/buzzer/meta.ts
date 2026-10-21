import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Buzzer Aktif 5V (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const BUZZER_META: ComponentMeta = {
  type: 'buzzer',
  name: 'Buzzer Aktif 5V',
  category: 'output',
  descriptionId:
    'Buzzer aktif 5V yang berbunyi terus selama diberi tegangan searah dengan polaritas benar: kaki PLUS ke sisi positif dan MINUS ke ground. Polaritas terbalik membuat buzzer diam karena rangkaian osilator internalnya tidak bekerja.',
  defaultProps: {},
  pins: [
    { id: 'PLUS', label: 'Plus (+)', localPosition: [0, 0, -1], type: 'terminal' },
    { id: 'MINUS', label: 'Minus (-)', localPosition: [0, 0, 1], type: 'terminal' },
  ],
};
