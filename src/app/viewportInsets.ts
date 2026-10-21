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


/**
 * NDC (rentang −1..1, y ke atas) tempat SUBJEK bidikan harus tampil agar
 * terlihat tepat di pusat rektangel bebas pada kanvas yang benar-benar
 * dirender.
 *
 * Kenapa bukan (0,0): `setViewOffset` merender sub-bingkai (x, y, w, h)
 * dari bingkai virtual penuh ke seluruh kanvas. Titik yang dibidik kamera
 * (di sumbu pandang, NDC virtual 0) tampil di fraksi kanvas
 * (fullW/2 − x)/w ≠ pusat rektangel bebas — pada 1440×900 subjek selalu
 * tergeser +0,150 NDC (≈166px) ke kanan dari pusat area bebas. Fungsi ini
 * membalik petanya: diberi rektangel bebas, kembalikan NDC virtual tempat
 * subjek harus PROYEKSI agar jatuh di pusat rektangel bebas di layar.
 */
export function freeCenterNdc(view: ViewOffsetRect): { nx: number; ny: number } {
  // Fraksi kanvas (dari kiri / dari atas) tempat pusat rektangel bebas duduk.
  const canvasCx = (view.x + view.width / 2) / view.fullWidth;
  const canvasCy = (view.y + view.height / 2) / view.fullHeight;
  // Balik peta setViewOffset: fraksi virtual φ dari fraksi kanvas c adalah
  // φ = (offset + subUkuran · c) / ukuranPenuh.
  const phiX = (view.x + view.width * canvasCx) / view.fullWidth;
  const phiY = (view.y + view.height * canvasCy) / view.fullHeight;
  return { nx: 2 * phiX - 1, ny: 1 - 2 * phiY };
}

type Vec3 = [number, number, number];

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function normalize(a: Vec3): Vec3 {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/**
 * Geser posisi kamera DAN target dengan vektor yang sama (arah pandang
 * tidak berubah — preset tegak tetap persis tegak) sehingga subjek
 * (target asli) berproyeksi ke pusat rektangel bebas, bukan ke pusat
 * bingkai virtual. Mengembalikan pasangan baru; input tidak diubah.
 *
 * Besaran geser diturunkan dari geometri frustum pada kedalaman subjek:
 * pergeseran lateral δ menggeser NDC subjek sebesar −δ/(D·tan) per sumbu
 * layar, jadi δ = −NDC_sasaran · D · tan per sumbu basis kamera.
 */
export function shiftViewForInsets(
  position: Vec3,
  target: Vec3,
  view: ViewOffsetRect,
  fovDeg: number,
  aspect: number,
): { position: Vec3; target: Vec3 } {
  const { nx, ny } = freeCenterNdc(view);
  if (nx === 0 && ny === 0) return { position: [...position], target: [...target] };

  const viewDir = sub(target, position);
  const dist = length(viewDir);
  if (dist === 0) return { position: [...position], target: [...target] };

  // Basis layar ala three lookAt: sumbu z kamera dari target ke posisi.
  const zAxis = normalize(sub(position, target));
  let upRef: Vec3 = [0, 1, 0];
  let xAxis = cross(upRef, zAxis);
  if (length(xAxis) < 1e-6) {
    // Pandangan sejajar sumbu Y (preset tegak murni): pakai rujukan −Z,
    // sama seperti hasil akhir lookAt untuk kamera yang datang dari +Z.
    upRef = [0, 0, -1];
    xAxis = cross(upRef, zAxis);
  }
  xAxis = normalize(xAxis);
  const yAxis = cross(zAxis, xAxis);

  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  const dx = -nx * dist * tanH;
  const dy = -ny * dist * tanV;
  const delta: Vec3 = [
    xAxis[0] * dx + yAxis[0] * dy,
    xAxis[1] * dx + yAxis[1] * dy,
    xAxis[2] * dx + yAxis[2] * dy,
  ];
  return {
    position: [position[0] + delta[0], position[1] + delta[1], position[2] + delta[2]],
    target: [target[0] + delta[0], target[1] + delta[1], target[2] + delta[2]],
  };
}
