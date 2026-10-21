import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CAMERA_HOME_POS,
  CAMERA_TUNING,
  TARGET_HOME_POS,
  DOUBLE_CLICK_MAX_DIST_PX,
  DOUBLE_CLICK_WINDOW_MS,
  FOCUS_FRAME_MAX_DISTANCE,
  FOCUS_FRAME_MIN_DISTANCE,
  FOCUS_OFFSET,
  frameFocusView,
  getCameraPreset,
  isDoubleClick,
  tableCenterOf,
  type ClickPoint,
  type CameraPresetId,
  type Vec3Tuple,
} from '../cameraPresets';
import { computeViewOffset, shiftViewForInsets } from '../viewportInsets';

/**
 * Preset kamera menu baru (Perspektif / Atas / Dekat / Fokus) + bukti
 * proyeksi ujung-ke-ujung: setelah kompensasi inset CameraRig, subjek
 * setiap preset tampil di pusat rektangel bebas antar panel — regresi
 * untuk bug "klik Atas tidak ke atas" (subjek lama tampil +0,150 NDC,
 * ±166px terlalu ke kanan; breadboard tertutup dock kanan).
 */

const BOARD_ORIGIN: Vec3Tuple = [-21, 0, 0]; // semua board aktif
const SELECTED: Vec3Tuple = [12, 3, 10];
const CTX = { boardOrigin: BOARD_ORIGIN, selectedPosition: SELECTED };

function dist(a: Vec3Tuple, b: Vec3Tuple): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('getCameraPreset — matematika preset murni', () => {
  it('pusat area kerja = titik tengah board↔breadboard', () => {
    expect(tableCenterOf(BOARD_ORIGIN)).toEqual([-4.5, 0, 0]);
  });

  it('perspektif = posisi rumah yang sama seperti Reset Kamera', () => {
    const v = getCameraPreset('perspektif', CTX)!;
    expect(v.target).toEqual([-6, 0, 0]);
    expect(v.position).toEqual([40, 42, 52]);
  });

  it('atas: TEGAK di atas pusat area kerja (x posisi === x target persis)', () => {
    const v = getCameraPreset('atas', CTX)!;
    expect(v.target).toEqual([-4.5, 0, 0]);
    expect(v.position[0]).toBe(v.target[0]);
    // z hanya boleh menyimpang sebesar epsilon anti-singularitas (0.01).
    expect(Math.abs(v.position[2] - v.target[2])).toBeLessThanOrEqual(0.01);
    expect(v.position[1]).toBeGreaterThan(0);
  });

  it('dekat: target sama dengan atas, jarak jauh lebih dekat dari perspektif', () => {
    const dekat = getCameraPreset('dekat', CTX)!;
    const perspektif = getCameraPreset('perspektif', CTX)!;
    expect(dekat.target).toEqual([-4.5, 0, 0]);
    expect(dist(dekat.position, dekat.target)).toBeLessThan(
      dist(perspektif.position, perspektif.target),
    );
  });

  it('fokus: membidik komponen terpilih; tanpa pilihan → null (tombol disembunyikan)', () => {
    const v = getCameraPreset('fokus', CTX)!;
    expect(v.target).toEqual(SELECTED);
    expect(v.position).toEqual([18, 8, 17]);
    expect(
      getCameraPreset('fokus', { boardOrigin: BOARD_ORIGIN, selectedPosition: null }),
    ).toBeNull();
  });

  it('semua preset: kamera di atas bidang meja & jarak di dalam pita clamp OrbitControls [10, 120]', () => {
    // OrbitControls menulis ulang posisi dari spherical ter-clamp setiap
    // update() — preset di luar [minDistance, maxDistance] akan dipangkas
    // diam-diam. Semua preset wajib hidup di dalam pita itu.
    const ids: CameraPresetId[] = ['perspektif', 'atas', 'dekat', 'fokus'];
    for (const id of ids) {
      const v = getCameraPreset(id, CTX)!;
      expect(v.position[1]).toBeGreaterThan(v.target[1]);
      const d = dist(v.position, v.target);
      expect(d).toBeGreaterThanOrEqual(10);
      expect(d).toBeLessThanOrEqual(120);
    }
  });
});

