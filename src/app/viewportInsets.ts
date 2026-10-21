/**
 * Inset rektangel bebas panggung 3D untuk layout "Floating Studio HUD":
 * panel-panel (katalog kiri, dock kanan, kapsul atas, dock bawah) kini
 * melayang DI ATAS kanvas full-bleed, jadi CameraRig memakai
 * `camera.setViewOffset` agar meja kerja terbingkai di ruang bebas di
 * antara panel — bukan tertutup panel. Angka-angka di sini adalah sisi
 * proyeksi dari geometri layout di SINTESIS-FINAL §B/§C; bila posisi
 * panel berubah, ubah di sini juga.
 *
 * Data murni tanpa React/three — fungsi hitungnya dites unit.
 */

export interface ViewOffsetRect {
  /** Lebar penuh kanvas (px). */
  fullWidth: number;
  /** Tinggi penuh kanvas (px). */
  fullHeight: number;
  /** Geser kiri sub-bingkai dari tepi kiri kanvas (px). */
  x: number;
  /** Geser atas sub-bingkai dari tepi atas kanvas (px). */
  y: number;
  /** Lebar sub-bingkai bebas panel (px). */
  width: number;
  /** Tinggi sub-bingkai bebas panel (px). */
  height: number;
}

/** Kapsul atas berakhir di 56px; tumpukan tengah-atas mulai 68px. */
export const VIEW_OFFSET_TOP = 68;
/** Dock bawah (h-12 di bottom-3) + napas di atasnya. */
export const VIEW_OFFSET_BOTTOM = 76;
/** Dock kanan 380px di right-3 → tepi kirinya 392px dari kanan. */
export const VIEW_OFFSET_RIGHT = 392;
/** Katalog w-[264px] di left-3 → tepi kanannya 276px dari kiri. */
export const VIEW_OFFSET_LEFT_WIDE = 276;
/** Katalog menyempit w-[224px] pada 1100–1279px → tepi kanan 248px. */
export const VIEW_OFFSET_LEFT_NARROW = 248;
/** Ambang lebar viewport untuk katalog lebar vs sempit. */
export const VIEW_OFFSET_WIDE_BREAKPOINT = 1280;

/**
 * Hitung sub-bingkai `setViewOffset` untuk ukuran kanvas tertentu:
 * rektangel bebas di antara katalog (kiri), dock kanan, kapsul atas,
 * dan dock bawah.
 */
export function computeViewOffset(fullWidth: number, fullHeight: number): ViewOffsetRect {
  const x = fullWidth >= VIEW_OFFSET_WIDE_BREAKPOINT
    ? VIEW_OFFSET_LEFT_WIDE
    : VIEW_OFFSET_LEFT_NARROW;
  return {
    fullWidth,
    fullHeight,
    x,
    y: VIEW_OFFSET_TOP,
    width: fullWidth - x - VIEW_OFFSET_RIGHT,
    height: fullHeight - VIEW_OFFSET_TOP - VIEW_OFFSET_BOTTOM,
  };
}
