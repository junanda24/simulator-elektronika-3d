import type { ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;
/** Badan LDR — oranye kecoklatan khas fotoresistor CdS. */
const BODY = { color: '#b4551f', roughness: 0.5 } as const;
/** Pola gelombang (jalur CdS) di permukaan atas. */
const TRACE = { color: '#5f2d12', roughness: 0.6 } as const;

/** Jarak seret vertikal (px) untuk rentang cahaya penuh 0 → 1. */
const DRAG_PIXELS_FULL_RANGE = 120;

/** Intensitas cahaya tampilan 0..1. */
function displayLight(instance: ComponentRenderProps['instance']): number {
  const raw = Number(instance.interactiveState.light ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * LDR prosedural: cakram kecil oranye/coklat dengan pola gelombang
 * jalur CdS di atasnya dan dua kaki metalik segaris sumbu z.
 * Seret badan ke atas/bawah untuk mengubah intensitas cahaya
 * (ke atas = lebih terang). Permukaan berpendar lembut mengikuti
 * intensitas sebagai petunjuk visual.
 */
export const LdrRender3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const light = displayLight(instance);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const startY = e.clientY;
    const startLight = light;
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        1,
        Math.max(0, startLight + (startY - ev.clientY) / DRAG_PIXELS_FULL_RANGE),
      );
      onInteract({ light: next });
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
      {/* Dua kaki metalik menuju pin elektrik A / B */}
      {([-1, 1] as const).map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Cakram badan sensor */}
      <mesh position={[0, 0.85, 0]} castShadow onPointerDown={handlePointerDown}>
        <cylinderGeometry args={[0.8, 0.8, 0.35, 24]} />
        <meshStandardMaterial
          {...BODY}
          emissive="#f59e0b"
          emissiveIntensity={0.05 + light * 0.35}
        />
      </mesh>

      {/* Pola gelombang jalur CdS — tiga busur setengah torus di permukaan */}
      {[0.28, 0.48, 0.66].map((radius, i) => (
        <mesh
          key={`trace-${radius}`}
          position={[0, 1.04, 0]}
          rotation={[Math.PI / 2, 0, i % 2 === 0 ? 0 : Math.PI]}
        >
          <torusGeometry args={[radius, 0.045, 6, 20, Math.PI]} />
          <meshStandardMaterial {...TRACE} />
        </mesh>
      ))}
    </group>
  );
};
