import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  COLOR_TOKENS,
  MATERIAL_PARAMS,
  createMaterial3D,
  getMaterial3D,
  vivid,
  type MaterialClass3D,
} from '../materials3d';

// Fondasi gaya 3D (SPESIFIKASI-GAYA-3D §3/§4): tabel parameter harus
// tetap di dalam rentang terkunci dokumen, factory harus menghormati
// override, dan aturan warna fungsional tidak boleh bergeser hue.
const KELAS: MaterialClass3D[] = [
  'absWarna', 'plastikHitam', 'epoxyLed', 'pcb', 'karet',
  'kaca', 'metalPin', 'canAluminium', 'keramik', 'breadboardKrem',
];

describe('materials3d — tabel parameter §3', () => {
  it('semua 10 kelas material tersedia', () => {
    expect(Object.keys(MATERIAL_PARAMS).sort()).toEqual([...KELAS].sort());
  });

  it('parameter tiap kelas berada di dalam rentang spesifikasi', () => {
    const rentang: Record<MaterialClass3D, [number, number]> = {
      absWarna: [0.3, 0.38],
      plastikHitam: [0.35, 0.45],
      epoxyLed: [0.12, 0.2],
      pcb: [0.38, 0.45],
      karet: [0.75, 0.9],
      kaca: [0.05, 0.12],
      metalPin: [0.3, 0.45],
      canAluminium: [0.35, 0.5],
      keramik: [0.45, 0.55],
      breadboardKrem: [0.4, 0.5],
    };
    for (const kelas of KELAS) {
      const { roughness } = MATERIAL_PARAMS[kelas];
      const [min, max] = rentang[kelas];
      expect(roughness, kelas).toBeGreaterThanOrEqual(min);
      expect(roughness, kelas).toBeLessThanOrEqual(max);
    }
    expect(MATERIAL_PARAMS.metalPin.metalness).toBe(1);
    expect(MATERIAL_PARAMS.canAluminium.metalness).toBe(1);
    expect(MATERIAL_PARAMS.karet.clearcoat).toBe(0);
    expect(MATERIAL_PARAMS.epoxyLed.clearcoat).toBe(1);
  });

  it('plastikHitam memakai arang kebiruan terang, bukan hitam murni', () => {
    // Nilai berubah #1b1b1f → #222229 atas SPEK-WARNA-SEGAR (user:
    // warna lama terasa tua/pekat); syarat aslinya tetap: bukan #000000.
    const mat = createMaterial3D('plastikHitam');
    expect(`#${mat.color.getHexString()}`).toBe(COLOR_TOKENS.plastikHitam);
    expect(COLOR_TOKENS.plastikHitam).toBe('#222229');
  });
});

describe('materials3d — factory', () => {
  it('createMaterial3D menghasilkan MeshPhysicalMaterial dengan parameter kelas', () => {
    const mat = createMaterial3D('metalPin');
    expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(mat.metalness).toBe(1);
    expect(mat.roughness).toBe(MATERIAL_PARAMS.metalPin.roughness);
    expect(`#${mat.color.getHexString()}`).toBe(COLOR_TOKENS.metalPin);
  });

  it('override warna & opacity menang atas bawaan; opacity < 1 menyalakan transparansi', () => {
    const mat = createMaterial3D('epoxyLed', { color: '#ff2222', opacity: 0.6 });
    expect(`#${mat.color.getHexString()}`).toBe('#ff2222');
    expect(mat.opacity).toBe(0.6);
    expect(mat.transparent).toBe(true);
    const opak = createMaterial3D('absWarna');
    expect(opak.transparent).toBe(false);
  });

  it('getMaterial3D mengembalikan instance yang sama untuk kombinasi yang sama', () => {
    const a = getMaterial3D('pcb', { color: COLOR_TOKENS.unoTeal });
    const b = getMaterial3D('pcb', { color: COLOR_TOKENS.unoTeal });
    const c = getMaterial3D('pcb', { color: '#123456' });
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('materials3d — warna §4', () => {
  it('token fungsional terkunci utuh (gelang, kabel servo, rel, teal Uno, biru relay)', () => {
    // Nilai unoTeal/relayBlue berubah atas SPEK-WARNA-SEGAR (arah segar
    // user 2026-10-21): hue sama, lightness/chroma naik. Gelang & rel
    // adalah standar murni — nilainya TIDAK ikut berubah.
    expect(COLOR_TOKENS.resistorBands).toHaveLength(10);
    expect(COLOR_TOKENS.unoTeal).toBe('#00a6b0');
    expect(COLOR_TOKENS.relayBlue).toBe('#2b7de0');
    expect(COLOR_TOKENS.breadboardRailPlus).toBe('#d42a1e');
    expect(COLOR_TOKENS.breadboardRailMinus).toBe('#2456c8');
  });

  it('token emas & kabel FC-28 terkunci nilainya', () => {
    // Nilai berubah atas SPEK-WARNA-SEGAR §2 (emas antik → emas muda,
    // merah bata → merah bersih); peran token tidak berubah.
    expect(COLOR_TOKENS.goldPlated).toBe('#e4b93e');
    expect(COLOR_TOKENS.goldTrace).toBe('#be9736');
    expect(COLOR_TOKENS.brassScrew).toBe('#c29b45');
    expect(COLOR_TOKENS.cableRed).toBe('#e02b20');
  });

  it('token PCB board generik tersedia (SPEK-WARNA-SEGAR §2)', () => {
    expect(COLOR_TOKENS.esp32Pcb).toBe('#22335c');
    expect(COLOR_TOKENS.nodeMcuPcb).toBe('#2b3a67');
    expect(COLOR_TOKENS.picoPcb).toBe('#1f9d4d');
  });

  it('vivid menaikkan saturasi ±30% + mengangkat lightness, tanpa menggeser hue', () => {
    // Derivasi berubah atas SPEK-WARNA-SEGAR §3: rasio lama 1,125 tanpa
    // sentuhan lightness dibatalkan user (terasa tua/kusam).
    const before = new THREE.Color(COLOR_TOKENS.relayBlue);
    const after = new THREE.Color(vivid(COLOR_TOKENS.relayBlue));
    const hb = { h: 0, s: 0, l: 0 };
    const ha = { h: 0, s: 0, l: 0 };
    before.getHSL(hb, THREE.SRGBColorSpace);
    after.getHSL(ha, THREE.SRGBColorSpace);
    expect(ha.h).toBeCloseTo(hb.h, 3);
    expect(ha.s).toBeGreaterThan(hb.s);
    expect(ha.s / hb.s).toBeCloseTo(1.3, 2);
    // relayBlue L=0,52 sudah di atas pita tengah → lightness tidak berubah
    expect(ha.l).toBeCloseTo(hb.l, 3);
    // Warna gelap (L<0,5) wajib TERANGKAT menuju pita tengah
    const dark = new THREE.Color(vivid('#14632f'));
    const hd = { h: 0, s: 0, l: 0 };
    dark.getHSL(hd, THREE.SRGBColorSpace);
    expect(hd.l).toBeGreaterThan(0.23);
  });
});
