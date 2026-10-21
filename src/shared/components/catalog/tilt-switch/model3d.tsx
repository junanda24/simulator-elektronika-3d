import { useRef, type ComponentType } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
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

  // Animasi miring halus: sudut badan diinterpolasi menuju target state
  // (±25°) lewat ref grup, bukan berganti seketika.
  const bodyRef = useRef<Group>(null);
  const targetAngle = tilted ? -TILT_RAD : TILT_RAD;
  const targetAngleRef = useRef(targetAngle);
  targetAngleRef.current = targetAngle;
  const currentAngleRef = useRef(targetAngle);

  useFrame((_state, delta) => {
    const next = MathUtils.lerp(
      currentAngleRef.current,
      targetAngleRef.current,
      1 - Math.exp(-12 * delta),
    );
    currentAngleRef.current = next;
    if (bodyRef.current) bodyRef.current.rotation.z = next;
  });

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

      {/* Tabung logam miring mengikuti state (dianimasikan via useFrame) */}
      <group ref={bodyRef} position={[0, 0.7, 0]} rotation={[0, 0, tilted ? -TILT_RAD : TILT_RAD]}>
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
