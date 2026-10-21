import * as THREE from 'three';

/**
 * Pustaka material 3D bersama — SATU-SATUNYA sumber parameter material &
 * token warna material untuk seluruh model 3D (SPESIFIKASI-GAYA-3D §2.2,
 * §3, §4). Menggantikan konstanta `METAL` yang sebelumnya disalin identik
 * di 21 file model.
 *
 * Aturan yang dikunci dokumen spesifikasi:
 * - §3: parameter PBR per kelas material (roughness / metalness /
 *   clearcoat / clearcoatRoughness) — nilai di bawah adalah titik tengah
 *   rentang tabel; jangan mengarang angka baru di file komponen.
 * - §4: basis warna = warna benda asli; hue warna FUNGSIONAL (gelang
 *   resistor, kabel servo, rel breadboard, warna LED, teal Uno, biru
 *   relay) DILARANG digeser. Token di COLOR_TOKENS dipanen dari nilai
 *   yang sudah terbukti di kode (resistor/servo/LED/breadboard) dan dari
 *   benda aslinya; file komponen TIDAK BOLEH memakai hex liar baru.
 * - Color Expert (token graph): file ini = lapisan REFERENCE token;
 *   komponen mengonsumsi token/factory, bukan literal.
 *
 * Cara pakai oleh gelombang komponen:
 * - Imperatif: `const mat = useMemo(() => createMaterial3D('metalPin'), [])`
 *   lalu `<meshPhysicalMaterial {...} />` diganti `<primitive object={mat} attach="material" />`
 *   atau `<mesh material={mat}>`.
 * - Deklaratif JSX: `<meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />`.
 * - Material BERSAMA (statis, tidak dianimasikan): `getMaterial3D(kind, { color })`
 *   — instance di-cache & dipakai ulang antar komponen (§2.7: material
 *   di-reuse, bukan dibuat per render). Material yang emissive-nya berubah
 *   per frame per instance (LED menyala, dsb.) WAJIB `createMaterial3D`
 *   sendiri — jangan mutasi material bersama.
 */

