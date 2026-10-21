import { combineElectrical, createPwlDiode } from '../../pwlDiode';

/** Penjelasan umum tegangan balik untuk kanal LED RGB (PIV 5 V). */
function reverseExplanation(channel: string): string {
  return `Tegangan balik pada kanal ${channel} melebihi batas Peak Inverse Voltage LED (5 V) dan menembus isolasi diodanya. Periksa polaritas: katoda umum (COM) harus ke sisi negatif dan anoda kanal ke sisi positif lewat resistor.`;
}

function overcurrentExplanation(channel: string): string {
  return `Arus kanal ${channel} melebihi batas aman LED (30 mA) dan membakar semikonduktor kanal tersebut. Setiap kanal LED RGB wajib memakai resistor seri sendiri (umumnya 220 Ω) sebagai pembatas arus.`;
}

/**
 * LED RGB katoda umum = tiga dioda PWL berbagi katoda 'COM':
 * R (Vf 2,0 V), G (Vf 2,2 V), B (Vf 3,0 V); Ron 5 Ω, batas 30 mA per kanal.
 */
export const rgbLedElectrical = combineElectrical([
  createPwlDiode({
    anodePin: 'R',
    cathodePin: 'COM',
    vf: 2.0,
    ronOhms: 5,
    currentKey: 'r',
    maxCurrentA: 0.03,
    maxReverseV: 5,
    overcurrentTitle: 'Kanal Merah LED RGB Terbakar — Arus Berlebih',
    overcurrentExplanation: overcurrentExplanation('merah'),
    reverseTitle: 'Kanal Merah LED RGB Rusak — Tegangan Balik',
    reverseExplanation: reverseExplanation('merah'),
  }),
  createPwlDiode({
    anodePin: 'G',
    cathodePin: 'COM',
    vf: 2.2,
    ronOhms: 5,
    currentKey: 'g',
    maxCurrentA: 0.03,
    maxReverseV: 5,
    overcurrentTitle: 'Kanal Hijau LED RGB Terbakar — Arus Berlebih',
    overcurrentExplanation: overcurrentExplanation('hijau'),
    reverseTitle: 'Kanal Hijau LED RGB Rusak — Tegangan Balik',
    reverseExplanation: reverseExplanation('hijau'),
  }),
  createPwlDiode({
    anodePin: 'B',
    cathodePin: 'COM',
    vf: 3.0,
    ronOhms: 5,
    currentKey: 'b',
    maxCurrentA: 0.03,
    maxReverseV: 5,
    overcurrentTitle: 'Kanal Biru LED RGB Terbakar — Arus Berlebih',
    overcurrentExplanation: overcurrentExplanation('biru'),
    reverseTitle: 'Kanal Biru LED RGB Rusak — Tegangan Balik',
    reverseExplanation: reverseExplanation('biru'),
  }),
]);
