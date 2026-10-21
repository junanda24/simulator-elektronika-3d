import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { ppmOf, MQ2_DO_THRESHOLD_PPM } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';

/** Posisi kaki header sesuai pin elektrik: VCC (-1,5), GND (-0,5), DO (+0,5), AO (+1,5). */
const LEG_Z = [-1.5, -0.5, 0.5, 1.5] as const;

/** Silkscreen putih modul MQ-2: nama modul, label pin, label LED. */
function createModuleSilkscreen(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 736;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(248,250,252,0.85)';
    ctx.lineWidth = 3;
    const u = (x: number) => ((x / 3.2 + 0.5) * canvas.width) | 0;
    const v = (z: number) => ((0.5 + z / 4.6) * canvas.height) | 0;
    ctx.strokeRect(u(0.35), v(0.85), u(1.5) - u(0.35), v(2.05) - v(0.85));
    ctx.beginPath();
    ctx.arc(u(-1.0), v(1.5), 72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MQ-2', 30, 706);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('PWR', u(0.72), v(0.42));
    ctx.fillText('DO', u(0.78), v(-0.08));
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    const pinLabels: Array<[string, number]> = [
      ['VCC', -1.5],
      ['GND', -0.5],
      ['DO', 0.5],
      ['AO', 1.5],
    ];
    for (const [text, z] of pinLabels) {
      ctx.save();
      ctx.translate(u(1.42), v(z));
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

/** Cetakan atas chip LM393 (pola modul komparator katalog). */
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
 * Tekstur jaring kawat tabung elemen: grid titik gelap rapat di atas
 * perak — menyarankan anyaman mesh stainless tanpa geometri berat.
 */
function createMeshTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#c8ced6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(70,76,86,0.85)';
    const step = 14;
    for (let y = step / 2; y < canvas.height; y += step) {
      for (let x = step / 2; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.arc(x + ((y / step) % 2 === 0 ? 0 : step / 2), y, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1.5);
  return texture;
}

/**
 * Sensor gas MQ-2 setia modul aslinya (riset komponen 2026-10-21 §3):
 * PCB biru 32 × 20 mm tinggi total ±22 mm — tabung jaring stainless
 * di atas basis elemen hitam, LM393, trimpot biru, LED PWR + LED DO,
 * header 4 pin. CATATAN PENDEKATAN: diameter tabung elemen TIDAK
 * terverifikasi dari sumber tertulis pada riset (tertulis eksplisit di
 * laporan) — proporsi tabung di sini mengikuti foto referensi riset
 * (tabung ≈ setengah lebar papan), BUKAN angka datasheet.
 */
export const Mq2Render3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const ppm = ppmOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const silkscreen = useMemo(createModuleSilkscreen, []);
  const chipPrint = useMemo(createChipPrint, []);
  const meshTexture = useMemo(createMeshTexture, []);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Empat pin header emas menuju titik pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.48, z]} castShadow>
          <boxGeometry args={[0.18, 0.95, 0.18]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldPlated} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.5, 0.2, 3.9]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>

      {/* Papan modul biru 32 × 20 mm */}
      <RoundedBox args={[3.2, 0.28, 4.6]} radius={0.09} smoothness={4} position={[0, 1.09, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color="#2470e0" />
      </RoundedBox>
      <mesh position={[0, 1.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 4.6]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Elemen sensor: basis silinder hitam + tabung jaring stainless */}
      <group position={[-0.35, 0, -0.9]}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[1.12, 1.18, 0.55, 28]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </mesh>
        <mesh position={[0, 2.62, 0]} castShadow>
          <cylinderGeometry args={[0.96, 0.96, 1.7, 28, 1, true]} />
          <meshStandardMaterial map={meshTexture} roughness={0.5} metalness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 3.48, 0]} castShadow>
          <cylinderGeometry args={[0.96, 0.96, 0.06, 28]} />
          <meshStandardMaterial map={meshTexture} roughness={0.5} metalness={0.6} />
        </mesh>
        {/* Dua cincin penguat tabung (ciri fisik tabung MQ) */}
        {([1.95, 3.3] as const).map((y) => (
          <mesh key={`ring-${y}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.97, 0.045, 8, 32]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        ))}
      </group>

      {/* Chip LM393 bercetak (diputar 90° agar muat di sisa papan) */}
      <group position={[1.02, 0, 1.5]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[1.25, 0.32, 0.85]} radius={0.06} smoothness={4} position={[0, 1.39, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </RoundedBox>
        <mesh position={[0, 1.555, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.25, 0.85]} />
          <meshStandardMaterial map={chipPrint} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      </group>

      {/* Trimpot biru bersekrup kuningan */}
      <group position={[-1.0, 0, 1.5]}>
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

      {/* LED PWR merah statis & LED DO (menyala saat gas melewati ambang) */}
      <mesh position={[1.32, 1.36, 0.35]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[1.32, 1.36, -0.15]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={ppm > MQ2_DO_THRESHOLD_PPM ? 2.8 : 0.12}
        />
      </mesh>

      {/* Panel gizmo konsentrasi gas saat sensor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 4.6, 0]}
          label="Gas"
          value={Math.round(ppm)}
          min={0}
          max={10000}
          step={25}
          unit="ppm"
          onChange={(v) => onInteract({ ppm: v })}
        />
      )}
    </group>
  );
};
