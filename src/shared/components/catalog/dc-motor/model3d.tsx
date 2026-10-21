import { useRef, type ComponentType } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import type { ComponentRenderProps } from '../../../types';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Posisi kaki sesuai pin elektrik: PLUS z=-1, MINUS z=+1. */
const LEG_POSITIONS: Array<[number, string]> = [
  [-1, '#d43a2f'],
  [1, '#23262d'],
];

/**
 * Motor DC kecil prosedural: silinder perak mendatar (sumbu X), poros,
 * dan baling-baling kecil yang berputar memakai useFrame — kecepatan
 * sudut sebanding arus cabang 'main' (rad/s = arus × 20), berhenti saat
 * poros dikunci (klik motor untuk toggle) atau tidak ada arus.
 */
export const DcMotorRender3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const propRef = useRef<Group>(null);
  const angleRef = useRef(0);
  const locked = instance.interactiveState.locked === true;
  const damaged = instance.simState.isDamaged;
  const current = Math.abs(instance.simState.branchCurrents['main'] ?? 0);

  useFrame((_state, delta) => {
    if (!propRef.current) return;
    if (!locked && !damaged) {
      angleRef.current += current * 20 * Math.min(delta, 0.1);
    }
    propRef.current.rotation.x = angleRef.current;
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ locked: !locked });
  };

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* Kaki berwarna menuju pin elektrik */}
      {LEG_POSITIONS.map(([z, color]) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}

      {/* Badan motor: silinder perak mendatar sepanjang sumbu X */}
      <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.1, 1.1, 3, 24]} />
        <meshStandardMaterial
          color={damaged ? '#4a423c' : '#c8ccd4'}
          metalness={0.85}
          roughness={0.35}
        />
      </mesh>
      {/* Tutup belakang */}
      <mesh position={[-1.6, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.25, 24]} />
        <meshStandardMaterial color="#8f959f" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* Pita label merah melingkari badan (khas motor DC mainan) */}
      <mesh position={[0.15, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.13, 1.13, 0.95, 24]} />
        <meshStandardMaterial color="#c0272d" roughness={0.5} />
      </mesh>

      {/* Poros + baling-baling yang berputar sebanding arus */}
      <group position={[1.6, 1.5, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.9, 10]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <group ref={propRef} position={[0.6, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.18, 3.4, 0.55]} />
            <meshStandardMaterial color={locked ? '#b91c1c' : '#f59e0b'} roughness={0.45} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[0.18, 0.55, 3.4]} />
            <meshStandardMaterial color={locked ? '#b91c1c' : '#f59e0b'} roughness={0.45} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.3, 16]} />
            <meshStandardMaterial color="#23262d" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Badge tegangan motor live dari pinVoltages PLUS − MINUS */}
      <LiveBadge instance={instance} y={4.1} />
    </group>
  );
};
