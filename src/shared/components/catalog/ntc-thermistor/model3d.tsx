import { useEffect, useMemo, type ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import { TEMP_MAX_C, TEMP_MIN_C, tempCOf } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';
import { MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/** Jarak seret vertikal (px) untuk rentang suhu penuh −10 → 80 °C. */
const DRAG_PIXELS_FULL_RANGE = 120;

/**
 * Profil lathe kepala bead MF52A1 (riset komponen §1): tetesan epoksi
 * Ø maks 2,5 mm × panjang 4,0 mm → dalam satuan pitch (2,54 mm):
 * jari-jari maks 0,49, tinggi 1,57. Titik dari pangkal (tempat kaki
 * keluar) ke puncak tetesan.
 */
const BEAD_PROFILE: Array<[number, number]> = [
  [0.02, 0],
  [0.3, 0.07],
  [0.44, 0.28],
  [0.49, 0.6],
  [0.46, 0.9],
  [0.34, 1.2],
  [0.16, 1.44],
  [0.01, 1.57],
];

/** Pangkal kepala bead di atas permukaan board (kaki menjuntai ke lubang). */
const BEAD_Y = 1.5;

/**
 * Kurva satu kaki bead: keluar dari pangkal kepala (jarak kaki di
 * kepala 1,7 mm → z = ±0,33) lalu melebar ke pitch breadboard
 * (z = ±1) sambil turun menancap ke lubang pin elektrik.
 */
function leadCurve(side: 1 | -1): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, BEAD_Y + 0.3, side * 0.3),
    new THREE.Vector3(0, BEAD_Y - 0.35, side * 0.42),
    new THREE.Vector3(0, 0.6, side * 0.78),
    new THREE.Vector3(0, 0.1, side * 0.97),
    new THREE.Vector3(0, -0.45, side * 1),
  ]);
}

/**
 * Termistor NTC 10K prosedural (riset komponen §1): kepala tetesan
 * epoksi hitam mengilap Ø2,5 × 4,0 mm — TANPA cetakan teks (kepala
 * asli memang polos) — dan dua kaki perak tipis Ø0,3 mm yang melebar
 * dari jarak 1,7 mm di kepala ke pitch 2,54 mm di lubang pin A/B.
 * Seret kepala ke atas/bawah untuk mengubah suhu (ke atas = lebih
 * panas), pola sama seperti LM35; panel gizmo muncul saat terpilih.
 */
export const NtcThermistorRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const tempC = tempCOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);

  const beadGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        BEAD_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)),
        32,
      ),
    [],
  );
  useEffect(() => () => beadGeometry.dispose(), [beadGeometry]);

  const leads = useMemo(() => [leadCurve(-1), leadCurve(1)], []);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging3D?.(true);
    const startY = e.clientY;
    const startTemp = tempC;
    // Commit ter-throttle ±33 ms (pola gizmo bersama — lihat LM35).
    const commit = createThrottledCaller<[Record<string, unknown>]>(
      (patch) => onInteract(patch),
      INTERACT_COMMIT_INTERVAL_MS,
    );
    const onMove = (ev: PointerEvent) => {
      const delta = ((startY - ev.clientY) / DRAG_PIXELS_FULL_RANGE) * (TEMP_MAX_C - TEMP_MIN_C);
      const next = Math.min(TEMP_MAX_C, Math.max(TEMP_MIN_C, startTemp + delta));
      commit.call({ tempC: next });
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
      {/* Dua kaki perak tipis menuju pin elektrik A (−1) / B (+1) */}
      {leads.map((curve, i) => (
        <mesh key={`lead-${i}`} castShadow>
          <tubeGeometry args={[curve, 24, 0.06, 8, false]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Kepala tetesan epoksi hitam mengilap — seret untuk suhu */}
      <mesh
        geometry={beadGeometry}
        position={[0, BEAD_Y, 0]}
        castShadow
        onPointerDown={handlePointerDown}
      >
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.plastikHitam}
          roughness={0.24}
          clearcoat={0.9}
          clearcoatRoughness={0.15}
        />
      </mesh>

      {/* Panel gizmo suhu saat termistor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 4.1, 0]}
          label="Suhu"
          value={Math.round(tempC)}
          min={TEMP_MIN_C}
          max={TEMP_MAX_C}
          step={1}
          unit="°C"
          onChange={(v) => onInteract({ tempC: v })}
        />
      )}
    </group>
  );
};
