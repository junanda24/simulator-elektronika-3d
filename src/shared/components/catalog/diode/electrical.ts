import { createPwlDiode } from '../../pwlDiode';

/**
 * Dioda silikon 1N4007 — model PWL dua-keadaan dari pabrik bersama:
 * Vf 0,7 V, Ron 2 Ω, arus maju maksimum 1 A, PIV 1000 V.
 */
export const diodeElectrical = createPwlDiode({
  anodePin: 'ANODE',
  cathodePin: 'CATHODE',
  vf: 0.7,
  ronOhms: 2,
  currentKey: 'main',
  maxCurrentA: 1,
  maxReverseV: 1000,
  overcurrentTitle: 'Dioda Terbakar — Arus Berlebih',
  overcurrentExplanation:
    'Dioda 1N4007 hanya mampu mengalirkan arus maju maksimum 1 A. Arus berlebih membuat sambungan PN kepanasan dan rusak permanen; batasi arus dengan resistor seri atau beban yang sesuai.',
  reverseTitle: 'Dioda Jebol — Tegangan Balik Melebihi Batas',
  reverseExplanation:
    'Tegangan balik melebihi rating PIV 1N4007 (1000 V) menembus daerah deplesi dan merusak dioda. Pastikan tegangan balik pada rangkaian tidak melampaui rating komponen.',
});
