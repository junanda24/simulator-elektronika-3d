import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Arus kanal untuk kecerahan penuh (A) — sama seperti LED 5mm tunggal. */
const FULL_CURRENT_A = 0.02;

/** Posisi kaki sesuai pin elektrik: COM, R, G, B pada sumbu Z. */
const LEGS: Array<{ pin: string; z: number; long: boolean }> = [
  { pin: 'COM', z: -1.5, long: true },
  { pin: 'R', z: -0.5, long: false },
  { pin: 'G', z: 0.5, long: false },
  { pin: 'B', z: 1.5, long: false },
];

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * LED RGB 5mm prosedural: kubah bening seperti LED 5mm dengan empat
 * kaki (COM terpanjang). Warna emissive = campuran kanal r/g/b dari
 * simState, masing-masing dinormalisasi terhadap arus penuh 20 mA.
 * Rusak = kubah hitam legam tanpa cahaya.
 */
export const RgbLedRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const currents = instance.simState.branchCurrents;
  const r = clamp01((currents['r'] ?? 0) / FULL_CURRENT_A);
  const g = clamp01((currents['g'] ?? 0) / FULL_CURRENT_A);
  const b = clamp01((currents['b'] ?? 0) / FULL_CURRENT_A);
  const damaged = instance.simState.isDamaged;
  const mixed = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  const peak = Math.max(r, g, b);
  const domeColor = damaged ? '#151312' : '#eef2f3';
  const emissive = damaged ? '#000000' : mixed;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Empat kaki — COM paling panjang */}
      {LEGS.map(({ pin, z, long }) => (
        <mesh key={`leg-${pin}`} position={[0, long ? 0.3 : 0, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, long ? 2.6 : 2, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Gelang alas kubah — epoxy: physical material + clearcoat */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[1.16, 1.16, 0.32, 24]} />
        <meshPhysicalMaterial
          color={domeColor}
          roughness={0.35}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          transparent
          opacity={0.75}
          emissive={emissive}
          emissiveIntensity={damaged ? 0 : 0.7}
        />
      </mesh>

      {/* Badan silinder bening — epoxy ber-clearcoat */}
      <mesh position={[0, 2.75, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 2.2, 24]} />
        <meshPhysicalMaterial
          color={domeColor}
          roughness={0.25}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          transparent
          opacity={0.6}
          emissive={emissive}
          emissiveIntensity={damaged ? 0 : 1.4}
        />
      </mesh>

      {/* Kubah bola — epoxy ber-clearcoat */}
      <mesh position={[0, 3.85, 0]} castShadow>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={domeColor}
          roughness={0.25}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          transparent
          opacity={0.6}
          emissive={emissive}
          emissiveIntensity={damaged ? 0 : 1.4}
        />
      </mesh>

      {/* Cahaya titik berwarna campuran saat ada kanal menyala */}
      {!damaged && peak > 0.05 && (
        <pointLight position={[0, 3.2, 0]} color={mixed} intensity={peak * 30} distance={16} decay={2} />
      )}
    </group>
  );
};
