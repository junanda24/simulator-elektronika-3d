import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Termistor NTC 10K (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const NTC_THERMISTOR_META: ComponentMeta = {
  type: 'ntc-thermistor',
  name: 'Termistor NTC 10K',
  category: 'sensor',
  descriptionId:
    'Termistor NTC 10K (MF52A1 103F3950): resistansinya TURUN saat suhu naik mengikuti kurva eksponensial B = 3950 — 10 kΩ pada 25 °C, ±58 kΩ pada −10 °C, ±1,3 kΩ pada 80 °C. Tanpa polaritas; lazim dipasang sebagai pembagi tegangan dengan resistor tetap lalu dibaca analogRead. Seret kepala sensor ke atas/bawah atau pakai panel gizmo untuk mengubah suhu.',
  defaultProps: {},
  pins: [
    { id: 'A', label: 'Kaki A', localPosition: [0, 0, -1], type: 'passive' },
    { id: 'B', label: 'Kaki B', localPosition: [0, 0, 1], type: 'passive' },
  ],
};
