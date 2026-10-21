import type { ComponentElectrical } from '../../../types';
import { combineElectrical, createPwlDiode } from '../../pwlDiode';

/** Pin segmen sesuai urutan meta: A–G lalu titik desimal. */
const SEGMENT_PINS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'] as const;

/**
 * Display 7-segment katoda umum: delapan LED PWL independen (satu per
 * segmen), anoda = pin segmen, katoda bersama = COM. Setiap segmen
 * berperilaku seperti LED merah (Vf 2,0 V) dengan kunci arus huruf
 * kecilnya sendiri ('a'..'g', 'dp') untuk dibaca model 3D per segmen.
 */
export const sevenSegmentElectrical: ComponentElectrical = combineElectrical(
  SEGMENT_PINS.map((pin) =>
    createPwlDiode({
      anodePin: pin,
      cathodePin: 'COM',
      vf: 2.0,
      ronOhms: 10,
      currentKey: pin.toLowerCase(),
      maxCurrentA: 0.03,
      maxReverseV: 5,
      overcurrentTitle: 'Segmen Display Terbakar — Arus Berlebih',
      overcurrentExplanation:
        'Setiap segmen display adalah LED yang hanya tahan arus sekitar 20–30 mA. Menghubungkan pin segmen langsung ke sumber tegangan tanpa resistor pembatas membuat arus segmen display melonjak dan membakarnya. Pasang resistor seri (umumnya 220 Ω) pada setiap pin segmen atau pada pin COM.',
      reverseTitle: 'Segmen Display Rusak — Tegangan Balik',
      reverseExplanation:
        'Tegangan balik pada segmen display melebihi batas 5 V dan menembus isolasi LED segmen. Display ini berjenis katoda umum: pin COM wajib ke ground dan pin segmen diberi tegangan positif, bukan sebaliknya.',
    }),
  ),
);
