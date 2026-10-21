import { useEffect, useMemo, type ComponentType } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { createTextLabelTexture } from '../../../../features/stage3d/labelTexture';

/**
 * Baterai 9V 6LR61 prosedural, setia datasheet (riset 2026-10-21):
 * balok 48,5 × 26,5 × 17,5 mm (tinggi 19,1 × lebar 10,4 × tebal 6,9
 * satuan) berdiri di alas, jaket hitam generik TANPA merek dagang,
 * pita label atas bertuliskan "9V ALKALINE", dan dua terminal snap
 * di muka atas berjarak pusat 12,7 mm: stud jantan (+) Ø ±5,5 mm
 * yang lebih kecil (x −2,5) dan soket betina (−) Ø ±8,5 mm yang
 * lebih besar (x +2,5), masing-masing bertanda + / − tercetak.
 */
export const Battery9vRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const labelTexture = useMemo(
    () =>
      createTextLabelTexture({
        width: 512,
        height: 640,
        lines: [
          { text: '9V', fontSize: 210 },
          { text: 'ALKALINE', fontSize: 74 },
          { text: '6LR61', fontSize: 60 },
        ],
        color: '#e8e6df',
      }),
    [],
  );
  useEffect(() => () => labelTexture.dispose(), [labelTexture]);

  const plusTexture = useMemo(
    () => createTextLabelTexture({ width: 128, height: 128, lines: [{ text: '+', fontSize: 100 }], color: '#e8e6df' }),
    [],
  );
  useEffect(() => () => plusTexture.dispose(), [plusTexture]);
  const minusTexture = useMemo(
    () => createTextLabelTexture({ width: 128, height: 128, lines: [{ text: '−', fontSize: 100 }], color: '#e8e6df' }),
    [],
  );
  useEffect(() => () => minusTexture.dispose(), [minusTexture]);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Badan jaket hitam */}
      <RoundedBox args={[10.4, 19.1, 6.9]} radius={0.35} smoothness={4} position={[0, 9.55, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </RoundedBox>

      {/* Pita label atas (top cap) tempat terminal snap menempel */}
      <mesh position={[0, 18.55, 0]} castShadow>
        <boxGeometry args={[10.45, 1.5, 6.95]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.karet} color={COLOR_TOKENS.karetGelap} />
      </mesh>

      {/* Label muka depan (+z): generik, tanpa merek dagang */}
      <mesh position={[0, 12.5, 3.47]}>
        <planeGeometry args={[8.6, 10.75]} />
        <meshStandardMaterial
          map={labelTexture}
          transparent
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Terminal snap + (stud jantan, lebih kecil) di x −2,5 */}
      <mesh position={[-2.5, 19.55, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.15, 0.95, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Terminal snap − (soket betina, lebih besar) di x +2,5:
          silinder logam dengan lubang gelap di tengahnya */}
      <mesh position={[2.5, 19.5, 0]} castShadow>
        <cylinderGeometry args={[1.55, 1.6, 0.85, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[2.5, 19.94, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.06, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.karet} color={COLOR_TOKENS.karetGelap} />
      </mesh>

      {/* Tanda + / − tercetak di muka atas di samping terminalnya */}
      <mesh position={[-2.5, 19.31, 2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial map={plusTexture} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[2.5, 19.31, 2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial map={minusTexture} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  );
};
