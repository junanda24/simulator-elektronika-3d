import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Regulator Tegangan L7805 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const REGULATOR_7805_META: ComponentMeta = {
  type: 'regulator-7805',
  name: 'Regulator Tegangan L7805',
  category: 'passive',
  descriptionId:
    'Regulator linear L7805 (paket TO-220): mengubah tegangan masukan 7–35 V menjadi keluaran tetap 5 V. Urutan kaki dari muka depan: 1 = INPUT, 2 = GND, 3 = OUTPUT — dan tab logam di belakang terhubung ke GND. Keluaran mengikuti Vout = min(5, Vin − 2) karena dropout ±2 V; regulator membuang selisih tegangan sebagai panas, jadi disipasi di atas ±2 W tanpa pendingin merusakkannya. Simplifikasi model: dropout tetap 2 V, tanpa riak, batas panas berupa ambang disipasi sesaat.',
  defaultProps: {},
  pins: [
    { id: 'IN', label: 'Input (pin 1)', localPosition: [0, 0, -1], type: 'power' },
    { id: 'GND', label: 'Ground (pin 2)', localPosition: [0, 0, 0], type: 'ground' },
    { id: 'OUT', label: 'Output 5V (pin 3)', localPosition: [0, 0, 1], type: 'power' },
  ],
};
