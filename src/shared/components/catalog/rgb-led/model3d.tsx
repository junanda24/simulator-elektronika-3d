import type { ComponentType } from 'react';
import * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { GlowHalo } from '../../../../features/stage3d/effects/GlowHalo';

/** Arus kanal untuk kecerahan penuh (A) — sama seperti LED 5mm tunggal. */
const FULL_CURRENT_A = 0.02;

/** Posisi kaki sesuai pin elektrik: COM, R, G, B pada sumbu Z. */
const LEGS: Array<{ pin: string; z: number; long: boolean }> = [
  { pin: 'COM', z: -1.5, long: true },
  { pin: 'R', z: -0.5, long: false },
  { pin: 'G', z: 0.5, long: false },
  { pin: 'B', z: 1.5, long: false },
];

/** Epoxy gosong saat rusak — sama seperti LED tunggal. */
const BURNT_EPOXY = '#151312';
/** Warna epoxy RGB bening (tidak rusak). */
const CLEAR_EPOXY = '#eef2f3';

/**
 * Geometri bersama antar instance (§2.7) — bahasa bentuk yang sama
 * dengan LED 5mm tunggal: flange Ø5,8 bersisi datar (extrude + bevel)
 * dan badan + kubah Ø5,0 sebagai satu permukaan lathe.
 */
const FLANGE_RADIUS = 1.13;
const FLANGE_FLAT = 0.92;

function createFlangeGeometry(): THREE.ExtrudeGeometry {
  const halfChord = Math.sqrt(FLANGE_RADIUS ** 2 - FLANGE_FLAT ** 2);
  const aRight = Math.atan2(FLANGE_FLAT, halfChord);
  const aLeft = Math.atan2(FLANGE_FLAT, -halfChord);
  const shape = new THREE.Shape();
  shape.moveTo(halfChord, FLANGE_FLAT);
  shape.absarc(0, 0, FLANGE_RADIUS, aRight, aLeft, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.028,
    bevelSegments: 2,
    curveSegments: 48,
  });
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

const FLANGE_GEOMETRY = createFlangeGeometry();

function createBodyGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.98, 0),
    new THREE.Vector2(1, 0.06),
    new THREE.Vector2(1, 2.2),
  ];
  for (let i = 1; i <= 8; i += 1) {
    const t = (i / 8) * (Math.PI / 2);
    points.push(new THREE.Vector2(Math.cos(t), 2.2 + Math.sin(t)));
  }
  return new THREE.LatheGeometry(points, 28);
}

const BODY_GEOMETRY = createBodyGeometry();

/** Satu kawat bond emas: lengkung dari ujung post kanal ke die-nya. */
function createBondWire(points: Array<[number, number, number]>): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  return new THREE.TubeGeometry(curve, 20, 0.028, 6);
}

/** Tiga die berjajar di cangkir rangka COM (sumbu x), sesuai urutan R/G/B. */
const DIES: Array<{ x: number }> = [{ x: -0.26 }, { x: 0 }, { x: 0.26 }];

/** Ujung post dalam tiap kanal + kawat bond menuju die terdekat. */
const POSTS: Array<{
  pin: string;
  outerZ: number;
  innerZ: number;
  topY: number;
  tilt: number;
  span: number;
  wire: THREE.TubeGeometry;
}> = [
  {
    pin: 'R',
    outerZ: -0.5,
    innerZ: -0.3,
    topY: 2.62,
    tilt: 0.35,
    span: 0.72,
    wire: createBondWire([
      [0, 2.62, -0.3],
      [-0.1, 2.95, -0.42],
      [-0.26, 2.94, -0.55],
    ]),
  },
  {
    pin: 'G',
    outerZ: 0.5,
    innerZ: -0.05,
    topY: 2.76,
    tilt: -Math.PI / 4,
    span: 0.95,
    wire: createBondWire([
      [0, 2.76, -0.05],
      [0, 3.02, -0.3],
      [0, 2.96, -0.55],
    ]),
  },
  {
    pin: 'B',
    outerZ: 1.5,
    innerZ: 0.2,
    topY: 2.9,
    tilt: -1.17,
    span: 1.5,
    wire: createBondWire([
      [0, 2.9, 0.2],
      [0.12, 3.14, -0.18],
      [0.26, 2.98, -0.55],
    ]),
  },
];

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * LED RGB 5mm prosedural setia asli (SPESIFIKASI-GAYA-3D §5 Gelombang 2,
 * mengikuti bahasa LED 5mm): kubah bening Ø5,0 + flange Ø5,8 bersisi
 * datar, EMPAT kaki PIPIH pelat stempel (COM terpanjang), dan rangka
 * dalam yang terlihat menembus epoxy kelas epoxyLed: cangkir lebar di
 * kaki COM memegang tiga die R/G/B, tiga post kanal, dan kawat bond
 * emas ke tiap die. Perilaku menyala: emissive = campuran kanal r/g/b
 * dari simState (flange 1,0×, badan 2,6× — wilayah HDR untuk Bloom) +
 * halo sprite additive + pointLight tumpahan.
 */
