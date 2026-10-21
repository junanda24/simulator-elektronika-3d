import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Warna kabel standar SG90 sesuai urutan pin: GND, VCC, SIG. */
const WIRE_COLORS = ['#7c4a21', '#d43a2f', '#f59e0b'];

/**
 * Motor servo SG90 prosedural: badan kotak biru khas dengan kuping
 * pemasangan, hub di atas, dan tanduk (lengan) putih yang berputar pada
 * sumbu Y mengikuti branchCurrents.angle (0–180°, default 90° = netral).
 * Tiga kaki pendek berwarna mengikuti urutan kabel SG90.
 */
export const ServoRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const angle = instance.simState.branchCurrents['angle'];
  const angleDeg = typeof angle === 'number' && Number.isFinite(angle) ? angle : 90;
  const hornRotationY = ((angleDeg - 90) * Math.PI) / 180;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki/kabel pendek menuju pin elektrik (z = -1, 0, +1) */}
      {WIRE_COLORS.map((color, i) => (
        <mesh key={`leg-${i}`} position={[0, 0.1, i - 1]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}

      {/* Badan kotak biru SG90 */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[3, 2.2, 3.6]} />
        <meshStandardMaterial color="#2f6fd0" roughness={0.45} />
      </mesh>

      {/* Kuping pemasangan di sisi atas badan */}
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[4.6, 0.35, 3.6]} />
        <meshStandardMaterial color="#2f6fd0" roughness={0.45} />
      </mesh>

      {/* Leher poros */}
      <mesh position={[0, 2.95, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.9, 0.35, 20]} />
        <meshStandardMaterial color="#245aa8" roughness={0.5} />
      </mesh>

      {/* Tanduk/lengan servo — berputar mengikuti sudut simulasi */}
      <group position={[0, 3.15, 0]} rotation={[0, hornRotationY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.35, 20]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[3.6, 0.22, 0.75]} />
          <meshStandardMaterial color="#f2f3f5" roughness={0.4} />
        </mesh>
        {/* Ujung lengan berlubang khas tanduk servo */}
        <mesh position={[1.55, 0.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
          <meshStandardMaterial color="#23262d" roughness={0.6} />
        </mesh>
        <mesh position={[-1.55, 0.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
          <meshStandardMaterial color="#23262d" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};
