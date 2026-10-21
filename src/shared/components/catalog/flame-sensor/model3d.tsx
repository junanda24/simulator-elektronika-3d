import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { flameOf, FLAME_DO_THRESHOLD } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';

/**
 * Warna PCB merah seri Keyes (KY-026 asli umumnya PCB merah; preseden
 * literal warna papan modul: biru FC-28 '#2470e0' di soil-moisture).
 */
const MODULE_RED = '#bf2b30';

/** Posisi kaki header sesuai pin elektrik: G (-1,5), + (-0,5), D0 (+0,5), A0 (+1,5). */
const LEG_Z = [-1.5, -0.5, 0.5, 1.5] as const;

/** Silkscreen putih modul KY-026: nama modul, label pin G/+/D0/A0, label LED. */
function createModuleSilkscreen(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 832;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(248,250,252,0.85)';
    ctx.lineWidth = 3;
    const u = (x: number) => ((x / 2.8 + 0.5) * canvas.width) | 0;
    const v = (z: number) => ((0.5 + z / 4.6) * canvas.height) | 0;
    ctx.strokeRect(u(-0.2), v(-0.85), u(1.3) - u(-0.2), v(0.35) - v(-0.85));
    ctx.beginPath();
    ctx.arc(u(-0.65), v(1.05), 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('KY-026', 36, 800);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('PWR', u(0.55), v(1.62));
    ctx.fillText('D0', u(0.55), v(-1.5));
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    const pinLabels: Array<[string, number]> = [
      ['G', -1.5],
      ['+', -0.5],
      ['D0', 0.5],
      ['A0', 1.5],
    ];
    for (const [text, z] of pinLabels) {
      ctx.save();
      ctx.translate(u(1.24), v(z));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(text, 0, 12);
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Cetakan atas chip LM393 (sama seperti modul komparator lain di katalog). */
function createChipPrint(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 174;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d4d4d8';
    ctx.font = 'bold 62px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LM393', 128, 108);
    ctx.beginPath();
    ctx.arc(34, 34, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Sensor api KY-026 setia modul asli (riset komponen 2026-10-21 §4):
 * board 36 × 15 mm PCB merah — fototransistor inframerah hitam
 * (badan LED 5 mm epoksi hitam) di ujung depan, chip LM393 bercetak,
 * trimpot biru bersekrup kuningan, LED PWR merah + LED D0 yang menyala
 * saat api melewati ambang, 4 pin header emas tepat di titik pin
 * elektrik G/+/D0/A0. Skala mengikuti footprint terkunci proyek.
 */
export const FlameSensorRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const flame = flameOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const silkscreen = useMemo(createModuleSilkscreen, []);
  const chipPrint = useMemo(createChipPrint, []);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Empat pin header emas menuju titik pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.48, z]} castShadow>
          <boxGeometry args={[0.18, 0.95, 0.18]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldPlated} roughness={0.35} />
        </mesh>
      ))}
      {/* Rumah plastik hitam header tepat di bawah papan */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.5, 0.2, 3.9]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>

      {/* Papan modul merah */}
      <RoundedBox args={[2.8, 0.28, 4.6]} radius={0.09} smoothness={4} position={[0, 1.09, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={MODULE_RED} />
      </RoundedBox>
      <mesh position={[0, 1.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 4.6]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Fototransistor inframerah: badan LED 5 mm epoksi HITAM di ujung
          depan papan (z = −1,8) di atas dua kaki pendek */}
      <group position={[0, 0, -1.8]}>
        {([-0.22, 0.22] as const).map((dx) => (
          <mesh key={`pt-leg-${dx}`} position={[dx, 1.35, 0]} castShadow>
            <boxGeometry args={[0.14, 0.3, 0.14]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        ))}
        <mesh position={[0, 1.72, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.37, 0.5, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </mesh>
        <mesh position={[0, 1.97, 0]} castShadow>
          <sphereGeometry args={[0.34, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </mesh>
      </group>

      {/* Chip LM393 (SOIC-8) bercetak + titik pin 1 */}
      <group position={[0.55, 0, -0.25]}>
        <RoundedBox args={[1.25, 0.32, 0.85]} radius={0.06} smoothness={4} position={[0, 1.39, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </RoundedBox>
        {([-0.45, -0.15, 0.15, 0.45] as const).map((dx) =>
          ([-1, 1] as const).map((side) => (
            <mesh key={`chipleg-${dx}-${side}`} position={[dx, 1.27, side * 0.52]} castShadow>
              <boxGeometry args={[0.18, 0.07, 0.3]} />
              <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldPlated} roughness={0.35} />
            </mesh>
          )),
        )}
        <mesh position={[0, 1.555, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.25, 0.85]} />
          <meshStandardMaterial map={chipPrint} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      </group>

      {/* Trimpot biru bersekrup kuningan */}
      <group position={[-0.65, 0, 1.05]}>
        <RoundedBox args={[0.95, 0.5, 0.95]} radius={0.06} smoothness={4} position={[0, 1.48, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color="#2470e0" />
        </RoundedBox>
        <mesh position={[0, 1.75, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.09, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.brassScrew} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.42, 0.03, 0.1]} />
          <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} roughness={0.6} />
        </mesh>
      </group>

      {/* Komponen pasif kecil pengisi papan */}
      {([
        { x: -1.05, z: -0.7 },
        { x: 0.15, z: 1.7 },
      ] as const).map(({ x, z }) => (
        <mesh key={`passive-${x}-${z}`} position={[x, 1.3, z]} castShadow>
          <boxGeometry args={[0.42, 0.14, 0.24]} />
          <meshStandardMaterial color={COLOR_TOKENS.keramikKrem} roughness={0.55} />
        </mesh>
      ))}

      {/* LED PWR merah (menyala statis, pola modul lain) & LED D0
          (menyala saat api melewati ambang komparator) */}
      <mesh position={[1.08, 1.36, 1.55]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[1.08, 1.36, -1.42]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={flame > FLAME_DO_THRESHOLD ? 2.8 : 0.12}
        />
      </mesh>

      {/* Panel gizmo intensitas api saat sensor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 3.4, 0]}
          label="Api"
          value={Math.round(flame * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => onInteract({ flame: v / 100 })}
        />
      )}
    </group>
  );
};
