import * as THREE from 'three';

/**
 * Helper label tekstur kanvas prosedural — SATU-SATUNYA jalur membuat
 * CanvasTexture label untuk model 3D (SPESIFIKASI-GAYA-3D §2.5): dipakai
 * gelombang komponen untuk silkscreen board, teks tipe komponen
 * ("1N4007", "LM35"), plat label relay, dan gelang resistor sebagai
 * tekstur badan.
 *
 * Kontrak §2.5 yang ditegakkan di sini:
 * - Ukuran kanvas 512–1024 px (atlas maks 2048); ukuran di-clamp ke
 *   rentang [64, 2048] agar tidak ada label raksasa/mungil tak terkendali.
 * - colorSpace sRGB + anisotropy 8 (menyamakan konvensi CanvasTexture
 *   yang sudah terbukti di UnoBoard / GenericBoard / Breadboard).
 * - Tanpa aset eksternal: semua digambar prosedural di kanvas 2D.
 * - Teks minimum setara 1,2 mm & kontras ≥ 4,5:1 adalah tanggung jawab
 *   pemanggil (pilih fontSize & warna dari token materials3d.ts).
 *
 * Pemilik tekstur wajib memanggil `texture.dispose()` saat komponen
 * unmount / tekstur diganti (pola useEffect cleanup), sama seperti pola
 * tekstur silkscreen yang sudah ada.
 */

export interface LabelTextureOptions {
  /** Lebar kanvas px (bawaan 512, di-clamp 64–2048). */
  width?: number;
  /** Tinggi kanvas px (bawaan 512, di-clamp 64–2048). */
  height?: number;
  /** Isi latar penuh sebelum painter berjalan (kosongkan = transparan). */
  background?: string;
  /** Bawaan 8 sesuai §2.5. */
  anisotropy?: number;
}

export type LabelPainter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

const MIN_SIZE = 64;
const MAX_SIZE = 2048;

function clampSize(value: number): number {
  return Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, value)));
}

/**
 * Buat CanvasTexture dari callback gambar 2D bebas — untuk silkscreen
 * kompleks, pola Fresnel palsu, gelang resistor, dsb.
 */
export function createLabelTexture(
  paint: LabelPainter,
  options: LabelTextureOptions = {},
): THREE.CanvasTexture {
  const width = clampSize(options.width ?? 512);
  const height = clampSize(options.height ?? 512);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, width, height);
    }
    paint(ctx, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = options.anisotropy ?? 8;
  return texture;
}

/** Satu baris teks label; string polos = gaya bawaan options. */
export interface TextLabelLine {
  text: string;
  /** Ukuran font px baris ini (bawaan: dihitung dari tinggi kanvas). */
  fontSize?: number;
  color?: string;
  fontWeight?: number | string;
}

export interface TextLabelOptions extends LabelTextureOptions {
  lines: Array<string | TextLabelLine>;
  /** Warna teks bawaan (bawaan '#ffffff' — cetakan komponen umumnya putih/perak). */
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  /** Jarak antar baris, pengali ukuran font (bawaan 1,3). */
  lineHeight?: number;
  align?: 'left' | 'center';
  /** Padding dalam px di sekeliling blok teks (bawaan 6% sisi terpendek). */
  padding?: number;
}

/**
 * Label teks sederhana: baris-baris teks ditumpuk vertikal di tengah
 * kanvas (atau rata kiri), cukup untuk plat relay ("SONGLE",
 * "SRD-05VDC-SL-C", "10A 250VAC"), muka TO-92 ("LM35"), badan diode
 * ("1N4007"), dan sejenisnya.
 */
export function createTextLabelTexture(
  options: TextLabelOptions,
): THREE.CanvasTexture {
  const {
    lines,
    color = '#ffffff',
    fontFamily = 'Arial, Helvetica, sans-serif',
    fontWeight = 700,
    lineHeight = 1.3,
    align = 'center',
  } = options;
  return createLabelTexture((ctx, width, height) => {
    const padding = options.padding ?? Math.round(Math.min(width, height) * 0.06);
    const normalized: TextLabelLine[] = lines.map((line) =>
      typeof line === 'string' ? { text: line } : line,
    );
    // Ukuran bawaan: bagi tinggi tersedia ke seluruh baris; baris boleh
    // menimpa ukuran sendiri (mis. baris rating relay lebih kecil).
    const defaultSize = Math.floor(
      (height - padding * 2) / Math.max(1, normalized.length * lineHeight),
    );
    const sizes = normalized.map((line) => line.fontSize ?? defaultSize);
    const blockHeight = sizes.reduce((sum, size) => sum + size * lineHeight, 0);
    let cursorY = height / 2 - blockHeight / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    const x = align === 'center' ? width / 2 : padding;
    normalized.forEach((line, index) => {
      const size = sizes[index];
      ctx.font = `${line.fontWeight ?? fontWeight} ${size}px ${fontFamily}`;
      ctx.fillStyle = line.color ?? color;
      cursorY += (size * lineHeight) / 2;
      ctx.fillText(line.text, x, cursorY);
      cursorY += (size * lineHeight) / 2;
    });
  }, options);
}
