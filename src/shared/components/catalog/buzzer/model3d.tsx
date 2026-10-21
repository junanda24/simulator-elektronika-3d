import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/**
 * Buzzer aktif prosedural: silinder hitam tegak dengan lubang suara di
 * atas dan tanda + di dekat kaki PLUS. Bagian atas berpendar halus saat
 * arus 'main' mengalir di atas 5 mA (buzzer sedang berbunyi).
 */
export const BuzzerRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const current = Math.abs(instance.simState.branchCurrents['main'] ?? 0);
  const sounding = current > 0.005;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki PLUS — lebih panjang, sisi lokal -Z */}
      <mesh position={[0, 0.3, -1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.4, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Kaki MINUS — lebih pendek, sisi lokal +Z */}
      <mesh position={[0, 0, 1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.8, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>

      {/* Badan silinder hitam */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.15, 1.9, 24]} />
        <meshStandardMaterial
          color="#17181c"
          roughness={0.55}
          emissive="#f59e0b"
          emissiveIntensity={sounding ? 0.18 : 0}
        />
      </mesh>

      {/* Lubang suara di permukaan atas */}
      <mesh position={[0, 2.87, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 20]} />
        <meshStandardMaterial color="#000000" roughness={0.9} />
      </mesh>

      {/* Tanda + dari dua balok tipis di atas, dekat sisi PLUS */}
      <group position={[0.62, 2.86, -0.62]}>
        <mesh>
          <boxGeometry args={[0.5, 0.05, 0.14]} />
          <meshStandardMaterial color="#e8ecf1" roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.14, 0.05, 0.5]} />
          <meshStandardMaterial color="#e8ecf1" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};