describe('proyeksi ujung-ke-ujung (three PerspectiveCamera + setViewOffset)', () => {
  const W = 1440;
  const H = 900;
  const view = computeViewOffset(W, H);
  // NDC hasil render tempat pusat rektangel bebas berada di kanvas.
  const freeNdcX = 2 * ((view.x + view.width / 2) / view.fullWidth) - 1;
  const freeNdcY = 1 - 2 * ((view.y + view.height / 2) / view.fullHeight);

  function projectSubject(
    position: Vec3Tuple,
    lookTarget: Vec3Tuple,
    subject: Vec3Tuple,
  ): THREE.Vector3 {
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.5, 600);
    cam.position.set(...position);
    cam.lookAt(...lookTarget);
    cam.setViewOffset(view.fullWidth, view.fullHeight, view.x, view.y, view.width, view.height);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    return new THREE.Vector3(...subject).project(cam);
  }

  it('TANPA kompensasi: subjek tampil +0,150 NDC (dokumen bug — terlalu ke kanan)', () => {
    const v = getCameraPreset('atas', CTX)!;
    const p = projectSubject(v.position, v.target, v.target);
    expect(p.x).toBeCloseTo(0.15, 2);
    expect(p.x).not.toBeCloseTo(freeNdcX, 1);
  });

  it('DENGAN kompensasi CameraRig: subjek SEMUA preset tampil di pusat rektangel bebas', () => {
    const ids: CameraPresetId[] = ['perspektif', 'atas', 'dekat', 'fokus'];
    for (const id of ids) {
      const v = getCameraPreset(id, CTX)!;
      const shifted = shiftViewForInsets(v.position, v.target, view, 45, W / H);
      const p = projectSubject(shifted.position, shifted.target, v.target);
      expect(p.x).toBeCloseTo(freeNdcX, 2);
      expect(p.y).toBeCloseTo(freeNdcY, 2);
    }
  });

  it('atas terkompensasi: seluruh lebar breadboard muat di dalam rektangel bebas', () => {
    const v = getCameraPreset('atas', CTX)!;
    const shifted = shiftViewForInsets(v.position, v.target, view, 45, W / H);
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.5, 600);
    cam.position.set(...shifted.position);
    cam.lookAt(...shifted.target);
    cam.setViewOffset(view.fullWidth, view.fullHeight, view.x, view.y, view.width, view.height);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // Tepi breadboard (origin x=12 ± 11) harus jatuh di dalam bingkai yang
    // dirender — sebelum perbaikan tepi kanannya di 1107px, tertutup dock.
    for (const edgeX of [1, 23]) {
      const p = new THREE.Vector3(edgeX, 0, 0).project(cam);
      expect(Math.abs(p.x)).toBeLessThan(1);
    }
  });
});

