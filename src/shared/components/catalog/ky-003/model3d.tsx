import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';
import { magnetNearOf } from './electrical';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`: kaki =
 * kelas metalPin, PCB = kelas pcb, IC & badan = kelas plastikHitam.
 * Konstanta di bawah hanya WARNA benda asli (merah seri Keyes).
 */
const PCB_RED = '#d42a1e';

/** Posisi kaki header: GND (−1), VCC (0), S (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/**
 * Silkscreen putih PCB KY-003: judul modul dan legenda pin
 * "- + S" mengikuti urutan fisik header. Bidang plane 2,6 × 3,2
 * unit → kanvas 728 × 896 (pola PIR).
 */
function createKy003Silkscreen(): THREE.CanvasTexture {
  return createLabelTexture((ctx) => {
    const toPx = (lx: number, lz: number): [number, number] => [
      (lx / 2.6 + 0.5) * 728,
      (lz / 3.2 + 0.5) * 896,
    ];
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    LEG_Z.forEach((z) => {
      const [cx, cy] = toPx(0, z);
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.font = '700 50px "JetBrains Mono", monospace';
    const [tx, ty] = toPx(0, -1.38);
    ctx.fillText('KY-003', tx, ty);
    ctx.font = '600 34px "JetBrains Mono", monospace';
    const [lx, ly] = toPx(0.85, 0.05);
    ctx.fillText('-  +  S', lx, ly);
  }, { width: 728, height: 896 });
}

/** Cetakan muka bermerek IC A3144 (sisi peka magnet): teks "3144". */
function createIcPrint(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      ctx.fillStyle = '#d4d4d8';
      ctx.font = 'bold 74px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('3144', width / 2, height / 2 + 26);
    },
    { width: 220, height: 260 },
  );
}

/**
 * Sensor Hall KY-003 prosedural (riset komponen §13): papan merah
 * Keyes 18,5 × 15 mm (modul terkecil di katalog, diskalakan pola
 * modul proyek) dengan IC A3144 TO-92UA tegak bermuka bermerek
 * ("3144", sisi peka — kutub selatan magnet menghadap ke sini), LED
 * indikator + resistor 680 Ω on-board, dan header 3-pin −/+/S.
 * Klik modul untuk mendekatkan magnet: blok magnet muncul di depan
 * muka IC dan LED menyala saat keluaran aktif.
 */
export const Ky003Render3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const magnet = magnetNearOf(instance);
  const silkscreen = useMemo(createKy003Silkscreen, []);
  const icPrint = useMemo(createIcPrint, []);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ magnet: !magnet });
  };

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* Tiga kaki header menuju pin elektrik GND-VCC-S */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* PCB modul merah membulat */}
      <RoundedBox args={[2.6, 0.26, 3.2]} radius={0.09} smoothness={4} position={[0, 0.76, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={PCB_RED} />
      </RoundedBox>
      {/* Silkscreen di muka atas PCB */}
      <mesh position={[0, 0.895, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 3.2]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} />
      </mesh>

      {/* IC A3144 (TO-92UA) tegak di tepi depan papan */}
      <group position={[0.55, 0.89, 0.95]}>
        {/* Tiga kaki IC menyebar masuk ke papan */}
        {[-0.24, 0, 0.24].map((dx) => (
          <mesh key={`icleg-${dx}`} position={[dx, 0.22, 0]}>
            <boxGeometry args={[0.09, 0.5, 0.05]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        ))}
        {/* Badan IC dengan muka bermerek menghadap +Z */}
        <RoundedBox args={[0.9, 1.05, 0.45]} radius={0.06} smoothness={4} position={[0, 0.82, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </RoundedBox>
        <mesh position={[0, 0.82, 0.235]}>
          <planeGeometry args={[0.78, 0.92]} />
          <meshStandardMaterial map={icPrint} transparent roughness={0.55} />
        </mesh>
      </group>

      {/* LED indikator on-board — menyala saat keluaran aktif */}
      <group position={[-0.72, 0.89, 0.95]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.17, 0.18, 0.1, 16]} />
          <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.15, 16, 12]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={magnet ? 2.8 : 0.05}
            roughness={0.3}
          />
        </mesh>
      </group>

      {/* Resistor 680 Ω on-board terbaring di samping LED */}
      <mesh position={[-0.72, 0.95, 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.55, 14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.keramik} color={COLOR_TOKENS.resistorBody} />
      </mesh>

      {/* Magnet batang di depan muka IC saat aktif (properti gizmo
          visual, pola reed switch): ferit gelap + kutub merah. */}
      {magnet && (
        <group position={[0.55, 1.7, 2.15]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.9, 1.7, 0.55]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={COLOR_TOKENS.karetGelap} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[0.91, 0.46, 0.56]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={COLOR_TOKENS.cableRed} />
          </mesh>
        </group>
      )}
    </group>
  );
};
