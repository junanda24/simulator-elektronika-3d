import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { wetnessOf, RAIN_DO_THRESHOLD } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';

/** Posisi kaki header sesuai pin elektrik: VCC (-1,5), GND (-0,5), DO (+0,5), AO (+1,5). */
const LEG_Z = [-1.5, -0.5, 0.5, 1.5] as const;

/** Silkscreen putih modul kontrol MH-RD: nama modul, label pin, label LED. */
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
    ctx.fillText('MH-RD', 36, 800);
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('PWR', u(0.55), v(1.62));
    ctx.fillText('DO', u(0.55), v(-1.5));
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
 * Tekstur muka papan deteksi: dua sisir jejak berlapis nikel yang
 * saling mengunci (interdigitasi) — fitur visual penentu MH-RD asli
 * (riset komponen 2026-10-21 §8). Sisir A tersambung ke bus atas,
 * sisir B ke bus bawah; air yang menjembatani celahnya menurunkan
 * resistansi papan.
 */
function createPlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 576;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1f5fa8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#cfd6de';
    const margin = 46;
    const busH = 26;
    const fingerW = 17;
    const gap = 24;
    // Bus atas (sisir A) dan bus bawah (sisir B).
    ctx.fillRect(margin, margin, canvas.width - margin * 2, busH);
    ctx.fillRect(margin, canvas.height - margin - busH, canvas.width - margin * 2, busH);
    // Jari-jari bergantian dari kedua bus, saling mengunci di tengah.
    const fingerTop = margin + busH;
    const fingerBottom = canvas.height - margin - busH;
    const fingerLen = (fingerBottom - fingerTop) * 0.78;
    let i = 0;
    for (let x = margin + 8; x + fingerW < canvas.width - margin; x += fingerW + gap) {
      if (i % 2 === 0) {
        ctx.fillRect(x, fingerTop, fingerW, fingerLen);
      } else {
        ctx.fillRect(x, fingerBottom - fingerLen, fingerW, fingerLen);
      }
      i += 1;
    }
    // Lubang baut sudut (visual).
    ctx.fillStyle = '#12365c';
    for (const [hx, hy] of [
      [26, 26],
      [canvas.width - 26, 26],
      [26, canvas.height - 26],
      [canvas.width - 26, canvas.height - 26],
    ] as const) {
      ctx.beginPath();
      ctx.arc(hx, hy, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Geometri kabel lengkung modul ↔ papan deteksi (pola tabung kurva katalog). */
function createWireGeometry(z: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.3, 1.0, z),
    new THREE.Vector3(1.95, -0.6, z),
    new THREE.Vector3(2.2, -2.2, z),
    new THREE.Vector3(2.35, -2.86, z),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.055, 8);
}

/**
 * Sensor hujan MH-RD setia benda aslinya (riset komponen 2026-10-21
 * §8): modul kontrol 30 × 16 mm (LM393 + trimpot + LED) menancap
 * 4 pin di breadboard, dan papan deteksi 54 × 40 mm berjejak sisir
 * digambar RATA di alas di samping board — di dunia nyata papan itu
 * memang tidak bisa menancap di breadboard (preseden soil-moisture:
 * probe digambar terpisah dari modulnya), tersambung dua kabel pendek.
 */
export const RainSensorRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const wetness = wetnessOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const silkscreen = useMemo(createModuleSilkscreen, []);
  const chipPrint = useMemo(createChipPrint, []);
  const plateTexture = useMemo(createPlateTexture, []);
  const wireGeoA = useMemo(() => createWireGeometry(-0.5), []);
  const wireGeoB = useMemo(() => createWireGeometry(0.5), []);

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

      {/* Modul kontrol biru */}
      <RoundedBox args={[2.8, 0.28, 4.6]} radius={0.09} smoothness={4} position={[0, 1.09, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color="#2470e0" />
      </RoundedBox>
      <mesh position={[0, 1.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 4.6]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {/* Chip LM393 bercetak */}
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

      {/* LED PWR merah statis & LED DO amber (menyala saat basah
          melewati ambang — pola LED OUT soil-moisture) */}
      <mesh position={[1.08, 1.36, 1.55]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[1.08, 1.36, -1.42]} castShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={wetness > RAIN_DO_THRESHOLD ? 2.8 : 0.12}
        />
      </mesh>

      {/* Dua kabel pendek modul ↔ papan deteksi (merah & hitam) */}
      <mesh geometry={wireGeoA} castShadow>
        <meshStandardMaterial color={COLOR_TOKENS.cableRed} roughness={0.8} />
      </mesh>
      <mesh geometry={wireGeoB} castShadow>
        <meshStandardMaterial color={COLOR_TOKENS.karetGelap} roughness={0.8} />
      </mesh>

      {/* Papan deteksi 54 × 40 mm: pelat FR-04 rata di alas di samping
          board, muka berjejak sisir interdigitasi berlapis nikel */}
      <group position={[5.1, -2.92, 0]}>
        <RoundedBox args={[5.6, 0.1, 4.2]} radius={0.04} smoothness={4} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color="#1f5fa8" />
        </RoundedBox>
        <mesh position={[0, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.6, 4.2]} />
          <meshStandardMaterial map={plateTexture} transparent roughness={0.45} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      </group>

      {/* Panel gizmo kebasahan saat sensor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 3.4, 0]}
          label="Kebasahan"
          value={Math.round(wetness * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => onInteract({ wetness: v / 100 })}
        />
      )}
    </group>
  );
};
