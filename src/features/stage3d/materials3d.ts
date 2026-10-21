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
 * - §4 (DIPERBARUI 2026-10-21 sore — SPEK-WARNA-SEGAR.md, lalu
 *   dikoreksi arah SOLID di hari yang sama): batas lama "saturasi hanya
 *   +10–15%" DIBATALKAN user untuk warna badan/obyek (terasa tua/kusam);
 *   arah SEGAR & MUDA dipertahankan lewat nilai token itu sendiri, TAPI
 *   pengangkatan lightness pada derivasi `vivid()` DIBUANG atas perintah
 *   user ("warna lebih solid") — lightness yang diangkat membuat warna
 *   berkapur/pastel. Kini: saturasi naik, lightness = nilai asal token.
 *   Hue warna FUNGSIONAL (gelang resistor, kabel servo, rel breadboard,
 *   warna LED) tetap TERKUNCI maknanya: boleh lebih jenuh, tidak
 *   digeser. Token di COLOR_TOKENS adalah satu-satunya sumber nilai;
 *   file komponen TIDAK BOLEH memakai hex liar baru.
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

/**
 * §3 — parameter PBR per kelas. Kelas PLASTIK badan komponen dinaikkan
 * roughness-nya +0,15 dari titik tengah spesifikasi atas perintah user
 * arah SOLID 2026-10-21 ("warna lebih solid", plastik lebih matte —
 * pantulan mengilap adalah bagian dari rasa "shimmering" yang dibuang).
 * Yang naik: absWarna, plastikHitam, pcb, keramik, breadboardKrem.
 * Yang SENGAJA tidak diubah: epoxyLed & kaca (kelas optik/transparan —
 * kilapnya adalah identitas bahan), karet (sudah matte penuh 0,82),
 * dan semua logam (metalPin, canAluminium — memang harus memantul).
 */
export const MATERIAL_PARAMS = {
  /** Plastik ABS mainan (badan warna): r .30–.38 +0,15 SOLID, cc .7/.30 */
  absWarna: { roughness: 0.49, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.3 },
  /** Plastik hitam: r .35–.45 +0,15 SOLID, cc .5/.35, warna #1B1B1F (bukan #000) */
  plastikHitam: { roughness: 0.55, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.35 },
  /** Epoxy LED: r .12–.20, cc 1.0/.08, transparansi palsu tanpa transmission */
  epoxyLed: { roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 },
  /** PCB solder mask: r .38–.45 +0,15 SOLID, cc .5/.30 */
  pcb: { roughness: 0.57, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 },
  /** Karet: r .75–.90, matte penuh */
  karet: { roughness: 0.82, metalness: 0, clearcoat: 0, clearcoatRoughness: 0 },
  /** Kaca (fuse, diode DO-35): r .05–.12, cc 1.0/.05, opacity rendah */
  kaca: { roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 },
  /** Metal pin/kaki: r .30–.45, m 1.0 — wajib kena environment map */
  metalPin: { roughness: 0.38, metalness: 1, clearcoat: 0, clearcoatRoughness: 0 },
  /** Can aluminium (elco, motor): r .35–.50, m 1.0 */
  canAluminium: { roughness: 0.42, metalness: 1, clearcoat: 0, clearcoatRoughness: 0 },
  /** Keramik (kapasitor keramik): r .45–.55 +0,15 SOLID, cc .3/.40 */
  keramik: { roughness: 0.65, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 },
  /** Breadboard krem: r .40–.50 +0,15 SOLID, cc .3/.40 */
  breadboardKrem: { roughness: 0.6, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 },
} as const satisfies Record<string, Material3DParams>;

export type MaterialClass3D = keyof typeof MATERIAL_PARAMS;

/**
 * §4 — token warna material. Warna fungsional (grup pertama) hue-nya
 * TERKUNCI: jangan digeser, jangan diganti varian "lebih cantik".
 */