describe('CAMERA_TUNING — invariant kenyamanan OrbitControls', () => {
  it('dampingFactor di pita premium 0,08–0,12 (bukan default three-stdlib 0,05)', () => {
    expect(CAMERA_TUNING.dampingFactor).toBeGreaterThanOrEqual(0.08);
    expect(CAMERA_TUNING.dampingFactor).toBeLessThanOrEqual(0.12);
  });

  it('kecepatan putar/geser/zoom ditundukkan: semua di (0,5 … 1]', () => {
    for (const v of [
      CAMERA_TUNING.rotateSpeed,
      CAMERA_TUNING.panSpeed,
      CAMERA_TUNING.zoomSpeed,
    ]) {
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('pita polar: tidak pernah di bawah horizon alas, kutub atas tetap sah untuk preset Atas', () => {
    expect(CAMERA_TUNING.maxPolarAngle).toBeLessThan(Math.PI / 2);
    expect(CAMERA_TUNING.maxPolarAngle).toBeGreaterThanOrEqual(1.4);
    expect(CAMERA_TUNING.minPolarAngle).toBe(0);
  });

  it('pita jarak: clamp tidak melawan preset Fokus maupun posisi rumah, dan tetap di dalam fog', () => {
    const fokusDistance = Math.hypot(...FOCUS_OFFSET); // ±10,49
    const homeDistance = dist(CAMERA_HOME_POS, TARGET_HOME_POS);
    expect(CAMERA_TUNING.minDistance).toBeLessThan(fokusDistance);
    expect(CAMERA_TUNING.maxDistance).toBeGreaterThan(homeDistance);
    // Fog adegan mulai di 160 (Workbench): zoom-out maksimum harus
    // berhenti jauh sebelum meja larut ke kabut.
    expect(CAMERA_TUNING.maxDistance).toBeLessThan(160);
  });

  it('screen-space panning eksplisit menyala (arah geser mengikuti layar)', () => {
    expect(CAMERA_TUNING.screenSpacePanning).toBe(true);
  });
});

describe('frameFocusView — pembingkai klik ganda proporsional', () => {
  const POS: Vec3Tuple = [12, 3, 10];

  it('target XZ = posisi komponen persis (semantik preset Fokus)', () => {
    const v = frameFocusView(POS, [
      [0, 0, -0.5],
      [0, 0, 0.5],
    ]);
    expect(v.target[0]).toBe(POS[0]);
    expect(v.target[2]).toBe(POS[2]);
  });

  it('arah bidik sejajar arah kanonik Fokus (6, 5, 7)', () => {
    const v = frameFocusView(POS, [
      [-2, 0, 0],
      [2, 0, 0],
    ]);
    const d: Vec3Tuple = [
      v.position[0] - v.target[0],
      v.position[1] - v.target[1],
      v.position[2] - v.target[2],
    ];
    expect(d[0] / FOCUS_OFFSET[0]).toBeCloseTo(d[1] / FOCUS_OFFSET[1], 6);
    expect(d[1] / FOCUS_OFFSET[1]).toBeCloseTo(d[2] / FOCUS_OFFSET[2], 6);
  });

  it('jarak monoton terhadap bentang pin & selalu di dalam pita bingkai', () => {
    const kecil = frameFocusView(POS, [
      [0, 0, -0.5],
      [0, 0, 0.5],
    ]);
    const resistor = frameFocusView(POS, [
      [-2, 0, 0],
      [2, 0, 0],
    ]);
    const barGraph = frameFocusView(POS, [
      [-1.5, 0, -5.5],
      [1.5, 0, 4.5],
    ]);
    const dKecil = dist(kecil.position, kecil.target);
    const dResistor = dist(resistor.position, resistor.target);
    const dBar = dist(barGraph.position, barGraph.target);
    expect(dKecil).toBeCloseTo(FOCUS_FRAME_MIN_DISTANCE, 9);
    expect(dResistor).toBeGreaterThan(dKecil);
    expect(dBar).toBeGreaterThan(dResistor);
    for (const d of [dKecil, dResistor, dBar]) {
      expect(d).toBeGreaterThanOrEqual(FOCUS_FRAME_MIN_DISTANCE);
      expect(d).toBeLessThanOrEqual(FOCUS_FRAME_MAX_DISTANCE);
      // Dan di dalam pita clamp OrbitControls — penerbangan tidak
      // pernah dipangkas controls.update().
      expect(d).toBeGreaterThanOrEqual(CAMERA_TUNING.minDistance);
      expect(d).toBeLessThanOrEqual(CAMERA_TUNING.maxDistance);
    }
    // Bar graph (bentang ±10,44) mundur jauh: ±19,9.
    expect(dBar).toBeCloseTo(19.88, 1);
  });

  it('bentang ekstrem tetap ter-clamp di langit-langit bingkai', () => {
    const v = frameFocusView(POS, [
      [-50, 0, 0],
      [50, 0, 0],
    ]);
    expect(dist(v.position, v.target)).toBeCloseTo(FOCUS_FRAME_MAX_DISTANCE, 9);
  });

  it('tanpa pin: jarak lantai & target tidak terangkat', () => {
    const v = frameFocusView(POS, []);
    expect(dist(v.position, v.target)).toBeCloseTo(FOCUS_FRAME_MIN_DISTANCE, 9);
    expect(v.target).toEqual(POS);
  });

  it('pin menjulang (baterai 9V, pin y=19,6): target terangkat separuh, ter-clamp 6', () => {
    const v = frameFocusView([30, 0, 20], [
      [-2.5, 19.6, 0],
      [2.5, 19.6, 0],
    ]);
    expect(v.target[1]).toBe(6);
    expect(v.target[0]).toBe(30);
    expect(v.target[2]).toBe(20);
  });
});

describe('isDoubleClick — klasifikasi pasangan klik', () => {
  const base: ClickPoint = { t: 1000, x: 100, y: 200, key: 'inst-1' };

  it('tanpa klik sebelumnya → bukan klik ganda', () => {
    expect(isDoubleClick(null, base)).toBe(false);
  });

  it('pasangan sah: permukaan sama, dalam jendela, dekat di layar', () => {
    expect(
      isDoubleClick(base, { t: base.t + 200, x: 103, y: 198, key: 'inst-1' }),
    ).toBe(true);
    // Tepi jendela & tepi jarak persis masih sah.
    expect(
      isDoubleClick(base, {
        t: base.t + DOUBLE_CLICK_WINDOW_MS,
        x: base.x + DOUBLE_CLICK_MAX_DIST_PX,
        y: base.y,
        key: 'inst-1',
      }),
    ).toBe(true);
  });

  it('terlalu lambat / permukaan lain / terlalu jauh → bukan', () => {
    expect(
      isDoubleClick(base, {
        t: base.t + DOUBLE_CLICK_WINDOW_MS + 1,
        x: 100,
        y: 200,
        key: 'inst-1',
      }),
    ).toBe(false);
    expect(
      isDoubleClick(base, { t: base.t + 100, x: 100, y: 200, key: 'inst-2' }),
    ).toBe(false);
    expect(
      isDoubleClick(base, {
        t: base.t + 100,
        x: 100 + DOUBLE_CLICK_MAX_DIST_PX + 1,
        y: 200,
        key: 'inst-1',
      }),
    ).toBe(false);
    expect(
      isDoubleClick(base, { t: base.t - 5, x: 100, y: 200, key: 'inst-1' }),
    ).toBe(false);
  });
});
