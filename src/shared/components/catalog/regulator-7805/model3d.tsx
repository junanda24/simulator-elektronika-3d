import { useEffect, useMemo, type ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { createTextLabelTexture } from '../../../../features/stage3d/labelTexture';

/**
 * Regulator L7805 paket TO-220 prosedural, setia tabel mekanik
 * TO-220AB (riset komponen 2026-10-21): badan plastik ±10 mm lebar
 * (z 3,94 satuan) × ±9 mm tinggi × ±4,4 mm tebal (x 1,73), TAB LOGAM
 * di sisi belakang (−x) menjulang di atas badan dengan lubang baut
 * Ø ±3,8 mm — tab ini terhubung ke GND (beda dari MOSFET yang tab-nya
 * Drain). Tiga kaki pipih pitch 2,54 mm (sebaris sumbu z: IN −1,
 * GND 0, OUT +1) turun ke papan. Muka depan (+x) memuat cetakan
 * laser-etch "L7805CV" + baris fungsi seperti unit ST asli.
 */
export const Regulator7805Render3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const faceTexture = useMemo(
    () =>
      createTextLabelTexture({
        width: 512,
        height: 512,
        lines: [
          { text: 'L7805CV', fontSize: 92 },
          { text: 'REGULATOR 5V', fontSize: 52 },
        ],
        color: '#c8ccd4',
      }),
    [],
  );
  useEffect(() => () => faceTexture.dispose(), [faceTexture]);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki pipih TO-220 dari papan ke bawah badan */}
      {[-1, 0, 1].map((z) => (
        <mesh key={`leg-${z}`} position={[0, 1.2, z]} castShadow>
          <boxGeometry args={[0.2, 2.4, 0.31]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Badan epoksi hitam tegak (muka depan menghadap +x) */}
      <mesh position={[0, 4.17, 0]} castShadow>
        <boxGeometry args={[1.73, 3.54, 3.94]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>

      {/* Tab logam belakang (−x) menjulang di atas badan — tab = GND.
          Silinder gelap di tengah atas tab = lubang baut Ø3,8 mm. */}
      <mesh position={[-1.02, 5.55, 0]} castShadow>
        <boxGeometry args={[0.3, 5.9, 3.94]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[-1.2, 7.6, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.62, 0.62, 0.36, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.karet} color={COLOR_TOKENS.karetGelap} />
      </mesh>

      {/* Cetakan muka depan: tipe + fungsi, abu laser-etch */}
      <mesh position={[0.875, 4.17, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshStandardMaterial
          map={faceTexture}
          transparent
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
};
