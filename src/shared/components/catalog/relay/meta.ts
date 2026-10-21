import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Modul Relay 5V (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const RELAY_META: ComponentMeta = {
  type: 'relay',
  name: 'Modul Relay 5V',
  category: 'actuator',
  descriptionId:
    'Modul relay 5V: beri VCC dan GND, lalu sinyal HIGH (di atas 2,5 V) pada pin IN menggerakkan koil dan memindahkan kontak dari NC ke NO — rangkaian terpisah pun dapat dinyalakan oleh mikrokontroler. LED indikator pada modul menyala saat relay aktif.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (koil +)', localPosition: [-1.5, 0, -1], type: 'power' },
    { id: 'IN', label: 'IN (sinyal)', localPosition: [-1.5, 0, 0], type: 'digital' },
    { id: 'GND', label: 'GND (koil -)', localPosition: [-1.5, 0, 1], type: 'ground' },
    { id: 'COM', label: 'COM (kontak umum)', localPosition: [1.5, 0, -1], type: 'terminal' },
    { id: 'NO', label: 'NO (normally open)', localPosition: [1.5, 0, 0], type: 'terminal' },
    { id: 'NC', label: 'NC (normally closed)', localPosition: [1.5, 0, 1], type: 'terminal' },
  ],
};
