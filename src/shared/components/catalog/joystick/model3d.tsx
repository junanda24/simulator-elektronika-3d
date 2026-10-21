import type { ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { alphaXOf, alphaYOf, pressedOf } from './electrical';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;
/** PCB modul joystick — hitam. */
const PCB = { color: '#17181c', roughness: 0.55 } as const;
const STICK = { color: '#23262d', roughness: 0.5 } as const;

/** Posisi kaki sesuai pin elektrik: VCC (-2), GND (-1), VRX (0), VRY (+1), SW (+2). */
const LEG_Z = [-2, -1, 0, 1, 2] as const;

/** Jarak seret (px) untuk rentang sumbu penuh 0 → 1. */
const DRAG_PIXELS_FULL_RANGE = 100;
/** Kemiringan tuas maksimum (rad) pada sumbu ekstrem — ±20°. */
const MAX_TILT_RAD = (20 * Math.PI) / 180;

/**
 * Joystick analog prosedural: modul PCB hitam dengan basis kotak dan
 * tuas (batang + knob) yang miring mengikuti alphaX/alphaY (±20°).
 * Seret tuas: gerak horizontal mengubah alphaX, vertikal mengubah
 * alphaY (ke atas = alphaY naik). Shift+klik menekan/mengunci tombol
 * SW (tuas turun saat tertekan).
 */
export const JoystickRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const alphaX = alphaXOf(instance);
  const alphaY = alphaYOf(instance);
  const pressed = pressedOf(instance);

  // Tuas miring: alphaX menggerakkan rotasi Z, alphaY rotasi X.
  const tiltZ = -(alphaX - 0.5) * 2 * MAX_TILT_RAD;
  const tiltX = (alphaY - 0.5) * 2 * MAX_TILT_RAD;

  const handleStickPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.shiftKey) {
      onInteract({ pressed: !pressed });
      return;
    }
    let accX = alphaX;
    let accY = alphaY;
    const onMove = (ev: PointerEvent) => {
      accX = Math.min(1, Math.max(0, accX + ev.movementX / DRAG_PIXELS_FULL_RANGE));
      accY = Math.min(1, Math.max(0, accY - ev.movementY / DRAG_PIXELS_FULL_RANGE));
      onInteract({ alphaX: accX, alphaY: accY });
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
      {/* Lima kaki metalik menuju pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* PCB modul hitam */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[3.6, 0.3, 5.6]} />
        <meshStandardMaterial {...PCB} />
      </mesh>

      {/* Basis kotak mekanisme tuas */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[2.4, 0.6, 2.4]} />
        <meshStandardMaterial {...STICK} />
      </mesh>

      {/* Tuas miring mengikuti alphaX/alphaY; turun saat tombol tertekan */}
      <group position={[0, pressed ? 1.15 : 1.35, 0]} rotation={[tiltX, 0, tiltZ]}>
        <mesh position={[0, 0.85, 0]} castShadow onPointerDown={handleStickPointerDown}>
          <cylinderGeometry args={[0.22, 0.28, 1.7, 12]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        {/* Knob tuas */}
        <mesh position={[0, 1.85, 0]} castShadow onPointerDown={handleStickPointerDown}>
          <sphereGeometry args={[0.62, 18, 12]} />
          <meshStandardMaterial
            {...STICK}
            emissive="#00e5ff"
            emissiveIntensity={pressed ? 0.4 : 0.04}
          />
        </mesh>
      </group>
    </group>
  );
};
