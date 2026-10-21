/**
 * Definisi preset kamera Floating Studio HUD — data murni tanpa
 * React/three, dites unit. Menu kamera kini TANPA dropdown: empat tombol
 * langsung [Perspektif] [Atas] [Dekat] [Fokus].
 *
 * Kompensasi inset (`setViewOffset`) TIDAK tinggal di sini: preset
 * menyimpan posisi & target yang jujur (subjek = target), dan CameraRig
 * menggeser keduanya saat eksekusi lewat `shiftViewForInsets` di
 * viewportInsets.ts agar subjek tampil di pusat rektangel bebas panel.
 */

export type Vec3Tuple = [number, number, number];

/** Posisi "rumah" kamera (sumber tunggal; Workbench membangun Vector3 dari sini). */
export const CAMERA_HOME_POS: Vec3Tuple = [40, 42, 52];
/** Target "rumah": tengah bentang board↔breadboard setelah origin board −21. */
export const TARGET_HOME_POS: Vec3Tuple = [-6, 0, 0];

export type CameraPresetId = 'perspektif' | 'atas' | 'dekat' | 'fokus';

export interface CameraPresetView {
  target: Vec3Tuple;
  position: Vec3Tuple;
}

export interface CameraPresetContext {
  /** Origin board aktif (semua board kini di [−21, 0, 0]). */
  boardOrigin: Vec3Tuple;
  /** Posisi komponen terpilih untuk preset Fokus; null = Fokus tak tersedia. */
  selectedPosition: Vec3Tuple | null;
}

/** Ketinggian preset Atas: cukup untuk memuat bentang penuh meja (lihat tes). */
export const ATAS_HEIGHT = 88;
/** Offset z kecil pada preset tegak — menghindari singularitas azimuth di kutub (pola lama +0.01). */
export const TOP_EPSILON_Z = 0.01;

/** Pusat area kerja: titik tengah board↔breadboard. */
export function tableCenterOf(boardOrigin: Vec3Tuple): Vec3Tuple {
  // BREADBOARD_ORIGIN = [12, 0, 0] (shared/boards/breadboard.ts) — disalin
  // sebagai konstanta lokal agar modul ini tetap murni tanpa impor silang;
  // tes mengunci nilai tengahnya.
  return [(boardOrigin[0] + 12) / 2, 0, (boardOrigin[2] + 0) / 2];
}

/**
 * Preset kamera untuk konteks saat ini. Mengembalikan null hanya untuk
 * 'fokus' tanpa komponen terpilih (tombolnya disembunyikan di UI).
 */
export function getCameraPreset(
  id: CameraPresetId,
  ctx: CameraPresetContext,
): CameraPresetView | null {
  switch (id) {
    case 'perspektif':
      return { target: [...TARGET_HOME_POS], position: [...CAMERA_HOME_POS] };
    case 'atas': {
      const target = tableCenterOf(ctx.boardOrigin);
      return {
        target,
        position: [target[0], ATAS_HEIGHT, target[2] + TOP_EPSILON_Z],
      };
    }
    case 'dekat': {
      // Bidikan dekat 3/4 ke pusat area kerja (board + breadboard sekaligus),
      // menggantikan preset miring per area yang lama.
      const target = tableCenterOf(ctx.boardOrigin);
      return {
        target,
        position: [target[0] + 16, 13, target[2] + 20],
      };
    }
    case 'fokus': {
      if (!ctx.selectedPosition) return null;
      const target: Vec3Tuple = [...ctx.selectedPosition];
      return {
        target,
        position: [target[0] + 6, target[1] + 5, target[2] + 7],
      };
    }
  }
}
