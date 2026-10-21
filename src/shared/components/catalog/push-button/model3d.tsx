import type { ComponentType } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3): kaki & rangka = kelas metalPin,
 * badan = kelas plastikHitam (#1B1B1F, bukan #000), plunger = kelas
 * karet (matte penuh, tidak bercahaya — seperti saklar taktil asli).
 */

/** Posisi kaki sesuai pin elektrik: A1, A2 (sisi -x), B1, B2 (sisi +x). */
const LEG_POSITIONS: Array<[number, number]> = [
  [-1.5, -1],
  [-1.5, 1],
  [1.5, -1],
  [1.5, 1],
];

/** Jarak turun plunger saat ditekan (mm asli ±0,25 → dibulatkan agar terbaca). */
const PRESS_TRAVEL = 0.24;

/**
 * Saklar taktil 6×6×4,3 mm prosedural (SPESIFIKASI-GAYA-3D §5 Gelombang 1):
 * badan plastik hitam ramping 6 mm (±2,36 satuan) di atas rok basis,
 * rangka penutup metal perak di tepi atas, plunger bundar kecil gelap di
 * tengah, dan 4 kaki pipih gull-wing yang menekuk keluar dari sisi badan
 * lalu turun tepat ke titik pin elektrik (±1,5 ; ±1).
 * Interaksi tidak berubah: pointerdown menekan (Shift+klik = kunci/latch),
 * pointerup atau pointerleave melepas bila tidak terkunci.
 */
export const PushButtonRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const pressed = instance.interactiveState.pressed === true;
  const latched = instance.interactiveState.latched === true;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.shiftKey) {
      onInteract({ latched: !latched, pressed: !latched });
    } else {
      onInteract({ pressed: true });
    }
  };

  const handleRelease = () => {
    if (!latched) onInteract({ pressed: false });
  };

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handleRelease}
      onPointerLeave={handleRelease}
    >
      {/* 4 kaki pipih gull-wing: strip mendatar keluar dari sisi badan,
          lalu menekuk turun hingga menyentuh bidang pin di (±1,5 ; ±1) */}
      {LEG_POSITIONS.map(([x, z]) => (
        <group key={`leg-${x}-${z}`}>
          <mesh position={[Math.sign(x) * 1.32, 0.7, z]} castShadow>
            <boxGeometry args={[0.52, 0.1, 0.5]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
          <mesh position={[x, 0.36, z]} castShadow>
            <boxGeometry args={[0.1, 0.72, 0.5]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        </group>
      ))}

      {/* Rok basis plastik hitam */}
      <RoundedBox
        args={[2.5, 0.35, 2.5]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.7, 0]}
        castShadow
      >
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </RoundedBox>

      {/* Badan utama 6×6 mm */}
      <RoundedBox
        args={[2.36, 0.95, 2.36]}
        radius={0.12}
        smoothness={4}
        position={[0, 1.35, 0]}
        castShadow
      >
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </RoundedBox>

      {/* Rangka penutup metal di tepi atas badan (4 strip membentuk bingkai) */}
      {([0, Math.PI / 2, Math.PI, -Math.PI / 2] as const).map((rot) => (
        <mesh
          key={`frame-${rot}`}
          position={[Math.sin(rot) * 1.02, 1.86, Math.cos(rot) * 1.02]}
          rotation={[0, rot, 0]}
          castShadow
        >
          <boxGeometry args={[1.7, 0.1, 0.34]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Plunger bundar kecil gelap — turun saat ditekan */}
      <mesh position={[0, pressed ? 2.1 - PRESS_TRAVEL : 2.1, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.55, 0.5, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.karet} />
      </mesh>
    </group>
  );
};
