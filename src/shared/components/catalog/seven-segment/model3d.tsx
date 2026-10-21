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
 * Warna segmen saat mati: abu pucat kemerahan seperti segmen LED asli di
 * balik filter merah gelap (moodboard B12: "segmen terlihat samar saat
 * mati"). Diturunkan dari token abu gelang resistor + token merah LED —
 * bukan hex liar (§4: warna diturunkan, bukan dikarang).
 */
const SEGMENT_OFF = `#${new THREE.Color(COLOR_TOKENS.resistorBands[8])
  .lerp(new THREE.Color(COLOR_TOKENS.ledRed), 0.3)
  .getHexString()}`;
/** Warna pendaran segmen saat menyala — token fungsional warna LED. */
const SEGMENT_ON = COLOR_TOKENS.ledRed;
/** Muka display: hitam plastik token yang ditarik ke merah LED (filter gelap). */
const FACE_COLOR = `#${new THREE.Color(COLOR_TOKENS.plastikHitam)
  .lerp(new THREE.Color(COLOR_TOKENS.ledRed), 0.3)
  .getHexString()}`;
/** Tinta filter kaca di atas segmen: merah LED digelapkan. */
const FILTER_TINT = `#${new THREE.Color(COLOR_TOKENS.ledRed)
  .lerp(new THREE.Color(COLOR_TOKENS.plastikHitam), 0.55)
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
 * epoxy berbevel dengan muka filter merah gelap mengilap, 7 segmen
 * berujung heksagonal + slant digit di balik lapisan filter, titik
 * desimal, dan cetakan tipe "5611BH" (katoda umum) di tepi bawah muka
 * seperti modul asli. Emissive tiap segmen sebanding arus cabangnya
 * dari simState (20 mA = menyala penuh, pengali 3,6× + pointLight
 * ×10/jarak 8 — ditegaskan 2026-10-21, SPEK-TEMA-GELAP.md §B).
 */
export const SevenSegmentRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const currents = instance.simState.branchCurrents;
  const intensityOf = (key: string) =>
    Math.min(1, Math.max(0, Math.abs(currents[key] ?? 0) / 0.02));
  const anyLit = SEGMENTS.some((s) => intensityOf(s.key) > 0.05) || intensityOf('dp') > 0.05;
  // Pecahan arus segmen terkuat (20 mA = 1) — menggerakkan cahaya titik.
  const peakFrac = Math.max(0, ...SEGMENTS.map((s) => intensityOf(s.key)), intensityOf('dp'));

  // Lapisan filter kaca merah gelap di atas segmen (per instance karena
  // material fisik sendiri; dibuang saat unmount).
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
        color: '#d9cfcf',
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

      {/* Lempeng display epoxy membulat, muka filter merah gelap */}
      <RoundedBox args={[3.2, 0.8, 8.8]} radius={0.1} smoothness={4} position={[0, 0.45, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={FACE_COLOR} />
      </RoundedBox>

      {/* Batang segmen A–G berujung heksagonal + slant, di bawah filter */}
      {SEGMENTS.map((seg) => (
        <mesh key={seg.key} geometry={SEGMENT_GEOMETRIES[seg.key]} dispose={null} position={[0, 0.85, 0]}>
          <meshStandardMaterial
            color={SEGMENT_OFF}
            roughness={0.4}
            emissive={SEGMENT_ON}
            emissiveIntensity={intensityOf(seg.key) * 3.6}
          />
        </mesh>
      ))}

      {/* Titik desimal (DP) di sudut bawah kanan tampilan, ikut slant */}
      <mesh position={[1.5 - SLANT * 3.4, 0.89, 3.4]}>
        <cylinderGeometry args={[0.24, 0.24, 0.08, 20]} />
        <meshStandardMaterial
          color={SEGMENT_OFF}
          roughness={0.4}
          emissive={SEGMENT_ON}
          emissiveIntensity={intensityOf('dp') * 3.6}
        />
      </mesh>

      {/* Lapisan filter kaca merah gelap mengilap menutup muka digit */}
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
          color="#ff2a2a"
          intensity={peakFrac * 10}
          distance={8}
          decay={2}
        />
      )}
    </group>
  );
};
