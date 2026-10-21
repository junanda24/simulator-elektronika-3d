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

/** Offset arah bidik preset Fokus dari targetnya — arah kanonik 3/4 atas
 * yang sama dipakai pembingkai klik ganda (frameFocusView di bawah). */
export const FOCUS_OFFSET: Vec3Tuple = [6, 5, 7];

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
        position: [
          target[0] + FOCUS_OFFSET[0],
          target[1] + FOCUS_OFFSET[1],
          target[2] + FOCUS_OFFSET[2],
        ],
      };
    }
  }
}

/**
 * Tuning OrbitControls untuk meja kerja seukuran breadboard (bentang
 * kerja ±66 satuan, jarak rumah ±81) — BUKAN scene raksasa. Nilai di sini
 * adalah satu-satunya sumber; Workbench meneruskannya sebagai props dan
 * tes mengunci invariantnya.
 *
 * - dampingFactor 0,10: default three-stdlib 0,05 membuat putaran
 *   meluncur terlalu lama (±1,5 dtk untuk meluruh ke 1%) — terasa
 *   mengambang & sulit berhenti tepat, akar keluhan "putar-putar kamera
 *   kurang nyaman". 0,10 meluruh ke 1% dalam ±0,7 dtk: tetap meluncur
 *   halus, berhenti di tempat yang dimaksud.
 * - rotateSpeed 0,85: pada 1,0 seretan selebar tinggi kanvas memutar
 *   360° — terlalu liar untuk membidik terminal kecil. 0,85 memberi
 *   kendali tanpa terasa berat.
 * - panSpeed 0,80: geser pada kecepatan penuh mudah melempar target
 *   keluar area kerja; 0,80 menahan laju tanpa mengubah arah.
 * - zoomSpeed 0,90: langkah roda sedikit lebih halus dari 1,0.
 * - screenSpacePanning true (bawaan three, kini eksplisit): arah geser
 *   selalu mengikuti layar — konsisten dari sudut pandang mana pun.
 * - maxPolarAngle 1,45 rad (±83°): kamera tidak pernah turun ke bawah
 *   horizon alas; minPolarAngle 0 karena preset Atas WAJIB bisa tegak
 *   lurus (kutub atas adalah bidikan sah, bukan kecelakaan).
 * - minDistance 10: tepat di bawah jarak preset Fokus (±10,49) —
 *   clamp tidak pernah melawan penerbangan preset. maxDistance 120:
 *   ±1,5× jarak rumah, masih jauh di dalam awal fog (160) — user tidak
 *   bisa tersesat zoom-out ke kehampaan berkabut.
 *
 * zoomToCursor SENGAJA tidak diaktifkan: ia menggeser target pada
 * setiap dolly, sedangkan model kompensasi inset + preset proyek
 * mengasumsikan target hanya berubah lewat penerbangan terprogram.
 * Target yang merayap diam-diam membuat pivot menjauhi area wiring
 * yang sedang diperiksa — prediktabilitas pivot lebih penting di meja
 * wiring daripada zoom yang mengejar kursor.
 */
export const CAMERA_TUNING = {
  dampingFactor: 0.1,
  rotateSpeed: 0.85,
  panSpeed: 0.8,
  zoomSpeed: 0.9,
  screenSpacePanning: true,
  minPolarAngle: 0,
  maxPolarAngle: 1.45,
  minDistance: 10,
  maxDistance: 120,
} as const;

/** Jarak terbang pembingkai klik ganda: lantai & langit-langitnya. */
export const FOCUS_FRAME_MIN_DISTANCE = 14;
export const FOCUS_FRAME_MAX_DISTANCE = 30;
/** Sumbangan tiap satuan bentang pin ke jarak bingkai. */
export const FOCUS_FRAME_SPAN_FACTOR = 0.9;
/** Kenaikan target maksimum untuk komponen yang pinnya menjulang
 * (baterai 9V: pin di ketinggian 19,6) — separuh tinggi pin rata-rata,
 * dibatasi agar target tidak meninggalkan badan komponen. */
