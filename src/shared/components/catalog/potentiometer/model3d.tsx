import type { ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { RotaryKnobGizmo } from '../../../../features/stage3d/gizmos/RotaryKnobGizmo';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;
const BODY = { color: '#1d4ed8', roughness: 0.45 } as const;
const KNOB = { color: '#23262d', roughness: 0.55 } as const;

/** Jarak seret vertikal (px) untuk putaran penuh 0 → 1. */
const DRAG_PIXELS_FULL_TURN = 120;

/** Alpha tampilan: interactiveState.alpha dijepit ke [0, 1] untuk sudut knop. */
function displayAlpha(instance: ComponentRenderProps['instance']): number {
  const raw = Number(instance.interactiveState.alpha ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Potensiometer prosedural: badan silinder tegak biru, poros metalik, dan
 * knop dengan garis penanda yang berputar −135° … +135° mengikuti alpha
 * (SIMULATION_RULES.md §3 butir 2). Seret knop secara vertikal untuk
 * memutar: gerak ke atas menaikkan alpha.
 */
export const PotentiometerRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const alpha = displayAlpha(instance);
  const knobAngleRad = ((-135 + alpha * 270) * Math.PI) / 180;
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);
  const totalOhmsRaw = Number(instance.props.value ?? 10000);
  const totalOhms = Number.isFinite(totalOhmsRaw) ? totalOhmsRaw : 10000;

  const handleKnobPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging3D?.(true);
    const startY = e.clientY;
    const startAlpha = alpha;
    // Commit ter-throttle ±33 ms (pola bersama gizmos/throttledCommit) —
    // pointermove mentah membanjiri solver & membuat panel baca berkedip
    // (audit flicker 2026-10-21); nilai akhir di-flush saat lepas.
    const commit = createThrottledCaller<[Record<string, unknown>]>(
      (patch) => onInteract(patch),
      INTERACT_COMMIT_INTERVAL_MS,
    );
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        1,
        Math.max(0, startAlpha + (startY - ev.clientY) / DRAG_PIXELS_FULL_TURN),
      );
      commit.call({ alpha: next });
    };
    const onUp = () => {
      commit.flush();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging3D?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki segaris sumbu z menuju pin elektrik A / WIPER / B */}
      {([-1, 0, 1] as const).map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Badan silinder tegak */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[2.1, 2.1, 1.4, 28]} />
        <meshStandardMaterial {...BODY} />
      </mesh>

      {/* Ring poros metalik */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 0.25, 16]} />
        <meshStandardMaterial {...METAL} />
      </mesh>

      {/* Knop berputar mengikuti alpha */}
      <group position={[0, 2.5, 0]} rotation={[0, knobAngleRad, 0]}>
        <mesh castShadow onPointerDown={handleKnobPointerDown}>
          <cylinderGeometry args={[1.55, 1.65, 0.9, 28]} />
          <meshStandardMaterial {...KNOB} />
        </mesh>
        {/* Garis penanda posisi putaran di tepi atas knop */}
        <mesh position={[0, 0.48, -1.05]}>
          <boxGeometry args={[0.32, 0.1, 0.75]} />
          <meshStandardMaterial color="#00e5ff" roughness={0.4} />
        </mesh>
      </group>

      {/* Panel baca % putaran + resistansi saat komponen terpilih */}
      {selected && (
        <RotaryKnobGizmo
          position={[0, 4.6, 0]}
          percent={alpha * 100}
          ohms={alpha * totalOhms}
        />
      )}

      {/* Badge ADC live dari tegangan wiper (rumus analogRead runtime) */}
      <LiveBadge instance={instance} y={3.8} />
    </group>
  );
};
