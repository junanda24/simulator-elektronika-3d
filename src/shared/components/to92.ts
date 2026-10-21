import * as THREE from 'three';
import { MATERIAL_PROPS } from '../../features/stage3d/materials3d';

/**
 * Bahasa bentuk bersama kemasan TO-92 (transistor 2N2222 & sensor LM35) —
 * Gelombang 1 pembangunan ulang gaya 3D (SPESIFIKASI-GAYA-3D §5):
 *
 * - Badan = SATU ExtrudeGeometry dari outline "D" sejati (muka datar +
 *   punggung setengah lingkaran) dengan bevel halus — bukan lagi tempelan
 *   setengah silinder + pelat box yang jahitannya terlihat.
 * - Kaki pipih (strip extrude) menyempit rapat di badan (pitch 1,27 mm ≙
 *   0,5 unit) lalu melebar ke pitch lubang breadboard (2,54 mm ≙ 1 unit),
 *   persis praktik asli kaki TO-92 yang dibengkokkan keluar (riset Part A5).
 * - Teks tipe tercetak di muka datar via CanvasTexture prosedural
 *   (pola yang sama dengan silkscreen UnoBoard: sRGB + anisotropy 8).
 *
 * Skala proyek: 1 unit = 2,54 mm. Sumbu lokal komponen: muka datar
 * menghadap −X, barisan kaki sepanjang Z, pin elektrik di [0, 0, ±1].
 *
 * Material diambil dari pustaka bersama `stage3d/materials3d.ts`
 * (konsolidasi fondasi 2026-10-21) — tidak ada lagi salinan angka §3
 * di file ini.
 */

/**
 * Parameter material badan TO-92 — kelas plastikHitam §3 dari pustaka
 * bersama (#1B1B1F, bukan #000).
 */
export const TO92_BODY_MATERIAL = MATERIAL_PROPS.plastikHitam;

/**
 * Badan rusak (transistor terbakar): turunan kelas plastikHitam dengan
 * override keadaan rusak — hitam legam, kilap hilang. Bukan kelas §3,
 * jadi memang tetap turunan lokal dari props pustaka.
 */
export const TO92_BODY_DAMAGED = {
  ...MATERIAL_PROPS.plastikHitam,
  color: '#0a0a0a',
  roughness: 0.65,
  clearcoat: 0.15,
  clearcoatRoughness: 0.5,
};

/** Material kaki pipih — kelas metalPin §3 dari pustaka bersama. */
export const TO92_LEAD_MATERIAL = MATERIAL_PROPS.metalPin;

/** Warna tinta cetakan muka datar (putih keperakan khas pad-print TO-92). */
const PRINT_COLOR = '#D8DCE2';

export interface To92Dims {
  /** Radius busur punggung (unit). Lebar badan = 2 × radius. */
  radius: number;
  /** Jarak muka datar dari pusat busur (unit); kedalaman badan = radius + chord. */
  chord: number;
  /** Tinggi badan (unit). */
  bodyHeight: number;
  /** Y pangkal badan (unit). */
  bodyBottom: number;
}

/** 2N2222 TO-92 tipikal (riset Part A5): badan ±4,6 × 3,9 × 4,8 mm. */
export const TRANSISTOR_TO92: To92Dims = {
  radius: 0.906,
  chord: 0.62,
  bodyHeight: 1.89,
  bodyBottom: 1.02,
};

/** LM35 kemasan LP TI (riset Part A7): badan nom. 4,30 × 4,30 mm — sedikit lebih ramping dari transistor. */
export const LM35_TO92: To92Dims = {
  radius: 0.846,
  chord: 0.56,
  bodyHeight: 1.75,
  bodyBottom: 1.02,
};

export interface To92Geometries {
  body: THREE.ExtrudeGeometry;
  flange: THREE.ExtrudeGeometry;
  /** Tiga kaki pipih untuk pin z = −1, 0, +1 (urutan itu). */
  leads: THREE.ExtrudeGeometry[];
  /** Bidang cetakan di muka datar: posisi x, lebar & tinggi plane, y tengah. */
  face: { x: number; width: number; height: number; centerY: number };
}

/** Outline "D" TO-92 di bidang (u = lebar/Z dunia, v = kedalaman/X dunia). */
function to92Outline(radius: number, chord: number): THREE.Shape {
  const w = Math.sqrt(radius * radius - chord * chord);
  const shape = new THREE.Shape();
  shape.moveTo(-w, -chord);
  shape.lineTo(w, -chord);
  // Busur punggung: dari sudut kanan bawah, lewat +v (punggung), ke kiri bawah.
  shape.absarc(0, 0, radius, Math.atan2(-chord, w), Math.atan2(-chord, -w), false);
  shape.closePath();
  return shape;
}

/**
 * Basis perubahan bentuk shape → dunia komponen: (u, v, ekstrusi) →
 * (X = v, Y = ekstrusi, Z = u). Permutasi siklis (determinan +1, rotasi murni).
 */
