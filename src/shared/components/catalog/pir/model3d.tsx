import { useRef, type ComponentType } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;
/** PCB modul PIR — hijau khas modul HC-SR501. */
const PCB = { color: '#166534', roughness: 0.5 } as const;
/** Kubah lensa Fresnel — putih susu. */
const DOME = { color: '#f3f4f6', roughness: 0.35 } as const;

/** Posisi kaki sesuai pin elektrik: VCC (-1), OUT (0), GND (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/**
 * Sensor PIR prosedural: PCB kecil, kubah lensa Fresnel putih susu
 * setengah bola, dan LED indikator merah yang menyala saat gerakan
 * terdeteksi. Klik kubah untuk menghidupkan/mematikan simulasi gerakan.
 */
export const PirRender3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const motion = instance.interactiveState.motion === true;

  // Denyut kubah saat gerakan terdeteksi: emissive berosilasi halus.
  const domeMatRef = useRef<MeshStandardMaterial>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useFrame(({ clock }) => {
    const mat = domeMatRef.current;
    if (!mat) return;
    mat.emissiveIntensity = motionRef.current
      ? 0.6 + 0.4 * Math.sin(clock.elapsedTime * 6)
      : 0;
  });

  const handleDomePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ motion: !motion });
  };

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki metalik menuju pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* PCB modul */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[3.2, 0.35, 3.6]} />
        <meshStandardMaterial {...PCB} />
      </mesh>

      {/* Kubah lensa Fresnel setengah bola — klik untuk toggle gerakan;
          berpendar merah muda berdenyut saat gerakan terdeteksi */}
      <mesh position={[0, 0.93, 0]} castShadow onPointerDown={handleDomePointerDown}>
        <sphereGeometry args={[1.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={domeMatRef} {...DOME} emissive="#ff8fab" emissiveIntensity={0} />
      </mesh>

      {/* LED indikator merah — menyala saat gerakan terdeteksi */}
      <mesh position={[1.35, 1.0, -1.35]}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={motion ? 1.6 : 0.05}
        />
      </mesh>
    </group>
  );
};
