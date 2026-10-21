import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Posisi kaki sesuai pin elektrik: E (-1), B (0), C (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/**
 * Transistor TO-92 prosedural: badan setengah silinder hitam — diameter
 * penampang sejajar sumbu Z (menampung ketiga kaki E-B-C), sisi datar
 * menghadap -X ditutup pelat tipis; tiga kaki metalik sejajar.
 * Rusak = badan menghitam legam.
 */
export const TransistorRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki metalik menuju pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.05, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Badan setengah silinder (busur menghadap +X, diameter sepanjang Z) */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.05, 2.5, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={damaged ? '#0a0a0a' : '#1b1d22'} roughness={0.55} />
      </mesh>
      {/* Pelat penutup sisi datar (-X) */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <boxGeometry args={[0.06, 2.5, 2.1]} />
        <meshStandardMaterial color={damaged ? '#0a0a0a' : '#1b1d22'} roughness={0.55} />
      </mesh>
    </group>
  );
};
