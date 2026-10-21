import type { ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;
const BODY = { color: '#23262d', roughness: 0.6 } as const;
/** Aksen tombol — cyan STYLE_GUIDE (accent primary). */
const CAP = { color: '#00e5ff', roughness: 0.4 } as const;

/** Posisi kaki sesuai pin elektrik: A1, A2 (sisi -x), B1, B2 (sisi +x). */
const LEG_POSITIONS: Array<[number, number]> = [
  [-1.5, -1],
  [-1.5, 1],
  [1.5, -1],
  [1.5, 1],
];

/**
 * Push button tactile prosedural: alas plastik gelap membentang melintasi
 * kanal breadboard, 4 kaki metalik, dan tutup tombol bundar aksen yang
 * turun 0,6 satuan saat ditekan (SIMULATION_RULES.md §3 butir 1).
 * Interaksi: pointerdown menekan (Shift+klik = kunci/latch), pointerup
 * atau pointerleave melepas bila tidak terkunci.
 */
export const PushButtonRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const pressed = instance.interactiveState.pressed === true;
  const latched = instance.interactiveState.latched === true;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.shiftKey) {
      onInteract({ latched: !latched, pressed: !latched });
    } else {
      onInteract({ pressed: true });
    }
  };

  const handleRelease = () => {
    if (!latched) onInteract({ pressed: false });
  };

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handleRelease}
      onPointerLeave={handleRelease}
    >
      {/* Kaki metalik pendek menuju pin elektrik */}
      {LEG_POSITIONS.map(([x, z]) => (
        <mesh key={`leg-${x}-${z}`} position={[x, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Alas plastik gelap melintasi kanal */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[6, 1.2, 4]} />
        <meshStandardMaterial {...BODY} />
      </mesh>

      {/* Leher tombol */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.05, 0.3, 20]} />
        <meshStandardMaterial {...BODY} />
      </mesh>

      {/* Tutup tombol bundar — turun 0,6 saat ditekan */}
      <mesh position={[0, pressed ? 1.25 : 1.85, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.5, 0.7, 24]} />
        <meshStandardMaterial
          {...CAP}
          emissive="#00e5ff"
          emissiveIntensity={pressed ? 0.35 : 0.05}
        />
      </mesh>
    </group>
  );
};