export const RgbLedRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const currents = instance.simState.branchCurrents;
  const r = clamp01((currents['r'] ?? 0) / FULL_CURRENT_A);
  const g = clamp01((currents['g'] ?? 0) / FULL_CURRENT_A);
  const b = clamp01((currents['b'] ?? 0) / FULL_CURRENT_A);
  const damaged = instance.simState.isDamaged;
  const mixed = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  const peak = Math.max(r, g, b);
  const domeColor = damaged ? BURNT_EPOXY : CLEAR_EPOXY;
  const emissive = damaged ? '#000000' : mixed;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Empat kaki luar — pelat pipih; COM paling panjang */}
      {LEGS.map(({ pin, z, long }) => (
        <mesh key={`leg-${pin}`} position={[0, long ? 0.3 : 0, z]} castShadow>
          <boxGeometry args={[long ? 0.34 : 0.3, long ? 2.6 : 2, 0.14]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Rangka COM: tekuk masuk lalu batang lebar memegang cangkir die */}
      <mesh position={[0, 1.78, -1.02]} rotation={[1.05, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 1.1, 0.13]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[0, 2.35, -0.55]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Cangkir reflektor lebar di ujung rangka COM */}
      <mesh position={[0, 2.8, -0.55]} castShadow>
        <cylinderGeometry args={[0.5, 0.2, 0.32, 20, 1, true]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} side={THREE.DoubleSide} />
      </mesh>
      {/* Tiga die R/G/B berjajar di dalam cangkir */}
      {DIES.map(({ x }) => (
        <mesh key={`die-${x}`} position={[x, 2.92, -0.55]}>
          <boxGeometry args={[0.16, 0.06, 0.16]} />
          <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}

      {/* Post dalam kanal R/G/B + kawat bond emas ke die masing-masing */}
      {POSTS.map((post) => (
        <group key={`post-${post.pin}`}>
          <mesh
            position={[0, 1.78, (post.outerZ + post.innerZ) / 2]}
            rotation={[post.tilt, 0, 0]}
            castShadow
          >
            <boxGeometry args={[0.26, post.span, 0.12]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
          <mesh position={[0, (2.05 + post.topY) / 2, post.innerZ]} castShadow>
            <boxGeometry args={[0.24, post.topY - 2.05, 0.12]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
          </mesh>
          <mesh geometry={post.wire}>
            <meshStandardMaterial color={COLOR_TOKENS.resistorGold} metalness={1} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Flange alas — extrude bersisi datar, epoxy bening */}
      <mesh geometry={FLANGE_GEOMETRY} position={[0, 1.75, 0]} castShadow>
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.epoxyLed}
          color={domeColor}
          emissive={emissive}
          emissiveIntensity={damaged ? 0 : 1}
        />
      </mesh>

      {/* Badan + kubah bening menyatu — epoxy kelas epoxyLed. Faktor
          emissive 2,6 (gelombang "efek hidup"): campuran kanal penuh
          mencapai wilayah HDR yang tertangkap Bloom. */}
      <mesh geometry={BODY_GEOMETRY} position={[0, 1.65, 0]} castShadow>
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.epoxyLed}
          color={domeColor}
          emissive={emissive}
          emissiveIntensity={damaged ? 0 : 2.6}
        />
      </mesh>

      {/* Halo cahaya campuran di sekitar kubah, sebanding kanal terkuat */}
      {!damaged && <GlowHalo color={mixed} drive={peak} position={[0, 3.3, 0]} />}

      {/* Cahaya titik berwarna campuran saat ada kanal menyala —
          tumpahan diperlebar 5 → 16 satuan seperti LED tunggal */}
      {!damaged && peak > 0.05 && (
        <pointLight position={[0, 3.2, 0]} color={mixed} intensity={peak * 55} distance={16} decay={2} />
      )}

      {/* Badge arus per kanal live dari branchCurrents r/g/b */}
      <LiveBadge instance={instance} y={5.7} />
    </group>
  );
};