export const COLOR_TOKENS = {
  // — Fungsional (hue terkunci; nilai per SPEK-WARNA-SEGAR §2) —
  /** Gelang resistor EIA 0–9 — standar internasional, TIDAK diubah */
  resistorBands: [
    '#000000', '#7a3b1e', '#d42a1e', '#e07b24', '#f2c618',
    '#2e9e4f', '#2456c8', '#7a3fa0', '#8a8f98', '#f2f2f2',
  ],
  resistorGold: '#c9a227',
  /** Kabel servo SG90: cokelat (GND) / merah (VCC) / oranye (SIG) */
  servoWireBrown: '#8a5a2b',
  servoWireRed: '#e0402f',
  servoWireOrange: '#f59e0b',
  /** Rel breadboard MB-102 — standar +/−, TIDAK diubah */
  breadboardRailPlus: '#d42a1e',
  breadboardRailMinus: '#2456c8',
  /** Warna cahaya LED (dari led/model3d.tsx) */
  ledRed: '#ff2222',
  ledYellow: '#ffcc00',
  ledGreen: '#22ff66',
  ledBlue: '#2266ff',
  ledWhite: '#f5f5f5',
  /** Teal PCB Arduino Uno — hue sama, diangkat ke teal studio terang */
  unoTeal: '#00a6b0',
  /** Biru badan relay Songle SRD — hue sama, lebih bercahaya */
  relayBlue: '#2b7de0',
  /** Biru case servo SG90 — hue sama, lebih ringan & jenuh */
  servoCaseBlue: '#3a86e8',

  // — Logam mulia & kabel (dipanen dari soil-moisture FC-28) —
  /** Emas pelapis pin header & elektroda garpu probe FC-28 */
  goldPlated: '#e4b93e',
  /** Emas lebih gelap: garis jalur di muka elektroda garpu */
  goldTrace: '#be9736',
  /** Kuningan sekrup trimpot FC-28 */
  brassScrew: '#c29b45',
  /** Insulasi kabel merah penghubung modul ↔ probe FC-28 */
  cableRed: '#e02b20',

  // — PCB board generik (SPEK-WARNA-SEGAR §2): diterapkan di
  // GenericBoard menggantikan pcbColor definitions yang nyaris hitam —
  // definitions.ts sendiri disinkronkan pada gelombang sapuan —
  /** PCB ESP32 DevKit: biru tengah malam (asli umumnya hitam — stylisasi) */
  esp32Pcb: '#22335c',
  /** PCB NodeMCU: keluarga biru sama, setingkat lebih terang */
  nodeMcuPcb: '#2b3a67',
  /** PCB Raspberry Pi Pico: hijau segar */
  picoPcb: '#1f9d4d',

  // — Netral / material —
  plastikHitam: '#222229',
  karetGelap: '#2c303a',
  metalPin: '#dce2ea',
  canAluminium: '#d9dee5',
  breadboardBody: '#faf7ee',
  resistorBody: '#eecf9b',
  keramikKrem: '#eecf9b',
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
 * Arah segar sebagai kode (SPEK-WARNA-SEGAR §3, dikoreksi arah SOLID
 * 2026-10-21 atas perintah user "warna lebih solid"; Color Expert:
 * encode the derivation, don't freeze a literal): naikkan saturasi HSL
 * sebesar `amount` (bawaan 0,30) dari warna benda asli TANPA menggeser
 * hue dan TANPA menyentuh lightness — lightness dikembalikan persis ke
 * nilai asal warna token. Versi sebelumnya mengangkat lightness 22%
 * menuju 0,50; angkatan itulah yang membuat warna berkapur/pastel,
 * jadi DIBUANG. Saturasi ×1,30 dipertahankan: warna tetap segar, tapi
 * pekat/solid pada kedalaman aslinya.
 */
export function vivid(hex: string, amount = 0.3): string {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  // Eksplisit sRGB: getHSL/setHSL bawaan three bekerja di ruang kerja
  // linear, yang mengompresi kenaikan saturasi dari maksud arah warna.
  color.getHSL(hsl, THREE.SRGBColorSpace);
  color.setHSL(
    hsl.h,
    Math.min(1, hsl.s * (1 + amount)),
    hsl.l,
    THREE.SRGBColorSpace,
  );
  return `#${color.getHexString()}`;
}
