import { useMemo, type ComponentType } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { CatmullRomCurve3, DoubleSide, Vector3 } from 'three';
import type { ComponentRenderProps } from '../../../types';
import { magnetNearOf } from './electrical';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`: kapsul =
 * kelas kaca (sama seperti tilt-switch/fuse), bilah & kaki = kelas
 * metalPin.
 */

/** Ketinggian sumbu kapsul di atas board. */
const CAPSULE_Y = 0.78;

/**
 * Reed switch MKA14103 prosedural (riset komponen §6): kapsul kaca
 * aksial "2×14 mm" (Ø ±2,2 mm → jari-jari 0,43 satuan; panjang 14 mm →
 * 5,5 satuan) terbaring horizontal dengan DUA BILAH FEROMAGNETIK
 * PIPIH BERTUMPUK terlihat di tengahnya — identitas komponen ini.
 * Kaki aksial keluar dari kedua ujung kapsul lalu menekuk turun ke
 * pin elektrik x = ∓3 (pola kaki resistor). Klik kapsul untuk
 * mendekatkan magnet: blok magnet muncul melayang di atas kapsul dan
 * bilah berpendar hijau samar seperti penanda kontak tertutup pada
 * tilt-switch.
 */
export const ReedSwitchRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const magnet = magnetNearOf(instance);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ magnet: !magnet });
  };

  // Kaki aksial: keluar dari ujung kapsul (±2,6) lalu menekuk turun
  // menancap di titik pin elektrik x = ±3.
  const leadCurves = useMemo(
    () => [
      new CatmullRomCurve3([
        new Vector3(-2.55, CAPSULE_Y, 0),
        new Vector3(-2.95, CAPSULE_Y - 0.02, 0),
        new Vector3(-3, CAPSULE_Y - 0.3, 0),
        new Vector3(-3, -0.45, 0),
      ]),
      new CatmullRomCurve3([
        new Vector3(2.55, CAPSULE_Y, 0),
        new Vector3(2.95, CAPSULE_Y - 0.02, 0),
        new Vector3(3, CAPSULE_Y - 0.3, 0),
        new Vector3(3, -0.45, 0),
      ]),
    ],
    [],
  );

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* Kaki aksial metal dari kedua ujung kapsul ke titik pin */}
      {leadCurves.map((curve, i) => (
        <mesh key={`lead-${i}`} castShadow>
          <tubeGeometry args={[curve, 20, 0.09, 10, false]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Kapsul kaca bening Ø2,2 × 14 mm terbaring aksial — bilah di
          dalam WAJIB terlihat: opacity tipis kelas kaca, dua sisi,
          tanpa depthWrite (preseden tilt-switch). */}
      <mesh
        position={[0, CAPSULE_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
        renderOrder={2}
        castShadow
      >
        <capsuleGeometry args={[0.43, 4.64, 8, 28]} />
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.kaca}
          opacity={0.3}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Dua bilah feromagnetik pipih bertumpuk (overlap) di tengah
          kapsul — masing-masing berakar di ujungnya, ujung bebasnya
          bertemu di tengah; berpendar hijau samar saat kontak tutup. */}
      {[-1, 1].map((side) => (
        <mesh
          key={`blade-${side}`}
          position={[side * 0.88, CAPSULE_Y + (side < 0 ? 0.045 : -0.045), 0]}
        >
          <boxGeometry args={[2.5, 0.05, 0.5]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.metalPin}
            roughness={0.3}
            emissive="#10b981"
            emissiveIntensity={magnet ? 0.4 : 0}
          />
        </mesh>
      ))}

      {/* Magnet batang melayang di atas kapsul saat aktif (properti
          gizmo visual): badan ferit gelap + kutub merah di satu ujung. */}
      {magnet && (
        <group position={[0, CAPSULE_Y + 1.35, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.7, 0.55, 0.9]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={COLOR_TOKENS.karetGelap} />
          </mesh>
          <mesh position={[0.62, 0, 0]} castShadow>
            <boxGeometry args={[0.46, 0.56, 0.91]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={COLOR_TOKENS.cableRed} />
          </mesh>
        </group>
      )}
    </group>
  );
};
