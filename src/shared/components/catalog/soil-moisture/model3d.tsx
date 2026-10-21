import type { ComponentType } from 'react';
import { Color } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { moistureOf } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;
/** Papan modul sensor tanah — biru khas. */
const PCB = { color: '#1d4ed8', roughness: 0.5 } as const;

/** Warna tanah di antara garpu: cokelat kering → biru basah. */
const SOIL_DRY = new Color('#92400E');
const SOIL_WET = new Color('#2563EB');

function soilColor(moisture: number): Color {
  return new Color().lerpColors(SOIL_DRY, SOIL_WET, moisture);
}

/** Posisi kaki header sesuai pin elektrik: VCC (-1), AO (0), GND (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/** Jarak seret vertikal (px) untuk rentang kelembaban penuh 0 → 1. */
const DRAG_PIXELS_FULL_RANGE = 120;

/**
 * Sensor kelembaban tanah prosedural: papan modul biru kecil di atas
 * dengan tiga kaki header, dan dua garpu probe logam sejajar memanjang
 * ke bawah (bagian yang ditancapkan ke tanah). LED daya kecil di papan.
 * Seret papan ke atas/bawah untuk mengubah kelembaban (ke atas = kering,
 * ke bawah = basah — mengikuti arah tancap).
 */
export const SoilMoistureRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const moisture = moistureOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging3D?.(true);
    const startY = e.clientY;
    const startMoisture = moisture;
    // Commit ter-throttle ±33 ms (pola bersama gizmos/throttledCommit) —
    // pointermove mentah membanjiri solver & membuat gizmo berkedip
    // (audit flicker 2026-10-21); nilai akhir di-flush saat lepas.
    const commit = createThrottledCaller<[Record<string, unknown>]>(
      (patch) => onInteract(patch),
      INTERACT_COMMIT_INTERVAL_MS,
    );
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        1,
        Math.max(0, startMoisture + (ev.clientY - startY) / DRAG_PIXELS_FULL_RANGE),
      );
      commit.call({ moisture: next });
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
      {/* Tiga kaki header menuju pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.35, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.4, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Papan modul biru */}
      <mesh position={[0, 0.85, 0]} castShadow onPointerDown={handlePointerDown}>
        <boxGeometry args={[2.6, 0.3, 3.2]} />
        <meshStandardMaterial {...PCB} />
      </mesh>

      {/* LED daya kecil di papan */}
      <mesh position={[0.9, 1.05, -1.2]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
      </mesh>

      {/* Dua garpu probe logam memanjang ke bawah */}
      {([-0.6, 0.6] as const).map((x) => (
        <mesh key={`probe-${x}`} position={[x, -1.1, 0]} castShadow>
          <boxGeometry args={[0.28, 2.6, 1.6]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Lapisan tanah di antara dua garpu — warnanya mengikuti kelembaban */}
      <mesh position={[0, -1.15, 0]}>
        <boxGeometry args={[0.9, 2.5, 1.5]} />
        <meshStandardMaterial color={soilColor(moisture)} roughness={1} />
      </mesh>

      {/* Panel gizmo kelembapan saat sensor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 3.2, 0]}
          label="Kelembapan"
          value={Math.round(moisture * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => onInteract({ moisture: v / 100 })}
        />
      )}
    </group>
  );
};
