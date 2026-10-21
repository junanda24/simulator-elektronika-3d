import { describe, expect, it } from 'vitest';
import { computeViewOffset } from '../viewportInsets';

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
