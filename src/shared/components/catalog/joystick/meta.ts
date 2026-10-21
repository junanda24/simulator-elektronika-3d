import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Joystick Analog (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const JOYSTICK_META: ComponentMeta = {
  type: 'joystick',
  name: 'Joystick Analog',
  category: 'input',
  descriptionId:
    'Modul joystick dua sumbu: dua potensiometer 5 kΩ menghasilkan tegangan analog VRX dan VRY mengikuti kemiringan tuas, plus tombol tekan SW yang menghubungkan pin ke GND saat ditekan. Seret tuas pada model 3D untuk menggerakkan, Shift+klik untuk menekan tombolnya.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya)', localPosition: [0, 0, -2], type: 'power' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, -1], type: 'ground' },
    { id: 'VRX', label: 'VRX (analog X)', localPosition: [0, 0, 0], type: 'analog' },
    { id: 'VRY', label: 'VRY (analog Y)', localPosition: [0, 0, 1], type: 'analog' },
    { id: 'SW', label: 'SW (tombol)', localPosition: [0, 0, 2], type: 'digital' },
  ],
};
