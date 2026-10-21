import { describe, expect, it } from 'vitest';
import {
  computeViewOffset,
  easeOutQuint,
  freeCenterNdc,
  leftInsetFor,
  PANEL_TAB_WIDTH,
  rightInsetFor,
  shiftViewForInsets,
  viewOffsetFromInsets,
  type ViewOffsetRect,
} from '../viewportInsets';

/**
 * Bingkai proyeksi CameraRig (setViewOffset): meja harus terbingkai di
 * rektangel bebas antar panel HUD — katalog kiri, dock kanan 380px,
 * kapsul atas (68px), dock bawah (76px).
 */
describe('computeViewOffset', () => {
  it('1440×900: katalog lebar (x=276), dock kanan 392, atas 68, bawah 76', () => {
    expect(computeViewOffset(1440, 900)).toEqual({
      fullWidth: 1440,
      fullHeight: 900,
      x: 276,
      y: 68,
      width: 1440 - 276 - 392,
      height: 900 - 68 - 76,
    });
  });

  it('1366×768: tetap katalog lebar (≥1280)', () => {
    expect(computeViewOffset(1366, 768)).toEqual({
      fullWidth: 1366,
      fullHeight: 768,
      x: 276,
      y: 68,
      width: 1366 - 276 - 392,
      height: 768 - 68 - 76,
    });
  });

  it('1152×768: katalog sempit (x=248)', () => {
    expect(computeViewOffset(1152, 768)).toEqual({
      fullWidth: 1152,
      fullHeight: 768,
      x: 248,
      y: 68,
      width: 1152 - 248 - 392,
      height: 768 - 68 - 76,
    });
  });

  it('ambang tepat: 1280 lebar, 1279 sempit', () => {
    expect(computeViewOffset(1280, 800).x).toBe(276);
    expect(computeViewOffset(1279, 800).x).toBe(248);
  });

  it('sub-bingkai selalu positif pada rentang desktop target (≥1100px)', () => {
    for (const w of [1100, 1152, 1280, 1366, 1440, 1920]) {
      const o = computeViewOffset(w, 768);
      expect(o.width).toBeGreaterThan(0);
      expect(o.height).toBeGreaterThan(0);
      expect(o.x + o.width).toBe(w - 392);
    }
  });
});

/**
 * Sembunyi/tampil panel: inset sisi yang sembunyi menyusut ke sisa tab
 * tepi layar (PANEL_TAB_WIDTH 28px + margin 12px = 40) — dihitung dari
 * lebar panel nyata; sisi yang tampil tidak berubah sedikit pun.
 */
describe('computeViewOffset — panel disembunyikan', () => {
  it('katalog sembunyi (1440×900): x=40, sisi kanan tetap 392', () => {
    const o = computeViewOffset(1440, 900, { left: false, right: true });
    expect(o.x).toBe(40);
    expect(o.width).toBe(1440 - 40 - 392);
    expect(o.x + o.width).toBe(1440 - 392);
  });

  it('dock sembunyi (1440×900): x tetap 276, tepi kanan menyusut ke 40', () => {
    const o = computeViewOffset(1440, 900, { left: true, right: false });
    expect(o.x).toBe(276);
    expect(o.x + o.width).toBe(1440 - 40);
  });

  it('keduanya sembunyi: rektangel bebas selebar kanvas minus dua tab', () => {
    const o = computeViewOffset(1440, 900, { left: false, right: false });
    expect(o.x).toBe(40);
    expect(o.width).toBe(1440 - 40 - 40);
  });

  it('katalog sempit + sembunyi: ambang lebar tidak lagi relevan', () => {
    const o = computeViewOffset(1152, 768, { left: false, right: false });
    expect(o.x).toBe(40);
    expect(o.width).toBe(1152 - 80);
  });

  it('leftInsetFor/rightInsetFor: tabel nilai per keadaan', () => {
    expect(PANEL_TAB_WIDTH).toBe(28);
    expect(leftInsetFor(1440, true)).toBe(276);
    expect(leftInsetFor(1152, true)).toBe(248);
    expect(leftInsetFor(1440, false)).toBe(40);
    expect(leftInsetFor(1152, false)).toBe(40);
    expect(rightInsetFor(true)).toBe(392);
    expect(rightInsetFor(false)).toBe(40);
  });

  it('viewOffsetFromInsets == computeViewOffset untuk inset final yang sama', () => {
    expect(viewOffsetFromInsets(1440, 900, 276, 392)).toEqual(computeViewOffset(1440, 900));
    expect(viewOffsetFromInsets(1440, 900, 40, 40)).toEqual(
      computeViewOffset(1440, 900, { left: false, right: false }),
    );
  });
});

