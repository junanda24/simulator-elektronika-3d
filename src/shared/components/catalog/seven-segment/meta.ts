import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Display 7-Segment (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const SEVEN_SEGMENT_META: ComponentMeta = {
  type: 'seven-segment',
  name: 'Display 7-Segment',
  category: 'output',
  descriptionId:
    'Display 7-segment katoda umum: setiap segmen (A–G dan titik desimal DP) adalah LED yang menyala saat pin segmennya diberi tegangan lewat resistor pembatas, dengan pin COM terhubung ke ground. Kombinasi segmen membentuk angka 0–9.',
  defaultProps: {},
  pins: [
    { id: 'A', label: 'Segmen A', localPosition: [0, 0, -4], type: 'terminal' },
    { id: 'B', label: 'Segmen B', localPosition: [0, 0, -3], type: 'terminal' },
    { id: 'C', label: 'Segmen C', localPosition: [0, 0, -2], type: 'terminal' },
    { id: 'D', label: 'Segmen D', localPosition: [0, 0, -1], type: 'terminal' },
    { id: 'E', label: 'Segmen E', localPosition: [0, 0, 0], type: 'terminal' },
    { id: 'F', label: 'Segmen F', localPosition: [0, 0, 1], type: 'terminal' },
    { id: 'G', label: 'Segmen G', localPosition: [0, 0, 2], type: 'terminal' },
    { id: 'DP', label: 'Titik Desimal (DP)', localPosition: [0, 0, 3], type: 'terminal' },
    { id: 'COM', label: 'COM (katoda umum)', localPosition: [0, 0, 4], type: 'terminal' },
  ],
};
