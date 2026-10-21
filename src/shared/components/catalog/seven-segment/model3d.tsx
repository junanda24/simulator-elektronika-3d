import { useEffect, useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
  createMaterial3D,
} from '../../../../features/stage3d/materials3d';
import { createTextLabelTexture } from '../../../../features/stage3d/labelTexture';

/**
 * Warna segmen saat mati: abu pucat NETRAL seperti segmen LED asli yang
 * tak menyala di muka display gelap 5611BH (moodboard B12: "segmen
 * terlihat samar saat mati") — diturunkan dari token abu gelang
 * resistor ditarik ke putih gelang 9, TANPA rona merah (perintah user
 * 2026-10-21: badan jangan merah agar angka menyala terbaca; bukan hex
 * liar — §4: warna diturunkan, bukan dikarang). Hasil ≈ #b2b4b9.
 */
const SEGMENT_OFF = `#${new THREE.Color(COLOR_TOKENS.resistorBands[8])
  .lerp(new THREE.Color(COLOR_TOKENS.resistorBands[9]), 0.3)
  .getHexString()}`;
/**
 * Warna pendaran segmen saat menyala — MERAH DALAM PEKAT. Token
 * ledRed (#ff2222) mengandung kanal G/B 0x22 yang, digabung difus abu
 * terang segmen yang terangkat lampu adegan, tercuci tone mapping
 * ACES menjadi merah muda pucat (terukur: tampilan akhir ≈
 * (0.97, 0.57, 0.59), rasio kejenuhan min/max pasca-ACES 0,30).
 * Koreksi 2026-10-21 (perintah user "merah di tulisannya lebih pekat
 * lagi!"): kanal G/B token DITEKAN KE NOL (rona tetap merah 0° persis,
 * bukan oranye/magenta) → #ff0000; rona murni ini tidak bisa tercuci
 * ACES karena tidak ada kanal lain yang terangkat (rasio → 0,002).
 */
const SEGMENT_ON_BASE = new THREE.Color(COLOR_TOKENS.ledRed);
SEGMENT_ON_BASE.g = 0;
SEGMENT_ON_BASE.b = 0;
const SEGMENT_ON = `#${SEGMENT_ON_BASE.getHexString()}`;
/**
 * Difus segmen dalam keadaan menyala: merah pekat yang sama
 * digelapkan (×0,30 linear ≈ #950000) agar lampu adegan hanya
 * menambah kanal merah — bahan menjadi emissive-dominan. Segmen mati
 * tetap memakai SEGMENT_OFF (abu pucat netral); difus dirender
 * sebagai lerp keduanya mengikuti pecahan arus (segmentDiffuse).
 */
const SEGMENT_ON_DIFFUSE = `#${SEGMENT_ON_BASE.clone().multiplyScalar(0.3).getHexString()}`;

const OFF_RGB = new THREE.Color(SEGMENT_OFF);
const ON_RGB = new THREE.Color(SEGMENT_ON_DIFFUSE);
const scratchColor = new THREE.Color();
/** Warna difus segmen pada pecahan nyala f (0 = mati, 1 = penuh). */
const segmentDiffuse = (f: number): string =>
  `#${scratchColor.lerpColors(OFF_RGB, ON_RGB, f).getHexString()}`;
/**
 * Muka display: arang netral pekat seperti muka asli 5611BH — plastik
 * hitam token digelapkan ke hitam gelang 0, hasil ≈ #1b1b21 (dulu
 * ditarik ke merah LED → #972227, membuat seluruh modul terbaca
 * gumpalan merah dan angka menyala tenggelam; dikoreksi 2026-10-21).
 */
const FACE_COLOR = `#${new THREE.Color(COLOR_TOKENS.plastikHitam)
  .lerp(new THREE.Color(COLOR_TOKENS.resistorBands[0]), 0.3)
  .getHexString()}`;
