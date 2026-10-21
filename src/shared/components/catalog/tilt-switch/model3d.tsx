import type { ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Kemiringan tabung (rad, ±25°) mengikuti state tilted. */
const TILT_RAD = (25 * Math.PI) / 180;

/**
 * Saklar miring prosedural: tabung logam kecil di atas dua kaki, miring
 * +25° saat tegak (kontak terbuka) dan −25° saat dimiringkan (kontak
 * tertutup, interactiveState.tilted). Klik tabung untuk toggle.
 */
export const TiltSwitchRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const tilted = instance.interactiveState.tilted === true;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ tilted: !tilted });
  };

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* Dua kaki menuju pin elektrik (z = -1 dan +1) */}
      {[-1, 1].map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Tabung logam miring mengikuti state */}
      <group position={[0, 0.7, 0]} rotation={[0, 0, tilted ? -TILT_RAD : TILT_RAD]}>
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 1.9, 20]} />
          <meshStandardMaterial color="#d8b13c" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Ujung tabung tempat kabel keluar */}
        <mesh position={[0, 1.95, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.45, 0.35, 16]} />
          <meshStandardMaterial color="#23262d" roughness={0.6} />
        </mesh>
        {/* Bola logam di dalam ujung bawah tabung (penanda kontak) */}
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.34, 16, 12]} />
          <meshStandardMaterial
            color="#e8ecf1"
            metalness={0.95}
            roughness={0.2}
            emissive="#10b981"
            emissiveIntensity={tilted ? 0.5 : 0}
          />
        </mesh>
      </group>
    </group>
  );
};
