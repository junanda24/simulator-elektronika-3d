import type { ComponentPlugin } from '../../../types';

/** Metadata katalog Baterai 9V (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

/**
 * Baterai 9V 6LR61: badan 48,5 × 26,5 × 17,5 mm (19,1 × 10,4 × 6,9
 * satuan) berdiri di alas di samping breadboard — ia TIDAK menancap
 * ke lubang papan. Kedua terminal snap ada di muka atas: stud jantan
 * (+) lebih kecil di x −2,5 dan soket betina (−) lebih besar di
 * x +2,5, jarak pusat terminal 12,7 mm (5 satuan; datasheet
 * 12,45–12,95 mm). Posisi lokal pin menunjuk puncak terminal
 * (y = tinggi badan 19,1 + tinggi snap ±0,5) agar ujung kabel
 * mendarat di terminalnya.
 */
export const BATTERY_9V_META: ComponentMeta = {
  type: 'battery-9v',
  name: 'Baterai 9V (6LR61)',
  category: 'passive',
  descriptionId:
    'Baterai alkalin 9V tipe 6LR61 sebagai sumber daya mandiri di luar board: terminal snap (+) yang kecil dan (−) yang besar di muka atasnya menjadi ujung kabel menuju rel atau rangkaian (mis. memberi makan regulator L7805 untuk rel 5V mandiri). Arus keluar di atas 1 A — apalagi terminal + dan − terhubung langsung — membuatnya panas dan rusak. Simplifikasi model: tegangan tetap 9,0 V dan kapasitas tak terbatas (kurva discharge tidak dimodelkan), resistansi internal tetap 1,5 Ω.',
  defaultProps: {},
  pins: [
    { id: 'PLUS', label: 'Terminal + (snap kecil)', localPosition: [-2.5, 19.6, 0], type: 'power' },
    { id: 'MINUS', label: 'Terminal − (snap besar)', localPosition: [2.5, 19.6, 0], type: 'ground' },
  ],
};
