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

  it('plastikHitam memakai #1B1B1F, bukan hitam murni', () => {
    const mat = createMaterial3D('plastikHitam');
    expect(`#${mat.color.getHexString()}`).toBe(COLOR_TOKENS.plastikHitam);
    expect(COLOR_TOKENS.plastikHitam).toBe('#1b1b1f');
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
    expect(COLOR_TOKENS.resistorBands).toHaveLength(10);
    expect(COLOR_TOKENS.unoTeal).toBe('#008184');
    expect(COLOR_TOKENS.relayBlue).toBe('#1d6fd1');
    expect(COLOR_TOKENS.breadboardRailPlus).toBe('#d42a1e');
    expect(COLOR_TOKENS.breadboardRailMinus).toBe('#2456c8');
  });

  it('token emas & kabel FC-28 terkunci nilainya', () => {
    expect(COLOR_TOKENS.goldPlated).toBe('#d4af37');
    expect(COLOR_TOKENS.goldTrace).toBe('#a8842c');
    expect(COLOR_TOKENS.brassScrew).toBe('#b08d3e');
    expect(COLOR_TOKENS.cableRed).toBe('#b91c1c');
  });

  it('vivid menaikkan saturasi ±12,5% tanpa menggeser hue', () => {
    const before = new THREE.Color(COLOR_TOKENS.relayBlue);
    const after = new THREE.Color(vivid(COLOR_TOKENS.relayBlue));
    const hb = { h: 0, s: 0, l: 0 };
    const ha = { h: 0, s: 0, l: 0 };
    before.getHSL(hb, THREE.SRGBColorSpace);
    after.getHSL(ha, THREE.SRGBColorSpace);
    expect(ha.h).toBeCloseTo(hb.h, 3);
    expect(ha.s).toBeGreaterThan(hb.s);
    expect(ha.s / hb.s).toBeCloseTo(1.125, 2);
    expect(ha.l).toBeCloseTo(hb.l, 3);
  });
});
