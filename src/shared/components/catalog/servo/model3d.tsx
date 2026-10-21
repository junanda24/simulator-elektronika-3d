import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils, type Group } from 'three';
import type { ComponentRenderProps } from '../../../types';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/**
 * Warna kabel standar SG90 sesuai urutan pin: GND, VCC, SIG — token
 * fungsional §4 (hue terkunci, tidak digeser): cokelat, merah, oranye.
 */
const WIRE_TOKENS = [
  COLOR_TOKENS.servoWireBrown,
  COLOR_TOKENS.servoWireRed,
  COLOR_TOKENS.servoWireOrange,
] as const;

/** Putih plastik tanduk — nilai incumbent file ini (benda asli setempat). */
const HORN_WHITE = '#f2f3f5';
/** Tinta stiker label — sama dengan tinta label relay (preseden gelombang 1). */
const LABEL_INK = '#16233c';
/**
 * Shade gelap case untuk garis seam & leher poros: DITURUNKAN dari token
 * biru SG90 (Color Expert: encode the derivation), bukan hex karangan.
 */
const CASE_SHADE = `#${new THREE.Color(COLOR_TOKENS.servoCaseBlue)
  .offsetHSL(0, 0, -0.08)
  .getHexString()}`;

/**
 * Pelat kuping pemasangan dengan DUA LUBANG TEMBUS asli di ujungnya
 * (x = ±1,87, r 0,3) seperti SG90 asli — menggantikan pelat polos lama
 * yang malah memasang kepala sekrup di posisi lubang. Outline persegi
 * membulat 4,54 × 3,54 diekstrusi 0,29 + bevel 0,03 → total 4,6 × 3,6 ×
 * 0,35, sama dengan footprint & ketebalan pelat lama (jangkar adegan
 * tidak bergeser). Setelah rotateX, geometri digeser agar alasnya di y=0.
 */
function createFlangeGeometry(): THREE.ExtrudeGeometry {
  const roundedRect = (target: THREE.Shape | THREE.Path, w: number, h: number, r: number) => {
    const x = -w / 2;
    const y = -h / 2;
    target.moveTo(x + r, y);
    target.lineTo(x + w - r, y);
    target.quadraticCurveTo(x + w, y, x + w, y + r);
    target.lineTo(x + w, y + h - r);
    target.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    target.lineTo(x + r, y + h);
    target.quadraticCurveTo(x, y + h, x, y + h - r);
    target.lineTo(x, y + r);
    target.quadraticCurveTo(x, y, x + r, y);
  };
  const shape = new THREE.Shape();
  roundedRect(shape, 4.54, 3.54, 0.34);
  ([-1.87, 1.87] as const).forEach((hx) => {
    const hole = new THREE.Path();
    hole.absarc(hx, 0, 0.3, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  });
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.29,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 32,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.translate(0, -(geometry.boundingBox?.min.y ?? 0), 0);
  return geometry;
}

/**
 * Kabel lentur keluar dari sisi bawah badan menuju titik pin (0, 0, z):
 * kurva CatmullRom melengkung halus keluar lalu kembali tepat ke jangkar
 * pin — meniru helai kabel SG90 asli, bukan pin kaku. Geometri dibuat
 * sekali di z=0 lalu dipakai ulang untuk ketiga kabel (§2.4 & §2.7);
 * radius 0,09 sama dengan pin lama agar titik sambung tidak berubah.
 */
function createWireGeometry(): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.95, 0),
    new THREE.Vector3(0.2, 0.6, 0),
    new THREE.Vector3(0.27, 0.32, 0),
    new THREE.Vector3(0.14, 0.1, 0),
    new THREE.Vector3(0, 0, 0),
  ]);
  return new THREE.TubeGeometry(curve, 20, 0.09, 10, false);
}

/**
 * Stiker label badan SG90 (§2.5, helper label resmi): bidang 2,3 × 1,15
 * unit → kanvas 512 × 256. Teks persis cetakan stiker asli: "SG90"
 * dominan + garis aksen biru case + "Micro Servo" di bawahnya.
 */
function createServoLabel(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = LABEL_INK;
      ctx.font = '700 118px Arial, sans-serif';
      ctx.fillText('SG90', width / 2, 118);
      ctx.fillStyle = COLOR_TOKENS.servoCaseBlue;
      ctx.fillRect(width / 2 - 190, 148, 380, 12);
      ctx.fillStyle = LABEL_INK;
      ctx.font = '600 54px Arial, sans-serif';
      ctx.fillText('Micro Servo', width / 2, 222);
    },
    { width: 512, height: 256, background: '#eef1f4' },
  );
}

/**
 * Motor servo SG90 prosedural bergaya stylized realism (gelombang 3 —
 * poles): badan biru translucent ringan dengan stiker "SG90", garis
 * seam casing, kuping pemasangan BERLUBANG TEMBUS, tonjolan rumah gir
 * bundar + leher poros, dan tiga kabel lentur warna asli (cokelat/
 * merah/oranye) keluar dari bawah badan ke titik pin. Tanduk putih
 * berlubang berputar pada sumbu Y mengikuti branchCurrents.angle
 * (0–180°, default 90° = netral) — perilaku sudut tidak berubah.
 */