/** Tinta filter kaca di atas segmen: asap arang netral, hasil ≈ #1f1f25. */
const FILTER_TINT = `#${new THREE.Color(COLOR_TOKENS.plastikHitam)
  .lerp(new THREE.Color(COLOR_TOKENS.resistorBands[0]), 0.15)
  .getHexString()}`;

/** Kemiringan italic khas digit display LED (geser x per satuan z). */
const SLANT = 0.07;

interface SegmentLayout {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
}

/** Tata letak segmen standar di atas lempeng (bidang XZ, y = permukaan). */
const SEGMENTS: SegmentLayout[] = [
  { key: 'a', position: [0, 0.88, -3.2], size: [1.9, 0.16, 0.55] },
  { key: 'g', position: [0, 0.88, 0], size: [1.9, 0.16, 0.55] },
  { key: 'd', position: [0, 0.88, 3.2], size: [1.9, 0.16, 0.55] },
  { key: 'f', position: [-1.1, 0.88, -1.6], size: [0.55, 0.16, 2.6] },
  { key: 'b', position: [1.1, 0.88, -1.6], size: [0.55, 0.16, 2.6] },
  { key: 'e', position: [-1.1, 0.88, 1.6], size: [0.55, 0.16, 2.6] },
  { key: 'c', position: [1.1, 0.88, 1.6], size: [0.55, 0.16, 2.6] },
];

/**
 * Geometri satu segmen: batang berujung RUNCING heksagonal (bentuk
 * segmen display sejati — bukan persegi siku; kesenjangan inventaris
 * #8), diekstrusi tipis lalu dibaringkan, diposisikan, dan digeser
 * mengikuti slant digit. Dibangun sekali di level modul dan dipakai
 * bersama semua instance (dispose={null}).
 */
function buildSegmentGeometry(seg: SegmentLayout): THREE.BufferGeometry {
  const vertical = seg.size[2] > seg.size[0];
  const len = vertical ? seg.size[2] : seg.size[0];
  const thick = vertical ? seg.size[0] : seg.size[2];
  const hl = len / 2;
  const ht = thick / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hl, 0);
  shape.lineTo(-hl + ht, ht);
  shape.lineTo(hl - ht, ht);
  shape.lineTo(hl, 0);
  shape.lineTo(hl - ht, -ht);
  shape.lineTo(-hl + ht, -ht);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 1,
  });
  // Baringkan: bidang bentuk XY → XZ, arah ekstrusi menjadi +y.
  geo.rotateX(-Math.PI / 2);
  if (vertical) geo.rotateY(Math.PI / 2);
  geo.translate(seg.position[0], 0, seg.position[2]);
  // Slant italic: puncak digit (z negatif) bergeser ke +x.
  const shear = new THREE.Matrix4().set(
    1, 0, -SLANT, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  );
  geo.applyMatrix4(shear);
  return geo;
}

const SEGMENT_GEOMETRIES: Record<string, THREE.BufferGeometry> = Object.fromEntries(
  SEGMENTS.map((seg) => [seg.key, buildSegmentGeometry(seg)]),
);

/**
 * Display 7-segment 0,56" prosedural (Gelombang 2 gaya 3D): lempeng
 * epoxy berbevel dengan muka arang netral pekat + filter asap gelap, 7 segmen
 * berujung heksagonal + slant digit di balik lapisan filter, titik
 * desimal, dan cetakan tipe "5611BH" (katoda umum) di tepi bawah muka
 * seperti modul asli. Emissive tiap segmen sebanding arus cabangnya
 * dari simState (20 mA = menyala penuh) + pointLight ×10/jarak 8.
 * Pengali emissive 2,4× (bukan 3,6× lama): sejak koreksi kepekatan
 * 2026-10-21 emissive adalah merah murni #ff0000 dan difus menyala
 * merah pekat, jadi kejenuhan tak lagi bergantung intensitas dan
 * 2,4× cukup memberi luminansi ±17× muka arang tanpa roll-off ACES
 * yang mencuci warna (hitungan lengkap di komentar SEGMENT_ON).
 */