export interface Material3DParams {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

/** §3 — parameter PBR per kelas (titik tengah rentang spesifikasi). */
export const MATERIAL_PARAMS = {
  /** Plastik ABS mainan (badan warna): r .30–.38, cc .7/.30 */
  absWarna: { roughness: 0.34, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.3 },
  /** Plastik hitam: r .35–.45, cc .5/.35, warna #1B1B1F (bukan #000) */
  plastikHitam: { roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35 },
  /** Epoxy LED: r .12–.20, cc 1.0/.08, transparansi palsu tanpa transmission */
  epoxyLed: { roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 },
  /** PCB solder mask: r .38–.45, cc .5/.30 */
  pcb: { roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 },
  /** Karet: r .75–.90, matte penuh */
  karet: { roughness: 0.82, metalness: 0, clearcoat: 0, clearcoatRoughness: 0 },
  /** Kaca (fuse, diode DO-35): r .05–.12, cc 1.0/.05, opacity rendah */
  kaca: { roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 },
  /** Metal pin/kaki: r .30–.45, m 1.0 — wajib kena environment map */
  metalPin: { roughness: 0.38, metalness: 1, clearcoat: 0, clearcoatRoughness: 0 },
  /** Can aluminium (elco, motor): r .35–.50, m 1.0 */
  canAluminium: { roughness: 0.42, metalness: 1, clearcoat: 0, clearcoatRoughness: 0 },
  /** Keramik (kapasitor keramik): r .45–.55, cc .3/.40 */
  keramik: { roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 },
  /** Breadboard krem: r .40–.50, cc .3/.40 */
  breadboardKrem: { roughness: 0.45, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 },
} as const satisfies Record<string, Material3DParams>;

export type MaterialClass3D = keyof typeof MATERIAL_PARAMS;

/**
 * §4 — token warna material. Warna fungsional (grup pertama) hue-nya
 * TERKUNCI: jangan digeser, jangan diganti varian "lebih cantik".
 */
export const COLOR_TOKENS = {
  // — Fungsional (terkunci) —
  /** Gelang resistor EIA 0–9, dipanen dari resistor/model3d.tsx */
  resistorBands: [
    '#000000', '#7a3b1e', '#d42a1e', '#e07b24', '#f2c618',
    '#2e9e4f', '#2456c8', '#7a3fa0', '#8a8f98', '#f2f2f2',
  ],
  resistorGold: '#c9a227',
  /** Kabel servo SG90: cokelat (GND) / merah (VCC) / oranye (SIG) */
  servoWireBrown: '#7c4a21',
  servoWireRed: '#d43a2f',
  servoWireOrange: '#f59e0b',
  /** Rel breadboard MB-102 */
  breadboardRailPlus: '#d42a1e',
  breadboardRailMinus: '#2456c8',
  /** Warna cahaya LED (dari led/model3d.tsx) */
  ledRed: '#ff2222',
  ledYellow: '#ffcc00',
  ledGreen: '#22ff66',
  ledBlue: '#2266ff',
  ledWhite: '#f5f5f5',
  /** Teal PCB Arduino Uno asli */
  unoTeal: '#008184',
  /** Biru badan relay Songle SRD */
  relayBlue: '#1d6fd1',
  /** Biru case servo SG90 */
  servoCaseBlue: '#2f6fd0',

  // — Logam mulia & kabel (dipanen dari soil-moisture FC-28) —
  /** Emas pelapis pin header & elektroda garpu probe FC-28 */
  goldPlated: '#d4af37',
  /** Emas lebih gelap: garis jalur di muka elektroda garpu */
  goldTrace: '#a8842c',
  /** Kuningan sekrup trimpot FC-28 */
  brassScrew: '#b08d3e',
  /** Insulasi kabel merah penghubung modul ↔ probe FC-28 */
  cableRed: '#b91c1c',

  // — Netral / material —
  plastikHitam: '#1b1b1f',
  karetGelap: '#23262d',
  metalPin: '#cfd4dc',
  canAluminium: '#c8ccd2',
  breadboardBody: '#f2ede2',
  resistorBody: '#d8b98a',
  keramikKrem: '#d8b98a',
} as const;

/** Warna & opacity bawaan per kelas bila pemanggil tidak memberi warna. */
export const MATERIAL_DEFAULTS: Record<
  MaterialClass3D,
  { color: string; opacity: number }
> = {
  absWarna: { color: '#ffffff', opacity: 1 },
  plastikHitam: { color: COLOR_TOKENS.plastikHitam, opacity: 1 },
  epoxyLed: { color: '#ffffff', opacity: 0.65 }, // tengah rentang .55–.75 (§3)
  pcb: { color: '#ffffff', opacity: 1 },
  karet: { color: COLOR_TOKENS.karetGelap, opacity: 1 },
  kaca: { color: '#ffffff', opacity: 0.3 },
  metalPin: { color: COLOR_TOKENS.metalPin, opacity: 1 },
  canAluminium: { color: COLOR_TOKENS.canAluminium, opacity: 1 },
  keramik: { color: COLOR_TOKENS.keramikKrem, opacity: 1 },
  breadboardKrem: { color: COLOR_TOKENS.breadboardBody, opacity: 1 },
};

export interface Material3DOverrides {
  color?: string;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transparent?: boolean;
  side?: THREE.Side;
  flatShading?: boolean;
}

function resolveMaterialProps(
  kind: MaterialClass3D,
  overrides: Material3DOverrides,
): Record<string, unknown> {
  const params = MATERIAL_PARAMS[kind];
  const defaults = MATERIAL_DEFAULTS[kind];
  const opacity = overrides.opacity ?? defaults.opacity;
  return {
    color: overrides.color ?? defaults.color,
    roughness: overrides.roughness ?? params.roughness,
    metalness: overrides.metalness ?? params.metalness,
    clearcoat: overrides.clearcoat ?? params.clearcoat,
    clearcoatRoughness: overrides.clearcoatRoughness ?? params.clearcoatRoughness,
    opacity,
    transparent: overrides.transparent ?? opacity < 1,
    emissive: overrides.emissive ?? '#000000',
    emissiveIntensity: overrides.emissiveIntensity ?? 1,
    side: overrides.side ?? THREE.FrontSide,
    flatShading: overrides.flatShading ?? false,
  };
}

/**
 * Props siap sebar untuk JSX: `<meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />`.
 * Untuk warna non-bawaan pakai `createMaterial3D` / `getMaterial3D`.
 */
export const MATERIAL_PROPS: Record<
  MaterialClass3D,
  ReturnType<typeof resolveMaterialProps>
> = Object.fromEntries(
  (Object.keys(MATERIAL_PARAMS) as MaterialClass3D[]).map((kind) => [
    kind,
    resolveMaterialProps(kind, {}),
  ]),
) as Record<MaterialClass3D, ReturnType<typeof resolveMaterialProps>>;

/** Buat material fisik BARU dari kelas §3 + override seperlunya. */
export function createMaterial3D(
  kind: MaterialClass3D,
  overrides: Material3DOverrides = {},
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial(resolveMaterialProps(kind, overrides));
}

const sharedCache = new Map<string, THREE.MeshPhysicalMaterial>();

/**
 * Material BERSAMA ter-cache untuk badan statis (§2.7). Kunci = kelas +
 * override ter-resolve; instance yang sama dikembalikan untuk kombinasi
 * yang sama. JANGAN mutasi material hasil fungsi ini (dipakai banyak
 * komponen) — untuk material yang berubah per instance gunakan
 * `createMaterial3D`. Material bersama hidup selama aplikasi; tidak
 * perlu di-dispose manual.
 */
export function getMaterial3D(
  kind: MaterialClass3D,
  overrides: Material3DOverrides = {},
): THREE.MeshPhysicalMaterial {
  const props = resolveMaterialProps(kind, overrides);
  const key = [
    kind,
    props.color, props.opacity, props.roughness, props.metalness,
    props.clearcoat, props.clearcoatRoughness, props.transparent,
    props.side, props.flatShading,
  ].join('|');
  let material = sharedCache.get(key);
  if (!material) {
    material = new THREE.MeshPhysicalMaterial(props);
    sharedCache.set(key, material);
  }
  return material;
}

/**
 * §4 sebagai kode (Color Expert: encode the derivation, don't freeze a
 * literal): naikkan saturasi HSL sebesar `amount` (bawaan 0,125 = tengah
 * rentang +10–15% spesifikasi) dari warna benda asli, TANPA menggeser hue.
 * Lightness sengaja TIDAK di-clamp di sini — pita lightness 35–65% §4
 * adalah aturan memilih warna dasar badan, dan token terkunci seperti
 * putih LED (#f5f5f5) memang sah di luar pita itu.
 */
export function vivid(hex: string, amount = 0.125): string {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  // Eksplisit sRGB: getHSL/setHSL bawaan three bekerja di ruang kerja
  // linear, yang mengompresi kenaikan saturasi dari maksud §4.
  color.getHSL(hsl, THREE.SRGBColorSpace);
  color.setHSL(
    hsl.h,
    Math.min(1, hsl.s * (1 + amount)),
    hsl.l,
    THREE.SRGBColorSpace,
  );
  return `#${color.getHexString()}`;
}