export const FOCUS_FRAME_MAX_LIFT = 6;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Bidikan pembingkai untuk klik ganda pada sebuah komponen: target =
 * posisi komponen (sama seperti preset Fokus), arah = arah kanonik
 * Fokus (FOCUS_OFFSET), tetapi jarak PROPORSIONAL terhadap bentang
 * komponen — diukur dari bentang XZ terjauh antar-pin pada meta
 * (invarian terhadap rotasi Y instance, jadi murni dari data meta).
 * Komponen kecil (LED, resistor) dibingkai dari lantai 14; komponen
 * lebar (bar graph, bentang pin ±10,4) mundur sampai ±19; langit-langit
 * 30 menjaga komponen sebesar apa pun tetap terasa "dekat".
 * Target dinaikkan separuh tinggi rata-rata pin (maks 6) agar komponen
 * yang pinnya di puncak badan (baterai 9V) terbingkai di badannya,
 * bukan di kakinya; semua komponen lubang ber-pin y=0 → tanpa kenaikan,
 * persis perilaku preset Fokus.
 */
export function frameFocusView(
  instancePosition: Vec3Tuple,
  pinsLocal: readonly Vec3Tuple[],
): CameraPresetView {
  let span = 0;
  for (let i = 0; i < pinsLocal.length; i += 1) {
    for (let j = i + 1; j < pinsLocal.length; j += 1) {
      const d = Math.hypot(
        pinsLocal[i][0] - pinsLocal[j][0],
        pinsLocal[i][2] - pinsLocal[j][2],
      );
      if (d > span) span = d;
    }
  }
  const avgPinY =
    pinsLocal.length === 0
      ? 0
      : pinsLocal.reduce((sum, p) => sum + p[1], 0) / pinsLocal.length;
  const target: Vec3Tuple = [
    instancePosition[0],
    instancePosition[1] + clamp(avgPinY / 2, 0, FOCUS_FRAME_MAX_LIFT),
    instancePosition[2],
  ];
  const baseDistance = Math.hypot(...FOCUS_OFFSET);
  const distance = clamp(
    baseDistance + span * FOCUS_FRAME_SPAN_FACTOR,
    FOCUS_FRAME_MIN_DISTANCE,
    FOCUS_FRAME_MAX_DISTANCE,
  );
  const scale = distance / baseDistance;
  return {
    target,
    position: [
      target[0] + FOCUS_OFFSET[0] * scale,
      target[1] + FOCUS_OFFSET[1] * scale,
      target[2] + FOCUS_OFFSET[2] * scale,
    ],
  };
}

/** Satu klik yang lolos penjaga seret (≤6px) pada permukaan 3D. */
export interface ClickPoint {
  /** Cap waktu (ms, jam monoton apa pun yang konsisten antar-klik). */
  t: number;
  x: number;
  y: number;
  /** Identitas permukaan: id instance, atau kunci tetap seperti 'mat'. */
  key: string;
}

/** Jendela waktu pasangan klik agar dihitung klik ganda. */
export const DOUBLE_CLICK_WINDOW_MS = 400;
/** Jarak layar maksimum antar dua klik dalam satu pasangan. */
export const DOUBLE_CLICK_MAX_DIST_PX = 10;

/**
 * Klasifikasi klik ganda murni: benar hanya bila klik sebelumnya ada,
 * pada permukaan yang sama, dalam jendela waktu, dan cukup dekat di
 * layar. Deteksi memakai pointerup yang sama dengan semantik klik
 * proyek (penjaga seret 6px diterapkan pemanggil) — BUKAN event
 * dblclick DOM, yang tetap menyala setelah dua seretan kamera cepat.
 */
export function isDoubleClick(
  prev: ClickPoint | null,
  next: ClickPoint,
): boolean {
  if (!prev) return false;
  if (prev.key !== next.key) return false;
  const dt = next.t - prev.t;
  if (dt < 0 || dt > DOUBLE_CLICK_WINDOW_MS) return false;
  return Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_CLICK_MAX_DIST_PX;
}
