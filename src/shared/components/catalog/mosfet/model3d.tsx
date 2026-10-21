import { useMemo, type ComponentType } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { createTextLabelTexture } from '../../../../features/stage3d/labelTexture';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';

/** Epoxy gosong saat MOSFET rusak (preseden LED: badan menghitam legam). */
const BURNT_EPOXY = '#151312';

/** Posisi kaki sesuai pin elektrik: G (-1), D (0), S (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/**
 * MOSFET TO-220AB prosedural setia datasheet (riset komponen 2026-10-21
 * §2): paket asli lebar badan 9,66–10,66 mm, tebal 3,56–4,82 mm, pitch
 * kaki 2,54 mm (persis pitch breadboard proyek), tab logam di belakang
 * dengan lubang baut Ø3,54–4,08 mm — tab adalah Drain, dan orientasi
 * ini yang menentukan kaki G-D-S dari muka bercetak "IRLZ44N".
 * Skala mengikuti footprint terkunci proyek: kaki di z −1/0/+1; badan
 * selebar ±4 satuan (10,16 mm) dan setebal ±1,8 satuan di atas kaki.
 * Muka bercetak menghadap −X seperti keluarga TO-92 proyek.
 */
export const MosfetRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  const faceTexture = useMemo(
    () =>
      createTextLabelTexture({
        width: 512,
        height: 448,
        lines: [
          { text: 'IRLZ44N', fontSize: 92 },
          { text: '924AE', fontSize: 52, color: '#b9bec9' },
        ],
        color: '#e8ecf3',
      }),
    [],
  );

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki perak pipih menuju pin elektrik G-D-S */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 1.05, z]} castShadow>
          <boxGeometry args={[0.55, 2.1, 0.32]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Tab logam belakang (terhubung Drain): lempeng perak menjulang
          di sisi +X dengan lubang baut Ø±1,5 satuan di puncaknya */}
      <mesh position={[0.98, 4.6, 0]} castShadow>
        <boxGeometry args={[0.3, 3.4, 3.3]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[1.14, 5.6, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.52, 0.13, 10, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[1.13, 5.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshStandardMaterial color={COLOR_TOKENS.karetGelap} roughness={0.9} />
      </mesh>

      {/* Badan epoksi hitam TO-220 di depan tab */}
      <RoundedBox
        args={[1.8, 3.6, 4.0]}
        radius={0.12}
        smoothness={4}
        position={[0, 3.9, 0]}
        castShadow
      >
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.plastikHitam}
          color={damaged ? BURNT_EPOXY : COLOR_TOKENS.plastikHitam}
        />
      </RoundedBox>

      {/* Cetakan tipe di muka depan (−X): "IRLZ44N" + baris kode lot */}
      <mesh position={[-0.915, 3.9, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[3.4, 3.0]} />
        <meshStandardMaterial
          map={faceTexture}
          transparent
          roughness={0.55}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
};
