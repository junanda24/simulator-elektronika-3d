import type { ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { TEMP_MAX_C, TEMP_MIN_C, tempCOf } from './electrical';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Posisi kaki sesuai pin elektrik: VCC (-1), OUT (0), GND (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/** Jarak seret vertikal (px) untuk rentang suhu penuh 0 → 100 °C. */
const DRAG_PIXELS_FULL_RANGE = 120;

/**
 * LM35 prosedural: kemasan TO-92 seperti transistor — badan setengah
 * silinder hitam, sisi datar ditutup pelat tipis, tiga kaki metalik.
 * Seret badan ke atas/bawah untuk mengubah suhu (ke atas = lebih panas).
 * Rona emissive badan bergeser ke merah mengikuti suhu sebagai petunjuk.
 */
export const Lm35Render3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const tempC = tempCOf(instance);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const startY = e.clientY;
    const startTemp = tempC;
    const onMove = (ev: PointerEvent) => {
      const delta = ((startY - ev.clientY) / DRAG_PIXELS_FULL_RANGE) * (TEMP_MAX_C - TEMP_MIN_C);
      const next = Math.min(TEMP_MAX_C, Math.max(TEMP_MIN_C, startTemp + delta));
      onInteract({ tempC: next });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki metalik menuju pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.05, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Badan setengah silinder TO-92 (diameter sepanjang Z) */}
      <mesh position={[0, 2.15, 0]} castShadow onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[1.05, 1.05, 2.5, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color="#1b1d22"
          roughness={0.55}
          emissive="#ef4444"
          emissiveIntensity={(tempC / TEMP_MAX_C) * 0.25}
        />
      </mesh>
      {/* Pelat penutup sisi datar (-X) */}
      <mesh position={[0, 2.15, 0]} castShadow onPointerDown={handlePointerDown}>
        <boxGeometry args={[0.06, 2.5, 2.1]} />
        <meshStandardMaterial color="#1b1d22" roughness={0.55} />
      </mesh>
    </group>
  );
};
