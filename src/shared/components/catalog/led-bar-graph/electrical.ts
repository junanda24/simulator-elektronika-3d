import type { ComponentElectrical } from '../../../types';
import { combineElectrical, createPwlDiode } from '../../pwlDiode';

/** Arus maju maksimum per segmen DC-10EWA (datasheet: IF maks DC 30 mA). */
const MAX_SEGMENT_A = 0.03;
/** Tegangan balik maksimum per segmen (datasheet: VR 5 V). */
const MAX_REVERSE_V = 5;

/**
 * Sepuluh LED PWL independen (satu per segmen) — tanpa multiplexing,
 * setiap segmen di-stamp sendiri-sendiri persis pola 7-segment proyek.
 * Stamp & arus cabang memakai pabrik PWL bersama (Vf 2,0 V, Ron 5 Ω
 * sesuai model riset DC-10EWA; kunci arus 's1'…'s10' untuk model 3D).
 * Aturan kerusakan ditulis khusus di sini agar memakai keluarga aturan
 * LED proyek (LED_OVERCURRENT / LED_REVERSE_BREAKDOWN, bukan keluarga
 * dioda) dengan teks autopsy khusus bar graph — combineElectrical
 * hanya meminjam stamp & computeCurrents-nya.
 */
const parts = Array.from({ length: 10 }, (_, i) => {
  const seg = i + 1;
  return createPwlDiode({
    anodePin: `A${seg}`,
    cathodePin: `K${seg}`,
    vf: 2.0,
    ronOhms: 5,
    currentKey: `s${seg}`,
    maxCurrentA: MAX_SEGMENT_A,
    maxReverseV: MAX_REVERSE_V,
    // Judul/penjelasan pabrik tidak dipakai (checkDamage di-override
    // di bawah), tetapi wajib diisi oleh kontrak PwlDiodeOptions.
    overcurrentTitle: '',
    overcurrentExplanation: '',
  });
});
const combined = combineElectrical(parts);

export const ledBarGraphElectrical: ComponentElectrical = {
  stamp: combined.stamp,
  computeCurrents: combined.computeCurrents,

  checkDamage: (_instance, result) => {
    for (let seg = 1; seg <= 10; seg += 1) {
      const amps = result.branchCurrents[`s${seg}`] ?? 0;
      if (amps > MAX_SEGMENT_A) {
        return {
          ruleId: 'LED_OVERCURRENT',
          titleId: 'Segmen Bar Graph Terbakar — Arus Berlebih',
          explanationId:
            'Setiap segmen bar graph adalah LED yang hanya tahan arus maju sekitar 30 mA. Menghubungkan pin segmen langsung ke sumber tegangan tanpa resistor pembatas membuat arus segmen melonjak dan membakarnya — dan karena kesepuluh segmen berada dalam satu paket, seluruh bar graph dianggap rusak. Pasang resistor seri (umumnya 220 Ω) pada setiap pin anoda segmen.',
          measured: amps * 1000,
          limit: MAX_SEGMENT_A * 1000,
          unit: 'mA',
        };
      }
      const va = result.pinVoltages[`A${seg}`] ?? 0;
      const vk = result.pinVoltages[`K${seg}`] ?? 0;
      if (vk - va > MAX_REVERSE_V) {
        return {
          ruleId: 'LED_REVERSE_BREAKDOWN',
          titleId: 'Segmen Bar Graph Rusak — Tegangan Balik',
          explanationId:
            'Tegangan balik pada segmen bar graph melebihi batas 5 V dan menembus isolasi LED segmen. Periksa arah pemasangan: anoda segmen ke-i adalah pin fisik i (baris bertanda anoda) dan katodanya pin fisik 21−i di baris seberang — jangan tertukar antar baris.',
          measured: vk - va,
          limit: MAX_REVERSE_V,
          unit: 'V',
        };
      }
    }
    return null;
  },
};
