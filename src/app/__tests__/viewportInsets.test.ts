import { describe, expect, it } from 'vitest';
import {
  computeViewOffset,
  freeCenterNdc,
  shiftViewForInsets,
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
