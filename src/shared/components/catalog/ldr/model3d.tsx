import { useEffect, useMemo } from 'react';
import type { ComponentType } from 'react';
import * as THREE from 'three';
import { DoubleSide } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';
import { MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';

/** Warna tinta jalur CdS untuk tekstur muka (cokelat kemerahan khas CdS). */
const TRACE_INK = '#5f2d12';

/**
 * Cakram resin GL5528 sebagai lathe bertepi membulat penuh (Ø≈5 mm,
 * tipis) — bukan silinder bertepi tajam. Dipakai ulang antar instance.
 */
function createDiscGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, -0.13),
    new THREE.Vector2(0.7, -0.13),
    new THREE.Vector2(0.9, -0.06),
    new THREE.Vector2(0.95, 0),
    new THREE.Vector2(0.9, 0.06),
    new THREE.Vector2(0.72, 0.13),
    new THREE.Vector2(0, 0.13),
  ];
  return new THREE.LatheGeometry(points, 28);
}

const DISC_GEOMETRY = createDiscGeometry();

/**
 * Tekstur muka LDR: pola SERPENTINE (meander) CdS PENUH digambar
 * prosedural via helper label resmi (§2.5) — jalur berliku bolak-balik
 * menutupi wajah cakram seperti foto GL5528 asli, menggantikan tiga
 * busur torus lama. Latar transparan agar resin di bawahnya terlihat.
 */
function createFaceTexture(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      ctx.strokeStyle = TRACE_INK;
      ctx.lineWidth = 30;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const rows = [-132, -66, 0, 66, 132];
      const extent = 168;
      ctx.beginPath();
      rows.forEach((dy, i) => {
        const fromX = cx + (i % 2 === 0 ? -extent : extent);
        const toX = cx + (i % 2 === 0 ? extent : -extent);
        if (i === 0) ctx.moveTo(fromX, cy + dy);
        else ctx.lineTo(fromX, cy + dy);
        ctx.lineTo(toX, cy + dy);
      });
      ctx.stroke();
    },
    { width: 512, height: 512 },
  );
}

/** Jarak seret vertikal (px) untuk rentang cahaya penuh 0 → 1. */
const DRAG_PIXELS_FULL_RANGE = 120;

/** Intensitas cahaya tampilan 0..1. */
function displayLight(instance: ComponentRenderProps['instance']): number {
  const raw = Number(instance.interactiveState.light ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * LDR GL5528 prosedural setia asli (SPESIFIKASI-GAYA-3D §5 Gelombang 2):
 * cakram resin semi-transparan kekuningan-oranye (kelas epoxyLed)
 * bertepi membulat, muka berpola serpentine CdS penuh sebagai tekstur,
 * dan dua kaki yang masuk terlihat menembus resin. Perilaku TIDAK
 * berubah: seret badan atas/bawah mengubah cahaya (commit ter-throttle),
 * permukaan berpendar lembut mengikuti intensitas, gizmo + badge sama.
 */
export const LdrRender3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const light = displayLight(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);
  const faceTexture = useMemo(createFaceTexture, []);
  useEffect(() => () => faceTexture.dispose(), [faceTexture]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging3D?.(true);
    const startY = e.clientY;
    const startLight = light;
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
        Math.max(0, startLight + (startY - ev.clientY) / DRAG_PIXELS_FULL_RANGE),
      );
      commit.call({ light: next });
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
      {/* Dua kaki metalik menuju pin elektrik A / B — naik masuk ke resin */}
      {([-1, 1] as const).map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.25, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.5, 12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Cakram resin sensor — lathe bertepi membulat, semi-transparan */}
      <mesh
        geometry={DISC_GEOMETRY}
        position={[0, 0.85, 0]}
        castShadow
        onPointerDown={handlePointerDown}
      >
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.epoxyLed}
          color="#c05f24"
          opacity={0.78}
          emissive="#f59e0b"
          emissiveIntensity={0.05 + light * 0.35}
        />
      </mesh>

      {/* Pola serpentine CdS penuh di muka cakram (tekstur prosedural) */}
      <mesh position={[0, 0.995, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.78, 28]} />
        <meshStandardMaterial
          map={faceTexture}
          transparent
          roughness={0.6}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Kerucut cahaya virtual + panel gizmo saat sensor terpilih */}
      {selected && (
        <>
          <mesh position={[0, 1.6, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.95, 1.15, 24, 1, true]} />
            <meshBasicMaterial
              color="#FEF08A"
              transparent
              opacity={0.05 + light * 0.3}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          <SensorGizmo3D
            position={[0, 3.6, 0]}
            label="Cahaya"
            value={Math.round(light * 1000)}
            min={0}
            max={1000}
            step={10}
            unit=" lux"
            onChange={(v) => onInteract({ light: v / 1000 })}
          />
        </>
      )}

      {/* Badge tegangan kaki B + ADC live (titik tengah pembagi, dibaca A0) */}
      <LiveBadge instance={instance} y={2.5} />
    </group>
  );
};
