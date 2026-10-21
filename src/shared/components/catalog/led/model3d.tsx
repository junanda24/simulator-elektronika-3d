import type { ComponentType } from 'react';
import * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';

/**
 * Warna LED dari token fungsional terkunci (SPESIFIKASI-GAYA-3D §4:
 * hue warna LED TIDAK boleh digeser) — dipetakan dari nama warna props.
 */
const LED_COLORS: Record<string, string> = {
  red: COLOR_TOKENS.ledRed,
  yellow: COLOR_TOKENS.ledYellow,
  green: COLOR_TOKENS.ledGreen,
  blue: COLOR_TOKENS.ledBlue,
  white: COLOR_TOKENS.ledWhite,
};

/** Epoxy gosong saat LED rusak — hitam legam seperti model lama. */
const BURNT_EPOXY = '#151312';

/**
 * Geometri bersama antar instance (§2.7: geometri di-reuse, tidak dibuat
 * per render; tidak di-dispose karena hidup selama aplikasi).
 *
 * Flange Ø5,8 dengan SISI DATAR katoda (Part A riset A3): lingkaran
 * yang terpotong chord lurus di sisi +z (katoda), dibuat sebagai
 * extrude dari outline 2D dengan bevel halus — bukan silinder sempurna.
 */
const FLANGE_RADIUS = 1.13; // + bevel 0,03 ≈ 1,16 satuan ≈ Ø5,8 mm
const FLANGE_FLAT = 0.92; // jarak chord sisi datar dari pusat (sisi katoda +z)

function createFlangeGeometry(): THREE.ExtrudeGeometry {
  const halfChord = Math.sqrt(FLANGE_RADIUS ** 2 - FLANGE_FLAT ** 2);
  const aRight = Math.atan2(FLANGE_FLAT, halfChord);
  const aLeft = Math.atan2(FLANGE_FLAT, -halfChord);
  const shape = new THREE.Shape();
  shape.moveTo(halfChord, FLANGE_FLAT);
  // Busur besar mengelilingi sisi bulat; garis tutup = sisi datar katoda.
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
  // Bidang shape (x, y) → (x, z) dunia; arah extrude → -y (dibalik posisi mesh).
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

const FLANGE_GEOMETRY = createFlangeGeometry();

/**
 * Badan + kubah sebagai SATU permukaan lathe (Ø5,0, profil asli 5 mm:
 * dinding silinder lalu kubah setengah bola menyatu tanpa sambungan).
 * Tinggi total dari pangkal 1,65 → puncak 4,85 satuan ≈ 8,6 mm asli.
 */
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

/** Kawat bond emas dari die (di cangkir anvil) ke ujung post anoda. */
function createBondWireGeometry(): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.9, 0.45),
    new THREE.Vector3(0, 3.24, 0.08),
    new THREE.Vector3(0, 3.08, -0.28),
    new THREE.Vector3(0, 2.84, -0.45),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.028, 6);
}

const BOND_WIRE_GEOMETRY = createBondWireGeometry();

/**
 * LED 5mm prosedural setia asli (SPESIFIKASI-GAYA-3D §5 Gelombang 2 +
 * Part A riset A3): kubah Ø5,0 & flange Ø5,8 dengan sisi datar katoda,
 * kaki PIPIH pelat stempel (anoda lebih panjang), dan struktur dalam
 * yang terlihat samar menembus epoxy kelas epoxyLed: cangkir
 * reflektor/anvil besar di kaki katoda, post kecil anoda, die + kawat
 * bond emas di antaranya. Opacity badan 0,92 (arah SOLID 2026-10-21
 * atas perintah user — override setempat di bawah, BUKAN bawaan kelas
 * epoxyLed 0,65, agar warna badan pekat dan kelas bersama tidak ikut
 * berubah untuk pemakai lain seperti LDR).
 * Perilaku menyala: emissive mengikuti arus cabang 'led' (flange
 * 1,2×, badan 3,2×) + pointLight ×50/jarak 9 — ditegaskan atas
 * perintah user 2026-10-21 (SPEK-TEMA-GELAP.md §B): di atas adegan
 * gelap nyala harus TEGAS terbaca dari badan komponennya sendiri,
 * TANPA bloom/halo (cahaya menempel di badan + pancaran lampu fisik
 * saja). Rusak = epoxy gosong gelap.
 */
