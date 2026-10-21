import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/**
 * Kapasitor elektrolit prosedural: tabung silinder tegak biru gelap,
 * garis perak vertikal di sisi minus (+Z lokal), tutup atas perak,
 * kaki plus lebih panjang dari kaki minus. Rusak = badan menghitam.
 */
export const CapacitorRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki plus (+) — lebih panjang, sisi lokal -Z (posisi = pin elektrik) */}
      <mesh position={[0, 0.3, -1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.6, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Kaki minus (-) — lebih pendek, sisi lokal +Z (posisi = pin elektrik) */}
      <mesh position={[0, 0.15, 1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.3, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>

      {/* Badan tabung */}
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.3, 3, 28]} />
        <meshStandardMaterial color={damaged ? '#151312' : '#1e40af'} roughness={0.45} />
      </mesh>

      {/* Garis perak penanda sisi minus */}
      {!damaged && (
        <mesh position={[0, 2.4, 1.27]}>
          <boxGeometry args={[0.66, 2.9, 0.1]} />
          <meshStandardMaterial color="#d7dce3" metalness={0.6} roughness={0.35} />
        </mesh>
      )}

      {/* Tutup atas perak */}
      <mesh position={[0, 3.92, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.3, 0.06, 28]} />
        <meshStandardMaterial color="#c8ccd2" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  );
};
