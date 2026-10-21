import type { ComponentPlugin } from '../../../types';

/** Metadata katalog LED Bar Graph 10-Segment (tanpa Render3D & electrical). */
export type ComponentMeta = Omit<ComponentPlugin, 'Render3D' | 'electrical'>;

/**
 * Pemetaan pin fisik → segmen TERVERIFIKASI dari sumber primer:
 * Kingbright DSAD1426 Rev V.10A (28 Feb 2020), hal. 1 — "Package
 * Dimensions & Internal Circuit Diagram" (dibaca langsung dari gambar
 * PDF datasheet resmi, mirror X-ON, 21 Okt 2026):
 * - Gambar paket: pin 1 di sudut kiri bawah (ada tanda anoda /
 *   "Anode mark" + sudut terpancung), pin 1–10 berjajar di baris bawah
 *   (kiri→kanan), pin 20 di kiri atas, pin 11 di kanan atas.
 * - Diagram rangkaian internal: setiap segmen adalah satu LED
 *   independen; anoda segmen ke-i = pin fisik i, katoda segmen ke-i =
 *   pin fisik 21−i (pasangan 1↔20, 2↔19, …, 10↔11). TIDAK ada pin
 *   common — 20 pin = 10 anoda + 10 katoda.
 * Baris anoda di x lokal −1,5 dan baris katoda di +1,5 (jarak baris
 * datasheet 7,5 mm ≈ rentangan kanal breadboard 3 satuan, pola DIP
 * relay/push-button); segmen 1 di z −4,5 (ujung tanda anoda).
 */
const segmentPin = (
  seg: number,
  kind: 'A' | 'K',
): { id: string; label: string; localPosition: [number, number, number]; type: 'terminal' } => {
  const physical = kind === 'A' ? seg : 21 - seg;
  return {
    id: `${kind}${seg}`,
    label: `${kind === 'A' ? 'Anoda' : 'Katoda'} Segmen ${seg} (pin fisik ${physical})`,
    localPosition: [kind === 'A' ? -1.5 : 1.5, 0, seg - 5.5],
    type: 'terminal',
  };
};

const PINS: ComponentMeta['pins'] = [];
for (let seg = 1; seg <= 10; seg += 1) PINS.push(segmentPin(seg, 'A'));
for (let seg = 1; seg <= 10; seg += 1) PINS.push(segmentPin(seg, 'K'));

export const LED_BAR_GRAPH_META: ComponentMeta = {
  type: 'led-bar-graph',
  name: 'LED Bar Graph 10-Segment (DC-10EWA)',
  category: 'display',
  descriptionId:
    'Bar graph LED 10 segmen Kingbright DC-10EWA: sepuluh LED merah independen dalam satu paket DIP-20 — setiap segmen punya anoda dan katoda sendiri (anoda segmen 1–10 = pin fisik 1–10; katoda segmen 1–10 = pin fisik 20–11), tanpa pin common dan tanpa multiplexing. Setiap segmen menyala lewat resistor pembatas seperti LED biasa (Vf ±2,0 V, maks 30 mA). Penyederhanaan simulator: aturan kerusakan berlaku per paket — satu segmen terbakar berarti seluruh bar graph dianggap rusak.',
  defaultProps: {},
  pins: PINS,
};
