import { useMemo, type ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { TEMP_MAX_C, TEMP_MIN_C, tempCOf } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';
import {
  getTo92FaceTexture,
  getTo92Geometries,
  LM35_TO92,
  TO92_BODY_MATERIAL,
  TO92_LEAD_MATERIAL,
} from '../../to92';

/** Jarak seret vertikal (px) untuk rentang suhu penuh 0 → 100 °C. */
const DRAG_PIXELS_FULL_RANGE = 120;

/**
 * LM35 prosedural (Gelombang 1 gaya 3D): kemasan TO-92 sejati seperti
 * transistor — badan SATU geometri extrude berprofil "D" (muka datar
 * menghadap −X dengan cetakan "LM35DZ", punggung setengah lingkaran,
 * rok tipis di pangkal), tiga kaki pipih melebar 1,27 → 2,54 mm menuju
 * pin VCC (−1), OUT (0), GND (+1). Proporsi sedikit lebih ramping dari
 * transistor mengikuti kemasan LP TI (4,30 mm).
 * Badan TIDAK PERNAH emissive/menyala — sensor asli tidak berpendar;
 * suhu dibaca dari panel gizmo & LiveBadge, bukan dari warna badan.
 * Seret badan ke atas/bawah untuk mengubah suhu (ke atas = lebih panas).
 */
export const Lm35Render3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const tempC = tempCOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);
  const geo = useMemo(() => getTo92Geometries(LM35_TO92), []);
  const faceTexture = useMemo(
    () =>
      getTo92FaceTexture('to92-lm35dz', [
        { text: 'LM35', px: 180 },
        { text: 'DZ', px: 120 },
      ]),
    [],
  );

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging3D?.(true);
    const startY = e.clientY;
    const startTemp = tempC;
    // Commit ter-throttle ±33 ms (pola bersama gizmos/throttledCommit):
    // pointermove mentah = putaran worker penuh per event — membanjiri
    // solver dan membuat panel gizmo berkedip (audit flicker 2026-10-21).
    // Nilai akhir selalu di-flush saat pointer dilepas.
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
      {/* Tiga kaki pipih menuju pin elektrik VCC-OUT-GND */}
      {geo.leads.map((lead, i) => (
        <mesh key={`lead-${i}`} geometry={lead} dispose={null} castShadow>
          <meshStandardMaterial {...TO92_LEAD_MATERIAL} />
        </mesh>
      ))}

      {/* Rok pangkal + badan TO-92 (tanpa emissive dalam keadaan apa pun) */}
      <mesh geometry={geo.flange} dispose={null} castShadow onPointerDown={handlePointerDown}>
        <meshPhysicalMaterial {...TO92_BODY_MATERIAL} />
      </mesh>
      <mesh geometry={geo.body} dispose={null} castShadow onPointerDown={handlePointerDown}>
        <meshPhysicalMaterial {...TO92_BODY_MATERIAL} />
      </mesh>

      {/* Cetakan tipe di muka datar (−X) */}
      <mesh
        position={[geo.face.x, geo.face.centerY, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        dispose={null}
        onPointerDown={handlePointerDown}
      >
        <planeGeometry args={[geo.face.width, geo.face.height]} />
        <meshStandardMaterial
          map={faceTexture}
          transparent
          roughness={0.55}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Panel gizmo suhu saat sensor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 4.0, 0]}
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