/**
 * easeOutQuint menilai cubic-bezier(0.22,1,0.36,1) yang sama dengan
 * transisi CSS panel — tween inset kamera & luncuran panel harus
 * berbagi kurva ini persis agar geraknya serentak.
 */
describe('easeOutQuint', () => {
  it('ujung-ujungnya tepat 0 dan 1', () => {
    expect(easeOutQuint(0)).toBe(0);
    expect(easeOutQuint(1)).toBe(1);
  });

  it('monoton naik dan selalu di atas diagonal (ease-out kuat)', () => {
    let prev = 0;
    for (let i = 1; i <= 20; i += 1) {
      const t = i / 20;
      const v = easeOutQuint(t);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeGreaterThanOrEqual(t);
      prev = v;
    }
    expect(prev).toBe(1);
  });

  it('nilai tengah cocok dengan kurva CSS (x=0,5 → y≈0,962; x=0,25 → y≈0,764)', () => {
    expect(easeOutQuint(0.5)).toBeGreaterThan(0.93);
    expect(easeOutQuint(0.5)).toBeLessThan(0.99);
    expect(easeOutQuint(0.25)).toBeGreaterThan(0.7);
    expect(easeOutQuint(0.25)).toBeLessThan(0.85);
  });
});


/**
 * Kompensasi inset (akar bug "klik Atas tidak ke atas"): tanpa kompensasi,
 * titik bidik kamera tampil di NDC x +0,150 pada 1440×900 — selalu ±166px
 * di kanan pusat rektangel bebas, dan subjek preset tegak tertutup dock
 * kanan. freeCenterNdc + shiftViewForInsets adalah perbaikannya.
 */
describe('freeCenterNdc', () => {
  it('1440×900: subjek harus berproyeksi ke NDC (−0,1237, +0,0164) agar tampil di pusat area bebas', () => {
    const { nx, ny } = freeCenterNdc(computeViewOffset(1440, 900));
    expect(nx).toBeCloseTo(-0.1237, 3);
    expect(ny).toBeCloseTo(0.0164, 3);
  });

  it('1152×768 (katalog sempit): pergeseran ke kiri lebih besar', () => {
    const { nx } = freeCenterNdc(computeViewOffset(1152, 768));
    expect(nx).toBeCloseTo(-0.1806, 3);
  });

  it('tanpa inset (bingkai penuh): pusat bebas = pusat bingkai = NDC (0, 0)', () => {
    const full: ViewOffsetRect = {
      fullWidth: 1000,
      fullHeight: 800,
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    };
    expect(freeCenterNdc(full)).toEqual({ nx: 0, ny: 0 });
  });
});

describe('shiftViewForInsets', () => {
  const view1440 = computeViewOffset(1440, 900);

  it('tanpa inset: posisi & target dikembalikan apa adanya (salinan)', () => {
    const full: ViewOffsetRect = {
      fullWidth: 1000,
      fullHeight: 800,
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    };
    const position: [number, number, number] = [10, 20, 30];
    const target: [number, number, number] = [0, 0, 0];
    const out = shiftViewForInsets(position, target, full, 45, 1000 / 800);
    expect(out.position).toEqual(position);
    expect(out.target).toEqual(target);
    expect(out.position).not.toBe(position);
  });

  it('arah pandang & jarak TIDAK berubah (geser sejajar) — preset tegak tetap tegak', () => {
    const position: [number, number, number] = [-4.5, 88, 0.01];
    const target: [number, number, number] = [-4.5, 0, 0];
    const out = shiftViewForInsets(position, target, view1440, 45, 1440 / 900);
    const dirBefore = position.map((v, i) => v - target[i]);
    const dirAfter = out.position.map((v, i) => v - out.target[i]);
    dirAfter.forEach((v, i) => expect(v).toBeCloseTo(dirBefore[i], 9));
    // Input tidak diubah.
    expect(position).toEqual([-4.5, 88, 0.01]);
    expect(target).toEqual([-4.5, 0, 0]);
    // Dan memang bergeser (kompensasi 1440×900 tidak nol).
    expect(out.target[0]).not.toBeCloseTo(target[0], 3);
  });
});
