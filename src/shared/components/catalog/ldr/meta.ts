import type { ComponentPlugin } from '../../../types';

/** Metadata katalog LDR (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const LDR_META: ComponentMeta = {
  type: 'ldr',
  name: 'LDR (Sensor Cahaya)',
  category: 'sensor',
  descriptionId:
    'Light Dependent Resistor: resistansinya turun saat terkena cahaya (sekitar 200 Ω saat terang, hingga 20 kΩ saat gelap), lazim dipakai sebagai pembagi tegangan untuk sensor cahaya. Seret badan sensor ke atas/bawah untuk mengubah intensitas cahaya.',
  defaultProps: {},
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
