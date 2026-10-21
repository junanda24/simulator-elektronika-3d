import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/**
 * Dioda 1N4007 prosedural: badan silinder hitam mendatar sepanjang Z,
 * gelang perak di ujung katoda (+Z lokal), kaki aksial yang menekuk
 * turun tepat di posisi pin elektrik (z = ±1). Rusak = badan retak gelap
 * (tetap hitam, gelang hilang ditelan warna gosong).
 */
export const DiodeRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tekukan kaki turun ke lubang breadboard (posisi = pin elektrik ±1) */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`drop-${side}`} position={[0, 0.05, side]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.7, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      {/* Kaki aksial horizontal dari badan ke tekukan */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`lead-${side}`}
          position={[0, 0.9, side * 0.85]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.09, 0.09, 0.5, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Badan hitam mendatar */}
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.52, 0.52, 1.2, 20]} />
        <meshStandardMaterial color={damaged ? '#0a0a0a' : '#17181c'} roughness={0.5} />
      </mesh>

      {/* Gelang perak penanda katoda (+Z) */}
      {!damaged && (
        <mesh position={[0, 0.9, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.54, 0.54, 0.22, 20]} />
          <meshStandardMaterial color="#d7dce3" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
};
