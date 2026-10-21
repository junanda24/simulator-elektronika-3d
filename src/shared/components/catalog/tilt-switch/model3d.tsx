import { useMemo, useRef, type ComponentType } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  DoubleSide,
  MathUtils,
  Vector3,
  type Group,
  type Mesh,
} from 'three';
import type { ComponentRenderProps } from '../../../types';
import { MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3): kapsul = kelas kaca (r 0,08, cc 1,0 —
 * transparansi tipis TANPA transmission, sama seperti fuse), bola &
 * kawat & tiang kontak = kelas metalPin (wajib kena environment map).
 */

/** Kemiringan tabung (rad, ±25°) mengikuti state tilted. */
const TILT_RAD = (25 * Math.PI) / 180;

/**
 * Saklar miring SW-520D prosedural (SPESIFIKASI-GAYA-3D §5 Gelombang 2):
 * kapsul kaca bening Ø5,5 × 13,5 mm (skala proyek 2,54 mm = 1 satuan)
 * dengan BOLA KONTAK METAL TERLIHAT di dalamnya — syarat utama komponen
 * ini; pada model lama bola terkubur di dalam tabung opak. Bola
 * menggelinding ke sisi rendah mengikuti sudut miring dan berpendar
 * hijau saat kontak tertutup (state tilted), seperti penanda lama.
 * Dua kawat keluar dari SEGEL UJUNG YANG SAMA di pangkal kapsul, lalu
 * menekuk kontinu (TubeGeometry pada CatmullRomCurve3, §2.4) menyebar
 * ke dua titik pin elektrik yang sama seperti sebelumnya (z = −1, +1)
 * — jangkar pin tidak bergeser. Klik kapsul untuk toggle; animasi
 * miring ±25° diinterpolasi lewat useFrame persis seperti sebelumnya.
 */
export const TiltSwitchRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const tilted = instance.interactiveState.tilted === true;

  // Animasi miring halus: sudut badan diinterpolasi menuju target state
  // (±25°) lewat ref grup, bukan berganti seketika.
  const bodyRef = useRef<Group>(null);
  const ballRef = useRef<Mesh>(null);
  const targetAngle = tilted ? -TILT_RAD : TILT_RAD;
  const targetAngleRef = useRef(targetAngle);
  targetAngleRef.current = targetAngle;
  const currentAngleRef = useRef(targetAngle);

  useFrame((_state, delta) => {
    const next = MathUtils.lerp(
      currentAngleRef.current,
      targetAngleRef.current,
      1 - Math.exp(-12 * delta),
    );
    currentAngleRef.current = next;
    if (bodyRef.current) bodyRef.current.rotation.z = next;
    // Bola bebas di dalam kapsul: menggelinding ke sisi yang lebih
    // rendah mengikuti sudut miring saat ini (komponen lateral
    // gravitasi di kerangka lokal kapsul = −sin sudut).
    if (ballRef.current) {
      ballRef.current.position.x = -Math.sin(next) * 0.3;
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ tilted: !tilted });
  };

  // Dua kawat dari segel pangkal kapsul menyebar ke pin z = −1 / +1.
  // Kawat dari stub +x menuju pin −z dan sebaliknya (menyilang menyebar
  // seperti kaki SW-520D asli yang melebar dari satu ujung).
  const wireCurves = useMemo(
    () => [
      new CatmullRomCurve3([
        new Vector3(0.35, 0.6, 0),
        new Vector3(0.62, 0.34, -0.3),
        new Vector3(0.42, 0.14, -0.72),
        new Vector3(0, 0.04, -1),
      ]),
      new CatmullRomCurve3([
        new Vector3(-0.35, 0.6, 0),
        new Vector3(-0.62, 0.34, 0.3),
        new Vector3(-0.42, 0.14, 0.72),
        new Vector3(0, 0.04, 1),
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
      {/* Dua kawat tekuk kontinu dari segel kapsul ke titik pin.
          Statis (di luar grup miring) agar ujung pin tidak ikut
          bergeser; pangkalnya tertutup gumpalan segel di titik awal. */}
      {wireCurves.map((curve, i) => (
        <mesh key={`wire-${i}`} castShadow>
          <tubeGeometry args={[curve, 24, 0.09, 10, false]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}
      {/* Gumpalan segel di pangkal tiap kawat — menutup sambungan
          antara stub kapsul yang bergerak dan kawat statis. */}
      {[0.35, -0.35].map((x) => (
        <mesh key={`seal-blob-${x}`} position={[x, 0.58, 0]} castShadow>
          <sphereGeometry args={[0.17, 14, 10]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Kapsul miring mengikuti state (dianimasikan via useFrame) */}
      <group ref={bodyRef} position={[0, 0.7, 0]} rotation={[0, 0, tilted ? -TILT_RAD : TILT_RAD]}>
        {/* Segel metal di pangkal kapsul — kedua kawat keluar dari sini */}
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[1.07, 1.07, 0.6, 28]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
        </mesh>
        {/* Stub dua kawat mencuat dari segel ke arah kawat statis */}
        {[0.35, -0.35].map((x) => (
          <mesh key={`stub-${x}`} position={[x, -0.02, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.5, 10]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        ))}

        {/* Kapsul kaca bening Ø5,5 × 13,5 mm — bola di dalam WAJIB
            terlihat: opacity tipis kelas kaca, dua sisi, tanpa
            depthWrite agar bola metal tidak tertutup pantulan kaca. */}
        <mesh position={[0, 2.82, 0]} renderOrder={2} castShadow>
          <capsuleGeometry args={[1.05, 3.15, 8, 28]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.kaca}
            opacity={0.38}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Dua tiang kontak metal di pangkal dalam kapsul */}
        {[0.35, -0.35].map((x) => (
          <mesh key={`post-${x}`} position={[x, 0.78, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.75, 10]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        ))}

        {/* Bola kontak metal bebas — terlihat menembus kaca, bertumpu
            di atas tiang kontak, bergeser lateral mengikuti miring. */}
        <mesh ref={ballRef} position={[0, 1.3, 0]}>
          <sphereGeometry args={[0.68, 24, 18]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.metalPin}
            roughness={0.22}
            emissive="#10b981"
            emissiveIntensity={tilted ? 0.5 : 0}
          />
        </mesh>
      </group>
    </group>
  );
};
