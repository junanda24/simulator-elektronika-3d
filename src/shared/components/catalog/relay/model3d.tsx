import { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';
import { playClick } from '../../../utils/soundFx';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Posisi kaki sesuai pin elektrik: kolom koil x=-1.5, kolom kontak x=+1.5. */
const LEG_POSITIONS: Array<[number, number]> = [
  [-1.5, -1],
  [-1.5, 0],
  [-1.5, 1],
  [1.5, -1],
  [1.5, 0],
  [1.5, 1],
];

/**
 * Modul relay 5 V prosedural: pelat PCB hijau, balok relay biru khas
 * di sisi koil, blok terminal gelap di sisi kontak, dan LED indikator
 * merah yang menyala saat branchCurrents.active === 1.
 */
export const RelayRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const activeValue = instance.simState.branchCurrents['active'] ?? 0;
  const active = activeValue === 1;

  // Bunyi "tak!" mekanis setiap kali koil berubah status.
  // Ref diinisialisasi dari nilai awal agar mount pertama tidak berbunyi.
  const prevActiveRef = useRef(activeValue);
  useEffect(() => {
    if (prevActiveRef.current !== activeValue) {
      prevActiveRef.current = activeValue;
      playClick(1200);
    }
  }, [activeValue]);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Enam kaki pendek menuju pin elektrik */}
      {LEG_POSITIONS.map(([x, z]) => (
        <mesh key={`leg-${x}-${z}`} position={[x, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Pelat PCB hijau */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[7.6, 0.45, 4.6]} />
        <meshStandardMaterial color="#15803d" roughness={0.6} />
      </mesh>

      {/* Balok relay biru khas */}
      <mesh position={[-0.9, 2.55, 0]} castShadow>
        <boxGeometry args={[4.6, 3.1, 3.4]} />
        <meshStandardMaterial color="#1d6fd1" roughness={0.4} />
      </mesh>
      {/* Cap putih di atas balok (area label relay) */}
      <mesh position={[-0.9, 4.12, 0]}>
        <boxGeometry args={[3.4, 0.05, 2.4]} />
        <meshStandardMaterial color="#e8ecf1" roughness={0.5} />
      </mesh>

      {/* Blok terminal kontak (COM/NO/NC) */}
      <mesh position={[2.7, 1.7, 0]} castShadow>
        <boxGeometry args={[1.6, 1.4, 3.4]} />
        <meshStandardMaterial color="#23262d" roughness={0.6} />
      </mesh>

      {/* LED indikator merah — menyala saat relay aktif */}
      <mesh position={[2.7, 1.25, -1.55]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.5, 16]} />
        <meshStandardMaterial
          color="#ff2a2a"
          roughness={0.3}
          emissive="#ff2a2a"
          emissiveIntensity={active ? 2.2 : 0.04}
        />
      </mesh>
      {active && (
        <pointLight position={[2.7, 2.2, -1.55]} color="#ff2a2a" intensity={6} distance={8} decay={2} />
      )}
    </group>
  );
};