export const LedRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const colorName = typeof instance.props.color === 'string' ? instance.props.color : 'red';
  const baseColor = LED_COLORS[colorName] ?? LED_COLORS.red;
  const current = instance.simState.branchCurrents['led'] ?? 0;
  const intensity = Math.min(Math.max(current / 0.02, 0), 1.5);
  const damaged = instance.simState.isDamaged;
  const domeColor = damaged ? BURNT_EPOXY : baseColor;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* — Rangka kaki (lead frame) — pelat pipih, BUKAN silinder bulat — */}
      {/* Kaki anoda (+) luar — lebih panjang, sisi lokal -Z (pin elektrik) */}
      <mesh position={[0, 0.3, -1]} castShadow>
        <boxGeometry args={[0.3, 2.6, 0.14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Kaki katoda (-) luar — lebih pendek, sisi lokal +Z (pin elektrik) */}
      <mesh position={[0, 0, 1]} castShadow>
        <boxGeometry args={[0.3, 2, 0.14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Sambungan tekuk rangka menuju tengah badan (di dalam epoxy) */}
      <mesh position={[0, 1.78, -0.72]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <boxGeometry args={[0.28, 0.8, 0.13]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      <mesh position={[0, 1.78, 0.72]} rotation={[-Math.PI / 4, 0, 0]} castShadow>
        <boxGeometry args={[0.28, 0.8, 0.13]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Post anoda — tiang kecil tempat ujung kawat bond menempel */}
      <mesh position={[0, 2.42, -0.45]} castShadow>
        <boxGeometry args={[0.26, 0.75, 0.12]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Batang katoda menuju cangkir reflektor */}
      <mesh position={[0, 2.3, 0.45]} castShadow>
        <boxGeometry args={[0.26, 0.55, 0.12]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Cangkir reflektor / anvil katoda — mangkuk besar khas LED asli */}
      <mesh position={[0, 2.74, 0.45]} castShadow>
        <cylinderGeometry args={[0.42, 0.15, 0.34, 20, 1, true]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} side={THREE.DoubleSide} />
      </mesh>
      {/* Die di dalam cangkir + kawat bond emas ke post anoda */}
      <mesh position={[0, 2.88, 0.45]}>
        <boxGeometry args={[0.2, 0.07, 0.2]} />
        <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={BOND_WIRE_GEOMETRY}>
        <meshStandardMaterial color={COLOR_TOKENS.resistorGold} metalness={0.75} roughness={0.35} />
      </mesh>

      {/* Flange alas — extrude bersisi datar katoda, epoxy berwarna pekat */}
      <mesh geometry={FLANGE_GEOMETRY} position={[0, 1.75, 0]} castShadow>
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.epoxyLed}
          opacity={0.92}
          color={domeColor}
          emissive={damaged ? '#000000' : baseColor}
          emissiveIntensity={damaged ? 0 : intensity * 1.2}
        />
      </mesh>

      {/* Badan + kubah menyatu — epoxy kelas epoxyLed dari pustaka, opacity 0,92 */}
      <mesh geometry={BODY_GEOMETRY} position={[0, 1.65, 0]} castShadow>
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.epoxyLed}
          opacity={0.92}
          color={domeColor}
          emissive={damaged ? '#000000' : baseColor}
          emissiveIntensity={damaged ? 0 : intensity * 3.2}
        />
      </mesh>

      {/* Cahaya titik saat LED menyala — pancaran fisik ke breadboard
          di sekitarnya, diperkuat bersama ketegasan badan (×50, jarak 9) */}
      {!damaged && intensity > 0.05 && (
        <pointLight
          position={[0, 3.2, 0]}
          color={baseColor}
          intensity={intensity * 50}
          distance={9}
          decay={2}
        />
      )}
    </group>
  );
};
