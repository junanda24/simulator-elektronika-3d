import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Sensor Ultrasonik HC-SR04 (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

export const HC_SR04_META: ComponentMeta = {
  type: 'hc-sr04',
  name: 'Sensor Ultrasonik HC-SR04',
  category: 'sensor',
  descriptionId:
    'Sensor jarak ultrasonik: beri pulsa HIGH ≥10 µs pada TRIG, pin ECHO membalas pulsa HIGH selebar jarak × 58 µs — ukur dengan pulseIn(pinEcho, HIGH), jarak (cm) = lebar / 58. Rentang 2–400 cm. Butuh catu 5 V, dan ECHO mengeluarkan 5 V: untuk board 3,3 V (ESP32/NodeMCU/Pico) lewatkan pembagi tegangan 1k/2k agar pin board tidak rusak. Pilih modul di meja lalu atur jarak rintangan (atau mode tanpa rintangan) pada panel gizmo-nya.',
  defaultProps: {},
  pins: [
    { id: 'VCC', label: 'VCC (daya 5V)', localPosition: [0, 0, -1.5], type: 'power' },
    { id: 'TRIG', label: 'TRIG (pemicu)', localPosition: [0, 0, -0.5], type: 'digital' },
    { id: 'ECHO', label: 'ECHO (balasan)', localPosition: [0, 0, 0.5], type: 'digital' },
    { id: 'GND', label: 'GND', localPosition: [0, 0, 1.5], type: 'ground' },
  ],
};
