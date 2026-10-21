import { useEffect, useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { RotaryKnobGizmo } from '../../../../features/stage3d/gizmos/RotaryKnobGizmo';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { createTextLabelTexture } from '../../../../features/stage3d/labelTexture';

/** Jarak seret vertikal (px) untuk putaran penuh 0 → 1. */
const DRAG_PIXELS_FULL_TURN = 120;

/**
 * Geometri poros D-shaft: penampang lingkaran dengan satu sisi datar
 * (chord terpotong di +x), diekstrusi ke atas. Ciri poros WH148 asli —
 * knob berputar di poros ini. Dibangun sekali, dipakai bersama
 * (dispose={null}).
 */
function createDShaftGeometry(radius = 0.5, flat = 0.18, height = 0.5): THREE.BufferGeometry {
  const a = Math.acos(flat / radius);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, a, Math.PI * 2 - a, false);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

const D_SHAFT_GEOMETRY = createDShaftGeometry();

/** Format nilai ala cetakan potensio asli: 10000 Ω → "B10K". */
function formatPotValue(ohms: number): string {
  if (ohms >= 1000) {
    const k = ohms / 1000;
    return `B${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return `B${ohms}`;
}

/** Alpha tampilan: interactiveState.alpha dijepit ke [0, 1] untuk sudut knop. */
function displayAlpha(instance: ComponentRenderProps['instance']): number {
  const raw = Number(instance.interactiveState.alpha ?? 0.5);
  if (!Number.isFinite(raw)) return 0.5;
  return Math.min(1, Math.max(0, raw));
}

/**
 * Potensiometer WH148 prosedural (Gelombang 2 gaya 3D): kaleng logam
 * bundar dengan cetakan nilai di muka atas, ring + mur heksagonal +
 * bushing berulir, poros D-shaft, dan knob hitam bergerigi (knurling
 * faset) dengan garis penanda putih yang berputar −135° … +135°
 * mengikuti alpha (SIMULATION_RULES.md §3 butir 2). Seret knop secara
 * vertikal untuk memutar: gerak ke atas menaikkan alpha.
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

  // Cetakan nilai di tepi muka atas kaleng (konvensi cetak WH148),
  // tinta gelap di atas aluminium — kontras tinggi (§2.5).
  const valueTexture = useMemo(
    () =>
      createTextLabelTexture({
        width: 512,
        height: 176,
        lines: [{ text: formatPotValue(totalOhms), fontSize: 104 }],
        color: '#26282c',
      }),
    [totalOhms],
  );
  useEffect(() => () => valueTexture.dispose(), [valueTexture]);

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
      {/* Tiga kaki pipih (lug solder WH148) segaris sumbu z menuju pin A / WIPER / B */}
      {([-1, 0, 1] as const).map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <boxGeometry args={[0.3, 0.9, 0.1]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Kaleng logam bundar WH148 */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[2.1, 2.1, 1.1, 36]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
      </mesh>

      {/* Cetakan nilai di anulus muka atas kaleng (di depan bushing) */}
      <mesh position={[0, 1.615, 1.68]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 0.52]} />
        <meshStandardMaterial
          map={valueTexture}
          transparent
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Ring pengunci (washer) di pangkal bushing */}
      <mesh position={[0, 1.63, 0]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.06, 28]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Mur heksagonal pengunci panel */}
      <mesh position={[0, 1.79, 0]} castShadow>
        <cylinderGeometry args={[0.88, 0.88, 0.26, 6]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Bushing berulir di atas mur */}
      <mesh position={[0, 1.97, 0]} castShadow>
        <cylinderGeometry args={[0.58, 0.58, 0.34, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Poros D-shaft (satu sisi datar) mencuat ke dalam knob */}
      <mesh geometry={D_SHAFT_GEOMETRY} dispose={null} position={[0, 1.98, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Knop bergerigi berputar mengikuti alpha */}
      <group position={[0, 2.55, 0]} rotation={[0, knobAngleRad, 0]}>
        <mesh castShadow onPointerDown={handleKnobPointerDown}>
          <cylinderGeometry args={[1.5, 1.62, 0.95, 36]} />
          {/* Faset flatShading pada 36 segmen terbaca sebagai knurling grip */}
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} flatShading />
        </mesh>
        {/* Cakram atas knob sedikit lebih terang */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.28, 1.28, 0.07, 36]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.plastikHitam}
            color={COLOR_TOKENS.karetGelap}
          />
        </mesh>
        {/* Garis penanda putih posisi putaran di muka atas knop */}
        <mesh position={[0, 0.52, -0.78]}>
          <boxGeometry args={[0.24, 0.06, 1.15]} />
          <meshStandardMaterial color={COLOR_TOKENS.ledWhite} roughness={0.5} />
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
