import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { MeshPhysicalMaterial } from 'three';
import type { ComponentRenderProps } from '../../../types';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3): kaki & ring = kelas metalPin,
 * PCB = kelas pcb, plastik warna = kelas absWarna, chip & kapasitor
 * = kelas plastikHitam. Konstanta di bawah hanya WARNA benda asli.
 */
const PCB_GREEN = '#1ca64e';
const DOME_WHITE = '#f4f1ea';
const TRIMMER_ORANGE = '#f07d1a';

/** Posisi kaki sesuai pin elektrik: VCC (-1), OUT (0), GND (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/**
 * Profil lathe kubah Fresnel: anak tangga konsentris (tread datar +
 * riser tegak bergantian) dari bibir bawah ke puncak — faset cincin
 * adalah identitas lensa HC-SR501. Urutan dari bawah ke atas.
 */
const FRESNEL_PROFILE: Array<[number, number]> = [
  [1.22, 0.0],
  [1.22, 0.23],
  [1.14, 0.24],
  [1.14, 0.42],
  [1.04, 0.43],
  [1.04, 0.59],
  [0.92, 0.6],
  [0.92, 0.74],
  [0.79, 0.75],
  [0.79, 0.87],
  [0.64, 0.88],
  [0.64, 0.98],
  [0.47, 0.99],
  [0.47, 1.07],
  [0.3, 1.08],
  [0.3, 1.15],
  [0.001, 1.16],
];

/**
 * Silkscreen putih PCB PIR: judul modul, legenda pin di tepi depan,
 * cincin lubang kaki, dan jejak samar menuju tepi board.
 * Bidang plane 3,2 × 3,6 unit → kanvas 896 × 1024 (§2.5).
 * Pemetaan: x kanvas = sumbu x dunia, y kanvas = sumbu z dunia
 * (plane dirotasi -90° pada X, sisi atas kanvas menghadap -z).
 */
function createPirSilkscreen(): THREE.CanvasTexture {
  return createLabelTexture((ctx) => {
    const toPx = (lx: number, lz: number): [number, number] => [
      (lx / 3.2 + 0.5) * 896,
      (lz / 3.6 + 0.5) * 1024,
    ];

    // Jejak samar dari kolom kaki menuju tepi board.
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    LEG_Z.forEach((z) => {
      const [sx, sy] = toPx(0, z);
      const [ex, ey] = toPx(1.45, z * 0.4);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });
    // Cincin di sekeliling lubang kaki header.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    LEG_Z.forEach((z) => {
      const [cx, cy] = toPx(0, z);
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';

    // Judul modul di tepi belakang.
    ctx.font = '700 52px "JetBrains Mono", monospace';
    const [tx, ty] = toPx(0, -1.56);
    ctx.fillText('HC-SR501', tx, ty);

    // Legenda pin di tepi depan (kolom kaki tertutup rangka lensa).
    ctx.font = '600 30px "JetBrains Mono", monospace';
    const [lx, ly] = toPx(0.1, 1.7);
    ctx.fillText('VCC OUT GND', lx, ly);
  }, { width: 896, height: 1024 });
}

