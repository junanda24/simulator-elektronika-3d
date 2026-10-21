import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import { DISTANCE_MAX_CM, distanceCmOf, obstacleOf } from './electrical';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`: kaki &
 * ring = kelas metalPin, PCB = kelas pcb, plastik warna = kelas
 * absWarna, chip = kelas plastikHitam, lensa LED = kelas epoxyLed.
 * Konstanta di bawah hanya WARNA benda asli.
 */
const PCB_BLUE = '#2456c8';
const TRIMMER_BLUE = '#2456c8';

/** Posisi kaki sesuai pin elektrik: VCC (-1), GND (0), OUT (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/** Pusat papan pada sumbu Z (header di tepi belakang, LED di tepi depan). */
const BOARD_CENTER_Z = 0.35;
/** Tepi depan papan (z dunia) — dari sini kedua LED 5 mm menjorok keluar. */
const FRONT_Z = BOARD_CENTER_Z + 2.3;

/**
 * Silkscreen putih PCB FC-51: judul modul, legenda pin di dekat
 * header belakang, cincin lubang kaki. Bidang plane 3,6 × 4,6 unit →
 * kanvas 1008 × 1288. Pemetaan mengikuti pola PIR (x kanvas = sumbu
 * x dunia, y kanvas = sumbu z dunia relatif ke pusat papan).
 */
function createFc51Silkscreen(): THREE.CanvasTexture {
  return createLabelTexture((ctx) => {
    const toPx = (lx: number, lz: number): [number, number] => [
      (lx / 3.6 + 0.5) * 1008,
      (lz / 4.6 + 0.5) * 1288,
    ];
    // Cincin di sekeliling lubang kaki header (z relatif ke pusat papan).
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    LEG_Z.forEach((z) => {
      const [cx, cy] = toPx(0, z - BOARD_CENTER_Z);
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    // Judul modul di tepi belakang.
    ctx.font = '700 54px "JetBrains Mono", monospace';
    const [tx, ty] = toPx(0, -2.02);
    ctx.fillText('FC-51', tx, ty);
    // Legenda pin mengikuti urutan fisik header VCC-GND-OUT.
    ctx.font = '600 30px "JetBrains Mono", monospace';
    const [lx, ly] = toPx(0, 1.62);
    ctx.fillText('VCC GND OUT', lx, ly);
  }, { width: 1008, height: 1288 });
}

/** Cetakan atas chip LM393: nama tipe + titik penanda pin 1 (pola FC-28). */
function createChipPrint(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      ctx.fillStyle = '#d4d4d8';
      ctx.font = 'bold 62px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LM393', width / 2, height / 2 + 22);
      ctx.beginPath();
      ctx.arc(34, 34, 13, 0, Math.PI * 2);
      ctx.fill();
    },
    { width: 256, height: 174 },
  );
}

/** Trimpot biru khas modul LM393: ring metal, badan biru, slot putar. */
const TrimmerPot = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh position={[0, 0.03, 0]}>
      <cylinderGeometry args={[0.33, 0.33, 0.06, 24]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
    </mesh>
    <mesh position={[0, 0.16, 0]} castShadow>
      <cylinderGeometry args={[0.28, 0.28, 0.2, 24]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={TRIMMER_BLUE} />
    </mesh>
    <mesh position={[0, 0.27, 0]} rotation={[0, 0.6, 0]}>
      <boxGeometry args={[0.32, 0.03, 0.07]} />
      <meshStandardMaterial color="#17275e" roughness={0.6} />
    </mesh>
  </group>
);

/** LED indikator kecil di permukaan papan (pola LED PIR). */
const BoardLed = ({
  position,
  color,
  intensity,
}: {
  position: [number, number, number];
  color: string;
  intensity: number;
}) => (
  <group position={position}>
    <mesh position={[0, 0.05, 0]}>
      <cylinderGeometry args={[0.17, 0.18, 0.1, 16]} />
      <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.16, 0]}>
      <sphereGeometry args={[0.15, 16, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        roughness={0.3}
      />
    </mesh>
  </group>
);

/**
 * Sensor halangan FC-51 prosedural (riset komponen §5): PCB biru
 * 31,3 × 14,2 mm (diskalakan ke pola modul proyek) dengan DUA LED
 * 5 mm berdampingan menjorok keluar dari tepi depan — pemancar IR
 * bening di kiri, penerima hitam di kanan — LM393, trimpot biru, LED
 * daya merah dan LED deteksi hijau, header 3-pin di tepi belakang.
 * LED deteksi menyala saat halangan terdeteksi (OUT LOW). Jarak
 * halangan diatur dari panel gizmo saat modul terpilih.
 */
export const Fc51Render3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const obstacle = obstacleOf(instance);
  const distanceCm = distanceCmOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const silkscreen = useMemo(createFc51Silkscreen, []);
  const chipPrint = useMemo(createChipPrint, []);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki header menuju pin elektrik VCC-GND-OUT */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* PCB modul biru membulat, header di belakang, LED di depan */}
      <RoundedBox
        args={[3.6, 0.28, 4.6]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.78, BOARD_CENTER_Z]}
        castShadow
      >
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={PCB_BLUE} />
      </RoundedBox>
      {/* Silkscreen di muka atas PCB */}
      <mesh position={[0, 0.925, BOARD_CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 4.6]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} />
      </mesh>

      {/* Lubang pemasangan di sudut belakang papan */}
      <mesh position={[1.45, 0.79, -1.65]}>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 20]} />
        <meshStandardMaterial color="#101c3f" roughness={0.9} />
      </mesh>

      {/* Dua LED 5 mm menjorok dari tepi depan: pemancar bening (kiri)
          dan penerima hitam (kanan), sumbu menunjuk +Z. */}
      {[-0.92, 0.92].map((x, i) => (
        <group key={`irled-${i}`} position={[x, 0.82, FRONT_Z]}>
          {/* Flange pangkal LED */}
          <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.95, 0.95, 0.22, 28]} />
            {i === 0 ? (
              <meshPhysicalMaterial {...MATERIAL_PROPS.epoxyLed} opacity={0.55} />
            ) : (
              <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} roughness={0.35} />
            )}
          </mesh>
          {/* Badan silinder LED */}
          <mesh position={[0, 0, 0.75]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.82, 0.82, 1.3, 28]} />
            {i === 0 ? (
              <meshPhysicalMaterial {...MATERIAL_PROPS.epoxyLed} opacity={0.55} />
            ) : (
              <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} roughness={0.35} />
            )}
          </mesh>
          {/* Kubah ujung LED */}
          <mesh position={[0, 0, 1.4]} scale={[1, 1, 0.62]} castShadow>
            <sphereGeometry args={[0.82, 28, 20]} />
            {i === 0 ? (
              <meshPhysicalMaterial {...MATERIAL_PROPS.epoxyLed} opacity={0.55} />
            ) : (
              <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} roughness={0.35} />
            )}
          </mesh>
        </group>
      ))}

      {/* IC komparator LM393 dengan cetakan tipe */}
      <group position={[-0.85, 0.92, -0.55]}>
        <RoundedBox args={[0.95, 0.18, 0.55]} radius={0.05} smoothness={4} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </RoundedBox>
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 0.5]} />
          <meshStandardMaterial map={chipPrint} transparent roughness={0.55} />
        </mesh>
      </group>

      {/* Trimpot penyesuai jarak (visual — ambang model tetap) */}
      <TrimmerPot position={[0.95, 0.92, -0.55]} />

      {/* LED daya merah & LED deteksi hijau di dekat tepi depan */}
      <BoardLed position={[-1.3, 0.92, 1.85]} color="#ef4444" intensity={0.8} />
      <BoardLed position={[1.3, 0.92, 1.85]} color="#22c55e" intensity={obstacle ? 2.8 : 0.05} />

      {/* Panel gizmo jarak halangan saat modul terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 3.7, BOARD_CENTER_Z]}
          label="Jarak halangan"
          value={Math.round(distanceCm)}
          min={0}
          max={DISTANCE_MAX_CM}
          step={1}
          unit=" cm"
          onChange={(v) => onInteract({ distanceCm: v })}
        />
      )}
    </group>
  );
};
