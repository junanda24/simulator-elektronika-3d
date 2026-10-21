import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Warna segmen saat mati (merah sangat redup). */
const SEGMENT_OFF = '#3a0d0d';
/** Warna pendaran segmen saat menyala. */
const SEGMENT_ON = '#ff1a1a';

interface SegmentLayout {
  key: string;
  position: [number, number, number];
  size: [number, number, number];
}

/** Tata letak segmen standar di atas lempeng (bidang XZ, y = permukaan). */
const SEGMENTS: SegmentLayout[] = [
  { key: 'a', position: [0, 0.88, -3.2], size: [1.9, 0.16, 0.55] },
  { key: 'g', position: [0, 0.88, 0], size: [1.9, 0.16, 0.55] },
  { key: 'd', position: [0, 0.88, 3.2], size: [1.9, 0.16, 0.55] },
  { key: 'f', position: [-1.1, 0.88, -1.6], size: [0.55, 0.16, 2.6] },
  { key: 'b', position: [1.1, 0.88, -1.6], size: [0.55, 0.16, 2.6] },
  { key: 'e', position: [-1.1, 0.88, 1.6], size: [0.55, 0.16, 2.6] },
  { key: 'c', position: [1.1, 0.88, 1.6], size: [0.55, 0.16, 2.6] },
];

/**
 * Display 7-segment prosedural: lempeng gelap berbaring menghadap ke
 * atas dengan 7 batang segmen + titik desimal. Emissive tiap segmen
 * sebanding arus cabangnya dari simState (20 mA = menyala penuh).
 */
export const SevenSegmentRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const currents = instance.simState.branchCurrents;
  const intensityOf = (key: string) =>
    Math.min(1, Math.max(0, Math.abs(currents[key] ?? 0) / 0.02));
  const anyLit = SEGMENTS.some((s) => intensityOf(s.key) > 0.05) || intensityOf('dp') > 0.05;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki pin sederhana segaris di bawah lempeng (z = -4..+4) */}
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Lempeng display merah gelap kehitaman */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[3.2, 0.8, 8.8]} />
        <meshStandardMaterial color="#1c0a0a" roughness={0.5} />
      </mesh>

      {/* Batang segmen A–G */}
      {SEGMENTS.map((seg) => (
        <mesh key={seg.key} position={seg.position}>
          <boxGeometry args={seg.size} />
          <meshStandardMaterial
            color={SEGMENT_OFF}
            roughness={0.35}
            emissive={SEGMENT_ON}
            emissiveIntensity={intensityOf(seg.key) * 2.4}
          />
        </mesh>
      ))}

      {/* Titik desimal (DP) di sudut bawah kanan tampilan */}
      <mesh position={[1.5, 0.88, 3.4]}>
        <cylinderGeometry args={[0.24, 0.24, 0.16, 16]} />
        <meshStandardMaterial
          color={SEGMENT_OFF}
          roughness={0.35}
          emissive={SEGMENT_ON}
          emissiveIntensity={intensityOf('dp') * 2.4}
        />
      </mesh>

      {anyLit && (
        <pointLight position={[0, 2.4, 0]} color="#ff2a2a" intensity={5} distance={10} decay={2} />
      )}
    </group>
  );
};
