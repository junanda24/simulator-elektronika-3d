import { useEffect, useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { createTextLabelTexture } from '../../../../features/stage3d/labelTexture';

/**
 * Merah pendaran segmen menyala — perlakuan yang sama dengan koreksi
 * kepekatan 7-segment 2026-10-21: kanal G/B token ledRed ditekan ke
 * nol (#ff0000, rona merah 0° persis) agar tone mapping ACES tidak
 * mencucinya menjadi merah muda; difus menyala = merah pekat ×0,30.
 */
const SEGMENT_ON_BASE = new THREE.Color(COLOR_TOKENS.ledRed);
SEGMENT_ON_BASE.g = 0;
SEGMENT_ON_BASE.b = 0;
const SEGMENT_ON = `#${SEGMENT_ON_BASE.getHexString()}`;
const SEGMENT_ON_DIFFUSE = `#${SEGMENT_ON_BASE.clone().multiplyScalar(0.3).getHexString()}`;
/** Segmen mati: putih difusi pucat seperti lensa DC-10EWA ("white diffused"). */
const SEGMENT_OFF = '#e9e7e0';
const OFF_RGB = new THREE.Color(SEGMENT_OFF);
const ON_RGB = new THREE.Color(SEGMENT_ON_DIFFUSE);
const scratchColor = new THREE.Color();
const segmentDiffuse = (f: number): string =>
  `#${scratchColor.lerpColors(OFF_RGB, ON_RGB, f).getHexString()}`;
/**
 * Muka paket: abu-abu seperti datasheet ("gray face") — plastik hitam
 * token ditarik ke abu gelang 8. Hasil ≈ #6f6f76.
 */
const FACE_COLOR = `#${new THREE.Color(COLOR_TOKENS.plastikHitam)
  .lerp(new THREE.Color(COLOR_TOKENS.resistorBands[8]), 0.55)
  .getHexString()}`;

/** z lokal segmen ke-i (segmen 1 di ujung tanda anoda, z = −4,5). */
const segZ = (seg: number) => seg - 5.5;

/**
 * Bar graph LED 10-segmen Kingbright DC-10EWA prosedural, setia
 * datasheet DSAD1426: badan 25,4 × 10,16 mm (10 × 4 satuan) muka
 * abu-abu, 10 jendela segmen persegi (lebar 1,78 mm) berjajar di
 * muka atas, dua baris kaki pipih DIP (anoda x −1,5, katoda x +1,5,
 * jarak baris 7,5 mm datasheet ≈ rentangan kanal papan), sudut
 * terpancung + tanda titik di sudut pin 1 (anoda segmen 1), dan
 * cetakan tipe "DC-10EWA" kecil di muka. Emissive tiap segmen
 * mengikuti arus cabangnya ('s1'…'s10', 20 mA = nyala penuh).
 */
export const LedBarGraphRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const currents = instance.simState.branchCurrents;
  const intensityOf = (seg: number) =>
    Math.min(1, Math.max(0, Math.abs(currents[`s${seg}`] ?? 0) / 0.02));
  const peakFrac = Math.max(0, ...Array.from({ length: 10 }, (_, i) => intensityOf(i + 1)));
  const anyLit = peakFrac > 0.05;

  const typeTexture = useMemo(
    () =>
      createTextLabelTexture({
        width: 1024,
        height: 128,
        lines: [{ text: 'DC-10EWA', fontSize: 84 }],
        color: '#2e2e33',
      }),
    [],
  );
  useEffect(() => () => typeTexture.dispose(), [typeTexture]);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Dua baris kaki pipih DIP: anoda (x −1,5) & katoda (x +1,5) */}
      {Array.from({ length: 10 }, (_, i) => segZ(i + 1)).map((z) => (
        <group key={`legs-${z}`}>
          <mesh position={[-1.5, 0.85, z]} castShadow>
            <boxGeometry args={[0.14, 1.7, 0.3]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
          <mesh position={[1.5, 0.85, z]} castShadow>
            <boxGeometry args={[0.14, 1.7, 0.3]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        </group>
      ))}

      {/* Badan paket muka abu-abu (datasheet: gray face) */}
      <RoundedBox args={[4, 2.6, 10]} radius={0.08} smoothness={4} position={[0, 3, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={FACE_COLOR} />
      </RoundedBox>

      {/* Sudut terpancung penanda pin 1 (di sudut anoda segmen 1):
          prisma segitiga kecil sewarna badan menutup sudut muka. */}
      <mesh position={[-1.82, 4.31, -4.82]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.5, 0.02, 0.5]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={FACE_COLOR} />
      </mesh>
      {/* Titik tanda anoda di samping segmen 1 */}
      <mesh position={[-1.55, 4.32, -4.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 20]} />
        <meshStandardMaterial color="#2e2e33" roughness={0.6} />
      </mesh>

      {/* 10 jendela segmen difusi putih di muka atas; menyala merah
          pekat mengikuti arus cabangnya masing-masing. */}
      {Array.from({ length: 10 }, (_, i) => i + 1).map((seg) => {
        const f = intensityOf(seg);
        return (
          <mesh key={`seg-${seg}`} position={[0, 4.32, segZ(seg)]}>
            <boxGeometry args={[2, 0.14, 0.7]} />
            <meshStandardMaterial
              color={segmentDiffuse(f)}
              roughness={0.6}
              emissive={SEGMENT_ON}
              emissiveIntensity={f * 2.4}
            />
          </mesh>
        );
      })}

      {/* Cetakan tipe kecil di tepi muka (di atas segmen 10) */}
      <mesh position={[0, 4.315, 4.55]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 0.42]} />
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
          position={[0, 5.6, 0]}
          color={SEGMENT_ON}
          intensity={peakFrac * 10}
          distance={8}
          decay={2}
        />
      )}
    </group>
  );
};
