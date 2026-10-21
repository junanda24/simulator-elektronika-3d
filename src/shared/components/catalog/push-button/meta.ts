import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Push Button (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const PUSH_BUTTON_META: ComponentMeta = {
  type: 'push-button',
  name: 'Push Button (Tactile)',
  category: 'input',
  descriptionId:
    'Tombol tekan sesaat: pasangan kaki se-sisi selalu terhubung, dan sisi A terhubung ke sisi B hanya selama tombol ditekan. Klik dan tahan tombol 3D untuk menekan; Shift+klik mengunci tekanan (latching).',
  defaultProps: {},
  pins: [
    { id: 'A1', label: 'Kaki A1', localPosition: [-1.5, 0, -1], type: 'passive' },
    { id: 'A2', label: 'Kaki A2', localPosition: [-1.5, 0, 1], type: 'passive' },
    { id: 'B1', label: 'Kaki B1', localPosition: [1.5, 0, -1], type: 'passive' },
    { id: 'B2', label: 'Kaki B2', localPosition: [1.5, 0, 1], type: 'passive' },
  ],
};