export const SevenSegmentRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const currents = instance.simState.branchCurrents;
  const intensityOf = (key: string) =>
    Math.min(1, Math.max(0, Math.abs(currents[key] ?? 0) / 0.02));
  const anyLit = SEGMENTS.some((s) => intensityOf(s.key) > 0.05) || intensityOf('dp') > 0.05;
  // Pecahan arus segmen terkuat (20 mA = 1) — menggerakkan cahaya titik.
  const peakFrac = Math.max(0, ...SEGMENTS.map((s) => intensityOf(s.key)), intensityOf('dp'));

  // Lapisan filter kaca asap arang netral di atas segmen (per instance
  // karena material fisik sendiri; dibuang saat unmount).
  const filterMaterial = useMemo(
    () => createMaterial3D('kaca', { color: FILTER_TINT, opacity: 0.35, roughness: 0.25 }),
    [],
  );
  useEffect(() => () => filterMaterial.dispose(), [filterMaterial]);

  // Cetakan tipe di muka bawah — konvensi cetak modul 0,56" katoda umum.
  const typeTexture = useMemo(
    () =>
      createTextLabelTexture({
        width: 512,
        height: 160,
        lines: [{ text: '5611BH', fontSize: 96 }],
        color: '#e3e4e8',
      }),
    [],
  );
  useEffect(() => () => typeTexture.dispose(), [typeTexture]);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki pin pipih khas lead DIP segaris di bawah lempeng (z = -4..+4) */}
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0, z]} castShadow>
          <boxGeometry args={[0.3, 0.9, 0.12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Lempeng display epoxy membulat, muka arang netral pekat */}
      <RoundedBox args={[3.2, 0.8, 8.8]} radius={0.1} smoothness={4} position={[0, 0.45, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={FACE_COLOR} />
      </RoundedBox>

      {/* Batang segmen A–G berujung heksagonal + slant, di bawah filter.
          Difus mengikuti pecahan nyala (abu netral → merah pekat) dan
          roughness 0,6 menahan angkatan specular lampu adegan. */}
      {SEGMENTS.map((seg) => {
        const f = intensityOf(seg.key);
        return (
          <mesh key={seg.key} geometry={SEGMENT_GEOMETRIES[seg.key]} dispose={null} position={[0, 0.85, 0]}>
            <meshStandardMaterial
              color={segmentDiffuse(f)}
              roughness={0.6}
              emissive={SEGMENT_ON}
              emissiveIntensity={f * 2.4}
            />
          </mesh>
        );
      })}

      {/* Titik desimal (DP) di sudut bawah kanan tampilan, ikut slant */}
      <mesh position={[1.5 - SLANT * 3.4, 0.89, 3.4]}>
        <cylinderGeometry args={[0.24, 0.24, 0.08, 20]} />
        <meshStandardMaterial
          color={segmentDiffuse(intensityOf('dp'))}
          roughness={0.6}
          emissive={SEGMENT_ON}
          emissiveIntensity={intensityOf('dp') * 2.4}
        />
      </mesh>

      {/* Lapisan filter kaca asap arang netral menutup muka digit */}
      <RoundedBox args={[3.2, 0.04, 8.8]} radius={0.02} smoothness={2} position={[0, 0.99, 0]}>
        <primitive object={filterMaterial} attach="material" />
      </RoundedBox>

      {/* Cetakan tipe kecil di tepi bawah muka */}
      <mesh position={[-SLANT * 3.95, 1.015, 3.95]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, 0.5]} />
        <meshStandardMaterial
          map={typeTexture}
          transparent
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {anyLit && (
        <pointLight
          position={[0, 2.4, 0]}
          color={SEGMENT_ON}
          intensity={peakFrac * 10}
          distance={8}
          decay={2}
        />
      )}
    </group>
  );
};
