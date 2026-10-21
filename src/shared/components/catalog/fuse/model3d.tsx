import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/**
 * Sekering prosedural: tabung kaca transparan mendatar sepanjang sumbu
 * Z dengan dua tutup logam dan kawat tipis di dalamnya. Kawat tampil
 * menyambung dan terang saat utuh; saat instance rusak (putus), kawat
 * menjadi gelap dan menyisakan celah di tengah tabung.
 */
export const FuseRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki menuju pin elektrik (z = -1 dan +1) */}
      {[-1, 1].map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Tabung kaca transparan */}
      <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 3, 20]} />
        <meshPhysicalMaterial
          color="#dfe9ee"
          transparent
          opacity={0.35}
          roughness={0.1}
          metalness={0}
        />
      </mesh>

      {/* Tutup logam di kedua ujung tabung */}
      {[-1.7, 1.7].map((z) => (
        <mesh key={`cap-${z}`} position={[0, 1.1, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.7, 20]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Kawat sekering di dalam tabung */}
      {damaged ? (
        <>
          {/* Dua sisa kawat dengan celah putus di tengah, warna gelap */}
          {[-0.95, 0.95].map((z) => (
            <mesh key={`wire-${z}`} position={[0, 1.1, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 1.1, 8]} />
              <meshStandardMaterial color="#26221f" roughness={0.8} />
            </mesh>
          ))}
        </>
      ) : (
        <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 2.8, 8]} />
          <meshStandardMaterial color="#9aa1ab" metalness={0.9} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
};