export const ServoRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const angle = instance.simState.branchCurrents['angle'];
  const angleDeg = typeof angle === 'number' && Number.isFinite(angle) ? angle : 90;
  const hornRotationY = ((angleDeg - 90) * Math.PI) / 180;

  // Gerak mekanis halus: sudut tanduk diinterpolasi eksponensial menuju
  // target dari simulasi (bukan melompat instan), seperti servo asli.
  const hornRef = useRef<Group>(null);
  const targetAngleRef = useRef(angleDeg);
  targetAngleRef.current = angleDeg;
  const currentAngleRef = useRef(angleDeg);

  useFrame((_state, delta) => {
    const next = MathUtils.lerp(
      currentAngleRef.current,
      targetAngleRef.current,
      1 - Math.exp(-10 * delta),
    );
    currentAngleRef.current = next;
    if (hornRef.current) {
      hornRef.current.rotation.y = ((next - 90) * Math.PI) / 180;
    }
  });

  const flangeGeometry = useMemo(createFlangeGeometry, []);
  const wireGeometry = useMemo(createWireGeometry, []);
  const labelTexture = useMemo(createServoLabel, []);
  useEffect(
    () => () => {
      flangeGeometry.dispose();
      wireGeometry.dispose();
      labelTexture.dispose();
    },
    [flangeGeometry, wireGeometry, labelTexture],
  );

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kabel lentur warna asli menuju pin elektrik (z = -1, 0, +1) */}
      {WIRE_TOKENS.map((color, i) => (
        <mesh key={`wire-${i}`} geometry={wireGeometry} position={[0, 0, i - 1]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.karet} color={color} />
        </mesh>
      ))}

      {/* Badan SG90: RoundedBox biru case sedikit translucent seperti
          plastik asli (opacity ringan; kelas absWarna §3 + token warna) */}
      <RoundedBox args={[3, 2.2, 3.6]} radius={0.16} smoothness={4} position={[0, 1.7, 0]} castShadow>
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.absWarna}
          color={COLOR_TOKENS.servoCaseBlue}
          opacity={0.92}
          transparent
        />
      </RoundedBox>

      {/* Garis seam casing: pita tipis shade gelap membagi badan atas/bawah */}
      <RoundedBox args={[3.04, 0.07, 3.64]} radius={0.03} smoothness={4} position={[0, 2.12, 0]}>
        <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={CASE_SHADE} />
      </RoundedBox>

      {/* Stiker label di muka depan badan: "SG90 / Micro Servo" */}
      <mesh position={[0, 1.42, 1.812]}>
        <planeGeometry args={[2.3, 1.15]} />
        <meshStandardMaterial map={labelTexture} roughness={0.5} />
      </mesh>

      {/* Kuping pemasangan berlubang tembus di kedua ujung (extrude) */}
      <mesh geometry={flangeGeometry} position={[0, 2.275, 0]} castShadow>
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.absWarna}
          color={COLOR_TOKENS.servoCaseBlue}
          opacity={0.92}
          transparent
        />
      </mesh>

      {/* Tonjolan rumah gir bundar di sisi atas badan */}
      <mesh position={[0, 2.86, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 0.22, 28]} />
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.absWarna}
          color={COLOR_TOKENS.servoCaseBlue}
          opacity={0.92}
          transparent
        />
      </mesh>

      {/* Leher poros (shade gelap case) */}
      <mesh position={[0, 2.95, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.9, 0.35, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={CASE_SHADE} />
      </mesh>

      {/* Tanduk/lengan servo — berputar halus mengikuti sudut simulasi */}
      <group ref={hornRef} position={[0, 3.15, 0]} rotation={[0, hornRotationY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.35, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={HORN_WHITE} />
        </mesh>
        <RoundedBox args={[3.6, 0.22, 0.75]} radius={0.08} smoothness={4} position={[0, 0.22, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={HORN_WHITE} />
        </RoundedBox>
        {/* Ujung lengan berlubang khas tanduk servo */}
        <mesh position={[1.55, 0.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.karet} />
        </mesh>
        <mesh position={[-1.55, 0.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.karet} />
        </mesh>
        {/* Sekrup pengikat tanduk di tengah poros (kepala metal + slot) */}
        <mesh position={[0, 0.365, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.07, 16]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
        <mesh position={[0, 0.405, 0]} rotation={[0, 0.6, 0]}>
          <boxGeometry args={[0.17, 0.03, 0.04]} />
          <meshStandardMaterial color={COLOR_TOKENS.karetGelap} roughness={0.6} />
        </mesh>
      </group>

      {/* Badge sudut live dari branchCurrents.angle (nilai solver yang sama) */}
      <LiveBadge instance={instance} y={4.6} />
    </group>
  );
};
