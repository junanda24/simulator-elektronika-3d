import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Dioda Silikon 1N4007 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const DIODE_META: ComponentMeta = {
  type: 'diode',
  name: 'Dioda Silikon 1N4007',
  category: 'passive',
  descriptionId:
    'Dioda silikon penyearah 1N4007: arus hanya mengalir dari anoda ke katoda (sisi gelang perak) dengan jatuh tegangan maju sekitar 0,7 V; dipasang terbalik, dioda memblokir arus.',
  defaultProps: {},
  pins: [
    { id: 'ANODE', label: 'Anoda (+)', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'CATHODE', label: 'Katoda (-)', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