const SHAPE_TO_WORLD = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
);

function extrudeBodyPart(shape: THREE.Shape, depth: number, bevel: number, yBase: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 3,
    curveSegments: 36,
  });
  geo.applyMatrix4(SHAPE_TO_WORLD);
  geo.translate(0, yBase, 0);
  return geo;
}

/** Garis tengah kaki (u = z dunia, v = y dunia) untuk pin tujuan zTarget. */
function leadCenterline(zTarget: number): Array<[number, number]> {
  if (zTarget === 0) return [[0, 1.72], [0, -0.95]];
  const s = Math.sign(zTarget);
  return [
    [0.5 * s, 1.72], // keluar dari dalam badan pada pitch rapat 1,27 mm
    [0.5 * s, 0.98], // lurus sebentar di bawah pangkal badan
    [0.66 * s, 0.66], // tekuk melebar (dua segmen agar tak patah tajam)
    [0.86 * s, 0.38],
    [1.0 * s, 0.16], // mencapai pitch lubang 2,54 mm
    [1.0 * s, -0.95], // lurus masuk ke lubang breadboard (jangkar pin y=0)
  ];
}

/** Strip pipih dari garis tengah: outline digeser ±setengah lebar tegak lurus arah jalan. */
function stripShape(points: Array<[number, number]>, halfWidth: number): THREE.Shape {
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let du = next[0] - prev[0];
    let dv = next[1] - prev[1];
    const len = Math.hypot(du, dv) || 1;
    du /= len;
    dv /= len;
    left.push([p[0] - dv * halfWidth, p[1] + du * halfWidth]);
    right.push([p[0] + dv * halfWidth, p[1] - du * halfWidth]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i += 1) shape.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i -= 1) shape.lineTo(right[i][0], right[i][1]);
  shape.closePath();
  return shape;
}

const LEAD_THICKNESS = 0.09; // ±0,23 mm — ketebalan kaki pipih asli
const LEAD_HALF_WIDTH = 0.085; // lebar kaki 0,17 unit ≙ 0,43 mm

function buildLead(zTarget: number): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(stripShape(leadCenterline(zTarget), LEAD_HALF_WIDTH), {
    depth: LEAD_THICKNESS,
    bevelEnabled: false,
  });
  // Shape digambar di bidang (z, y); putar agar ekstrusi menjadi sumbu X dunia.
  geo.rotateY(-Math.PI / 2);
  geo.translate(LEAD_THICKNESS / 2, 0, 0);
  return geo;
}

function buildTo92Geometries(dims: To92Dims): To92Geometries {
  const { radius, chord, bodyHeight, bodyBottom } = dims;
  const flatHalfWidth = Math.sqrt(radius * radius - chord * chord);

  const body = extrudeBodyPart(to92Outline(radius, chord), bodyHeight, 0.055, bodyBottom);
  // Rok/flange tipis di pangkal badan (ciri TO-92 asli yang dulu hilang):
  // outline yang sama diperbesar 5%, duduk tepat di titik keluar kaki.
  const flange = extrudeBodyPart(to92Outline(radius * 1.05, chord * 1.05), 0.16, 0.02, bodyBottom - 0.03);

  return {
    body,
    flange,
    leads: [buildLead(-1), buildLead(0), buildLead(1)],
    face: {
      x: -(chord + 0.012),
      width: flatHalfWidth * 2 * 0.94,
      height: Math.min(1.3, bodyHeight * 0.68),
      centerY: bodyBottom + bodyHeight / 2,
    },
  };
}

/** Geometri dipakai bersama antar-instance (hemat memori) — mesh pemakai WAJIB dispose={null}. */
const geometryCache = new WeakMap<To92Dims, To92Geometries>();
export function getTo92Geometries(dims: To92Dims): To92Geometries {
  const cached = geometryCache.get(dims);
  if (cached) return cached;
  const built = buildTo92Geometries(dims);
  geometryCache.set(dims, built);
  return built;
}

export interface To92FaceLine {
  text: string;
  /** Tinggi huruf dalam piksel kanvas (kanvas 512 × 512). */
  px: number;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Tekstur cetakan muka datar TO-92: teks tipe bertumpuk di tengah, tinta
 * keperakan di atas transparan (warna badan di bawahnya tetap terlihat,
 * seperti pad-print asli). Dipakai bersama antar-instance — jangan dispose.
 */
export function getTo92FaceTexture(key: string, lines: To92FaceLine[]): THREE.CanvasTexture {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PRINT_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineAdvance = lines.map((l) => l.px * 0.82);
    const total = lineAdvance.reduce((a, b) => a + b, 0);
    let cursor = canvas.height / 2 - total / 2;
    lines.forEach((line, i) => {
      ctx.font = `700 ${line.px}px Arial, sans-serif`;
      ctx.fillText(line.text, canvas.width / 2, cursor + lineAdvance[i] / 2);
      cursor += lineAdvance[i];
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  textureCache.set(key, texture);
  return texture;
}
