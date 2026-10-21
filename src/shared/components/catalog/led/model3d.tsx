import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

/** Peta warna LED 5mm (STYLE_GUIDE: warna semantik komponen). */
const LED_COLORS: Record<string, string> = {
  red: '#ff2222',
  yellow: '#ffcc00',
  green: '#22ff66',
  blue: '#2266ff',
  white: '#f5f5f5',
};

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/**
 * LED 5mm prosedural: kubah silinder + bola, gelang alas, dua kaki
 * (anoda lebih panjang). Kecerahan emissive mengikuti arus cabang
 * 'led' dari simState; LED rusak tampil hitam legam tanpa cahaya.
 */
export const LedRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const colorName = typeof instance.props.color === 'string' ? instance.props.color : 'red';
  const baseColor = LED_COLORS[colorName] ?? LED_COLORS.red;
  const current = instance.simState.branchCurrents['led'] ?? 0;
  const intensity = Math.min(Math.max(current / 0.02, 0), 1.5);
  const damaged = instance.simState.isDamaged;
  const domeColor = damaged ? '#151312' : baseColor;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki anoda (+) — lebih panjang, sisi lokal -Z (posisi = pin elektrik) */}
      <mesh position={[0, 0.3, -1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.6, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Kaki katoda (-) — lebih pendek, sisi lokal +Z (posisi = pin elektrik) */}
      <mesh position={[0, 0, 1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>

      {/* Gelang alas kubah — epoxy: physical material + clearcoat */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[1.16, 1.16, 0.32, 24]} />
        <meshPhysicalMaterial
          color={domeColor}
          roughness={0.35}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          transparent
          opacity={0.9}
          emissive={damaged ? '#000000' : baseColor}
          emissiveIntensity={damaged ? 0 : intensity * 0.7}
        />
      </mesh>

      {/* Badan silinder — epoxy bening ber-clearcoat */}
      <mesh position={[0, 2.75, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 2.2, 24]} />
        <meshPhysicalMaterial
          color={domeColor}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          transparent
          opacity={0.88}
          emissive={damaged ? '#000000' : baseColor}
          emissiveIntensity={damaged ? 0 : intensity * 1.4}
        />
      </mesh>

      {/* Kubah bola — epoxy bening ber-clearcoat */}
      <mesh position={[0, 3.85, 0]} castShadow>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={domeColor}
          roughness={0.3}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          transparent
          opacity={0.88}
          emissive={damaged ? '#000000' : baseColor}
          emissiveIntensity={damaged ? 0 : intensity * 1.4}
        />
      </mesh>

      {/* Cahaya titik saat LED menyala */}
      {!damaged && intensity > 0.05 && (
        <pointLight
          position={[0, 3.2, 0]}
          color={baseColor}
          intensity={intensity * 30}
          distance={5}
          decay={2}
        />
      )}
    </group>
  );
};
