import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  Shape,
  Vector3,
  type Group,
} from 'three';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';

/**
 * Material & warna dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3/§4): kaleng & poros & terminal = kelas
 * canAluminium/metalPin, tutup ujung = kelas absWarna warna merah
 * token servoWireRed (merah yang sama dengan pita motor lama), kabel =
 * token yang sama + plastikHitam. Tidak ada hex liar baru.
 */

/** Tinggi pusat kaleng: penampang asli 20 × 15 mm dipipihkan 0,75. */
const CAN_Y = 3.15;

/**
 * Geometri SATU bilah baling-baling: outline dayung cetakan (melebar ke
 * ujung, berujung membulat) diekstrusi tipis dengan bevel, diputar ke
 * bidang YZ (tegak lurus poros X), lalu dipuntir ±28° mengelilingi
 * sumbu radialnya — pitch bilah cetakan asli, bukan balok bersilang.
 * Dipakai dua kali; bilah kedua diputar 180° mengelilingi poros.
 */
function createBladeGeometry(): ExtrudeGeometry {
  const shape = new Shape();
  shape.moveTo(-0.3, 0.3);
  shape.quadraticCurveTo(-0.52, 1.5, -0.14, 2.28);
  shape.quadraticCurveTo(0, 2.44, 0.16, 2.3);
  shape.quadraticCurveTo(0.5, 1.5, 0.3, 0.3);
  shape.quadraticCurveTo(0, 0.16, -0.3, 0.3);
  const geo = new ExtrudeGeometry(shape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -0.05);
  geo.rotateY(Math.PI / 2); // bidang dayung XY → YZ (radial tetap +Y)
  geo.rotateY(0.49); // puntiran pitch mengelilingi sumbu radial Y
  return geo;
}

/**
 * Motor DC 130 prosedural (SPESIFIKASI-GAYA-3D §5 Gelombang 2; riset
 * Part A: 27,5 × 20 × 15 mm, poros 8 × Ø2, tutup ujung merah):
 * kaleng aluminium penampang pipih-oval (dua sisi sedikit pipih dari
 * pemipihan vertikal 0,75) dengan dua cincin lekukan crimp di dekat
 * muka depan, tutup ujung plastik MERAH di belakang dengan dua
 * terminal solder berlubang, dan kabel pendek berwarna (merah ke pin
 * PLUS z=−1, hitam ke MINUS z=+1) menekuk kontinu via TubeGeometry
 * ke titik pin yang sama seperti sebelumnya — jangkar pin tidak
 * bergeser. Baling-baling = hub + 2 bilah cetakan berpuntir; putaran
 * memakai useFrame persis seperti sebelumnya (kecepatan sudut
 * sebanding arus cabang 'main', berhenti saat poros dikunci via klik
 * atau motor rusak).
 */
export const DcMotorRender3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const propRef = useRef<Group>(null);
  const angleRef = useRef(0);
  const locked = instance.interactiveState.locked === true;
  const damaged = instance.simState.isDamaged;
  const current = Math.abs(instance.simState.branchCurrents['main'] ?? 0);

  const bladeGeometry = useMemo(createBladeGeometry, []);
  useEffect(() => () => bladeGeometry.dispose(), [bladeGeometry]);

  // Kabel dari terminal belakang ke pin: merah → PLUS (z=−1), hitam → MINUS (z=+1).
  const wireCurves = useMemo(
    () => [
      new CatmullRomCurve3([
        new Vector3(-5.6, 2.9, -0.95),
        new Vector3(-4.6, 1.3, -1.15),
        new Vector3(-2.2, 0.16, -1),
        new Vector3(0, 0.04, -1),
      ]),
      new CatmullRomCurve3([
        new Vector3(-5.6, 2.9, 0.95),
        new Vector3(-4.6, 1.3, 1.15),
        new Vector3(-2.2, 0.16, 1),
        new Vector3(0, 0.04, 1),
      ]),
    ],
    [],
  );

  useFrame((_state, delta) => {
    if (!propRef.current) return;
    if (!locked && !damaged) {
      angleRef.current += current * 20 * Math.min(delta, 0.1);
    }
    propRef.current.rotation.x = angleRef.current;
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ locked: !locked });
  };

  const propColor = locked ? '#b91c1c' : COLOR_TOKENS.servoWireOrange;

  return (
    <group
      position={instance.position}
      rotation={[0, instance.rotation, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* Kabel berwarna dari terminal ke titik pin (tekuk kontinu) */}
      {wireCurves.map((curve, i) => (
        <mesh key={`wire-${i}`} castShadow>
          <tubeGeometry args={[curve, 24, 0.11, 10, false]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.absWarna}
            color={i === 0 ? COLOR_TOKENS.servoWireRed : COLOR_TOKENS.plastikHitam}
          />
        </mesh>
      ))}

      {/* Rakitan kaleng: grup dipipihkan vertikal 0,75 → penampang
          oval 20 × 15 mm khas motor 130 (sumbu sepanjang X). */}
      <group position={[0, CAN_Y, 0]} scale={[1, 0.75, 1]}>
        {/* Kaleng aluminium */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[3.94, 3.94, 8.9, 36]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.canAluminium}
            color={damaged ? '#4a423c' : COLOR_TOKENS.canAluminium}
          />
        </mesh>
        {/* Dua cincin lekukan crimp di dekat muka depan */}
        {[4.05, 3.45].map((x) => (
          <mesh key={`crimp-${x}`} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[3.97, 3.97, 0.28, 36]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
        ))}
        {/* Pelat muka depan */}
        <mesh position={[4.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[3.5, 3.5, 0.3, 36]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </mesh>
        {/* Tutup ujung plastik MERAH di belakang */}
        <mesh position={[-4.95, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[3.85, 3.85, 1.15, 36]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.absWarna}
            color={COLOR_TOKENS.servoWireRed}
          />
        </mesh>
      </group>

      {/* Terminal solder berlubang di muka belakang tutup merah */}
      {[-0.95, 0.95].map((z) => (
        <group key={`terminal-${z}`}>
          <mesh position={[-5.6, CAN_Y, z]} castShadow>
            <boxGeometry args={[0.18, 1, 0.55]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
          <mesh position={[-5.71, CAN_Y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.2, 12]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
          </mesh>
        </group>
      ))}

      {/* Bos bantalan + poros metal Ø2 mm keluar dari muka depan */}
      <mesh position={[4.85, CAN_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.55, 20]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[5.6, CAN_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 1.9, 14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Baling-baling: hub + 2 bilah cetakan berpuntir (berputar
          sebanding arus lewat useFrame, sama seperti sebelumnya) */}
      <group ref={propRef} position={[6.5, CAN_Y, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.85, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </mesh>
        {[0, Math.PI].map((rot) => (
          <mesh
            key={`blade-${rot}`}
            geometry={bladeGeometry}
            rotation={[rot, 0, 0]}
            castShadow
          >
            <meshPhysicalMaterial
              {...MATERIAL_PROPS.absWarna}
              color={propColor}
            />
          </mesh>
        ))}
      </group>

      {/* Badge tegangan motor live dari pinVoltages PLUS − MINUS */}
      <LiveBadge instance={instance} y={7.3} />
    </group>
  );
};