/** Satu trimpot penyesuai oranye khas HC-SR501: ring metal, badan oranye, slot putar. */
const TrimmerPot = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <mesh position={[0, 0.03, 0]}>
      <cylinderGeometry args={[0.33, 0.33, 0.06, 24]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
    </mesh>
    <mesh position={[0, 0.16, 0]} castShadow>
      <cylinderGeometry args={[0.28, 0.28, 0.2, 24]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={TRIMMER_ORANGE} />
    </mesh>
    {/* Slot sekrup penyesuai di muka atas */}
    <mesh position={[0, 0.27, 0]} rotation={[0, 0.6, 0]}>
      <boxGeometry args={[0.32, 0.03, 0.07]} />
      <meshStandardMaterial color="#7c2d12" roughness={0.6} />
    </mesh>
  </group>
);

/**
 * Sensor PIR HC-SR501 prosedural: PCB hijau bersilkscreen, kubah lensa
 * Fresnel berfaset konsentris di atas rangka persegi-membulat, dua
 * trimpot oranye, IC BISS0001, kapasitor, lubang pemasangan, dan LED
 * indikator merah. Klik kubah untuk menghidupkan/mematikan simulasi
 * gerakan; kubah berdenyut merah muda saat gerakan terdeteksi.
 */
export const PirRender3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const motion = instance.interactiveState.motion === true;

  const domeGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        FRESNEL_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)),
        48,
      ),
    [],
  );
  useEffect(() => () => domeGeometry.dispose(), [domeGeometry]);

  const silkscreen = useMemo(createPirSilkscreen, []);

  // Denyut kubah saat gerakan terdeteksi: emissive berosilasi halus.
  const domeMatRef = useRef<MeshPhysicalMaterial>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useFrame(({ clock }) => {
    const mat = domeMatRef.current;
    if (!mat) return;
    mat.emissiveIntensity = motionRef.current
      ? 1.0 + 0.6 * Math.sin(clock.elapsedTime * 6)
      : 0;
  });

  const handleDomePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onInteract({ motion: !motion });
  };

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki metalik menuju pin elektrik (jangkar pin tidak berubah) */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* PCB modul hijau membulat */}
      <RoundedBox args={[3.2, 0.3, 3.6]} radius={0.1} smoothness={4} position={[0, 0.78, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={PCB_GREEN} />
      </RoundedBox>
      {/* Silkscreen di muka atas PCB */}
      <mesh position={[0, 0.935, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 3.6]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} />
      </mesh>

      {/* Lubang pemasangan di kedua sisi tengah PCB */}
      {[-1.45, 1.45].map((x) => (
        <mesh key={`hole-${x}`} position={[x, 0.79, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.32, 20]} />
          <meshStandardMaterial color="#0e2a1a" roughness={0.9} />
        </mesh>
      ))}

      {/* Rangka lensa persegi-membulat */}
      <RoundedBox args={[2.5, 0.18, 2.5]} radius={0.08} smoothness={4} position={[0, 1.02, -0.15]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={DOME_WHITE} />
      </RoundedBox>

      {/* Kubah lensa Fresnel berfaset konsentris — klik untuk toggle gerakan;
          berpendar merah muda berdenyut saat gerakan terdeteksi */}
      <mesh
        geometry={domeGeometry}
        position={[0, 1.08, -0.15]}
        castShadow
        onPointerDown={handleDomePointerDown}
      >
        <meshPhysicalMaterial
          ref={domeMatRef}
          {...MATERIAL_PROPS.absWarna}
          color={DOME_WHITE}
          roughness={0.32}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          flatShading
          emissive="#ff8fab"
          emissiveIntensity={0}
        />
      </mesh>

      {/* Dua trimpot penyesuai oranye di sisi depan rangka lensa */}
      <TrimmerPot position={[-1.05, 0.93, 1.48]} />
      <TrimmerPot position={[1.05, 0.93, 1.48]} />

      {/* IC pengolah BISS0001 di tepi belakang */}
      <RoundedBox args={[0.8, 0.16, 0.34]} radius={0.05} smoothness={4} position={[0.95, 1.01, -1.58]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </RoundedBox>

      {/* Kapasitor elektrolit kecil di tepi belakang */}
      <group position={[-0.95, 0.93, -1.58]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.5, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={COLOR_TOKENS.karetGelap} />
        </mesh>
        <mesh position={[0, 0.51, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.03, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      </group>

      {/* LED indikator merah — menyala saat gerakan terdeteksi */}
      <group position={[-0.5, 0.93, 1.42]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.17, 0.18, 0.1, 16]} />
          <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.15, 16, 12]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={motion ? 3.6 : 0.05}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
};
