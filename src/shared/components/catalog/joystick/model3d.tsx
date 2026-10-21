import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { alphaXOf, alphaYOf, pressedOf } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';

/** Posisi kaki sesuai pin elektrik: VCC (-2), GND (-1), VRX (0), VRY (+1), SW (+2). */
const LEG_Z = [-2, -1, 0, 1, 2] as const;
const LEG_LABELS = ['VCC', 'GND', 'VRX', 'VRY', 'SW'] as const;

/** Jarak seret (px) untuk rentang sumbu penuh 0 → 1. */
const DRAG_PIXELS_FULL_RANGE = 100;
/** Kemiringan tuas maksimum (rad) pada sumbu ekstrem — ±20°. */
const MAX_TILT_RAD = (20 * Math.PI) / 180;

/**
 * Silkscreen PCB KY-023 digambar prosedural (§2.5): label pin
 * VCC/GND/VRX/VRY/SW di tepi kiri sejajar deret pin, cincin lubang pin,
 * cincin lubang pemasangan sudut, jejak samar, dan judul modul
 * "KY-023" di sudut belakang. Bidang 3,6 × 5,6 unit → kanvas
 * 512 × 768; sisi atas kanvas menghadap -z.
 */
function createJoystickSilkscreen(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      const toPx = (lx: number, lz: number): [number, number] => [
        (lx / 3.6 + 0.5) * width,
        (lz / 5.6 + 0.5) * height,
      ];

      // Jejak tembaga samar dari deret pin menuju kotak mekanisme.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      LEG_Z.forEach((z) => {
        const [sx, sy] = toPx(0, z);
        const [ex, ey] = toPx(0.9, z * 0.45);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });

      // Cincin + lubang pin di deret tengah.
      LEG_Z.forEach((z) => {
        const [cx, cy] = toPx(0, z);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#0a0a0c';
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      });

      // Label pin di tepi kiri, sejajar tiap pin (di luar kotak mekanisme).
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '600 38px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      LEG_Z.forEach((z, i) => {
        const [lx, ly] = toPx(-1.68, z);
        ctx.fillText(LEG_LABELS[i], lx, ly);
      });

      // Judul modul di sudut belakang kanan (bebas dari mekanisme).
      const [tx, ty] = toPx(1.05, -2.42);
      ctx.textAlign = 'center';
      ctx.font = '700 52px Arial, sans-serif';
      ctx.fillText('KY-023', tx, ty);
      const [sx2, sy2] = toPx(1.05, -2.02);
      ctx.font = '600 27px Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('JOYSTICK', sx2, sy2);

      // Cincin lubang pemasangan di empat sudut PCB.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ([[1.45, 2.45], [-1.45, 2.45], [1.45, -2.45], [-1.45, -2.45]] as const).forEach(
        ([lx, lz]) => {
          const [cx, cy] = toPx(lx, lz);
          ctx.beginPath();
          ctx.arc(cx, cy, 25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#0a0a0c';
          ctx.beginPath();
          ctx.arc(cx, cy, 15, 0, Math.PI * 2);
          ctx.fill();
        },
      );
    },
    { width: 512, height: 768 },
  );
}

/**
 * Topi ibu jari joystick: lathe dengan bibir lebar dan cekungan
 * (dish) di puncak — siluet analog stick asli, BUKAN bola lollipop.
 * Profil (jari-jari, tinggi) dari dasar ke puncak; titik terakhir di
 * sumbu membentuk dasar cekungan.
 */
const THUMB_CAP_GEOMETRY = (() => {
  const profile: Array<[number, number]> = [
    [0.001, 0],
    [0.45, 0],
    [0.68, 0.04],
    [0.8, 0.12],
    [0.86, 0.26],
    [0.85, 0.38],
    [0.78, 0.46],
    [0.6, 0.42],
    [0.38, 0.35],
    [0.15, 0.31],
    [0.001, 0.3],
  ];
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(points, 32);
})();

/**
 * Boot karet berlipat di pangkal stik: lathe profil bergelombang
 * (lipatan bellows) yang menutup celah antara stik dan rumah
 * mekanisme, seperti dust boot analog stick asli.
 */
const BOOT_GEOMETRY = (() => {
  const profile: Array<[number, number]> = [
    [0.6, 0],
    [0.62, 0.05],
    [0.46, 0.14],
    [0.6, 0.24],
    [0.46, 0.33],
    [0.56, 0.42],
    [0.4, 0.5],
    [0.33, 0.55],
  ];
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(points, 28);
})();

/**
 * Joystick analog KY-023 prosedural (Gelombang 2 gaya 3D): PCB hitam
 * membulat bersilkscreen penuh (label pin + judul modul + lubang
 * sudut), rumah mekanisme logam dengan dua badan potensiometer sumbu
 * di sisi +x/+z, boot karet berlipat, dan topi ibu jari cekung yang
 * miring mengikuti alphaX/alphaY (±20°). Seret tuas: gerak horizontal
 * mengubah alphaX, vertikal mengubah alphaY (ke atas = alphaY naik).
 * Shift+klik menekan/mengunci tombol SW (tuas turun saat tertekan).
 */
export const JoystickRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const alphaX = alphaXOf(instance);
  const alphaY = alphaYOf(instance);
  const pressed = pressedOf(instance);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);

  const silkscreen = useMemo(createJoystickSilkscreen, []);
  useEffect(() => () => silkscreen.dispose(), [silkscreen]);

  // Cermin state terbaru ke ref agar useFrame pegas tidak membaca
  // closure basi: status drag, posisi sumbu, dan callback interact.
  const draggingRef = useRef(false);
  const alphaRef = useRef({ x: alphaX, y: alphaY });
  alphaRef.current = { x: alphaX, y: alphaY };
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;
  const springClockRef = useRef(0);

  // Tuas miring: alphaX menggerakkan rotasi Z, alphaY rotasi X.
  const tiltZ = -(alphaX - 0.5) * 2 * MAX_TILT_RAD;
  const tiltX = (alphaY - 0.5) * 2 * MAX_TILT_RAD;

  // Pegas kembali: saat tidak di-drag, sumbu meluncur balik ke tengah
  // (0.5, 0.5) seperti analog stick asli. onInteract dibatasi paling
  // sering tiap ±33 ms agar solver tidak dibanjiri.
  useFrame((_state, delta) => {
    if (draggingRef.current) return;
    const { x, y } = alphaRef.current;
    if (Math.abs(x - 0.5) <= 0.01 && Math.abs(y - 0.5) <= 0.01) return;
    springClockRef.current += delta;
    if (springClockRef.current < 0.033) return;
    const dt = springClockRef.current;
    springClockRef.current = 0;
    const k = Math.min(1, dt * 12);
    onInteractRef.current({
      alphaX: x + (0.5 - x) * k,
      alphaY: y + (0.5 - y) * k,
    });
  });

  const handleStickPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.shiftKey) {
      onInteract({ pressed: !pressed });
      return;
    }
    draggingRef.current = true;
    springClockRef.current = 0;
    setDragging3D?.(true);
    let accX = alphaX;
    let accY = alphaY;
    // Commit drag ter-throttle ±33 ms — kaden yang sama dengan pegas di
    // atas (sebelumnya hanya pegas yang dibatasi; drag-nya sendiri
    // menulis per pointermove). Nilai akhir di-flush saat lepas
    // (audit flicker 2026-10-21; pola gizmos/throttledCommit).
    const commit = createThrottledCaller<[Record<string, unknown>]>(
      (patch) => onInteract(patch),
      INTERACT_COMMIT_INTERVAL_MS,
    );
    const onMove = (ev: PointerEvent) => {
      accX = Math.min(1, Math.max(0, accX + ev.movementX / DRAG_PIXELS_FULL_RANGE));
      accY = Math.min(1, Math.max(0, accY - ev.movementY / DRAG_PIXELS_FULL_RANGE));
      commit.call({ alphaX: accX, alphaY: accY });
    };
    const onUp = () => {
      commit.flush();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      draggingRef.current = false;
      setDragging3D?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Lima kaki pin persegi metalik menuju pin elektrik */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <boxGeometry args={[0.16, 0.9, 0.16]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* PCB modul hitam membulat */}
      <RoundedBox args={[3.6, 0.3, 5.6]} radius={0.08} smoothness={4} position={[0, 0.62, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={COLOR_TOKENS.plastikHitam} />
      </RoundedBox>
      {/* Silkscreen penuh di muka atas PCB */}
      <mesh position={[0, 0.772, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 5.6]} />
        <meshStandardMaterial
          map={silkscreen}
          transparent
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Rumah mekanisme logam persegi */}
      <RoundedBox args={[2.4, 0.7, 2.4]} radius={0.08} smoothness={4} position={[0, 1.12, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
      </RoundedBox>
      {/* Empat sekrup kecil di sudut atas rumah mekanisme */}
      {([[0.95, 0.95], [0.95, -0.95], [-0.95, 0.95], [-0.95, -0.95]] as const).map(([x, z]) => (
        <mesh key={`screw-${x}-${z}`} position={[x, 1.485, z]}>
          <cylinderGeometry args={[0.09, 0.09, 0.04, 12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}
      {/* Cakram bukaan stik di puncak rumah */}
      <mesh position={[0, 1.48, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.05, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>

      {/* Badan potensiometer sumbu X di sisi +x rumah */}
      <mesh position={[1.3, 1.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.28, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      <mesh position={[1.32, 1.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 16]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Badan potensiometer sumbu Y di sisi +z rumah */}
      <mesh position={[0, 1.12, 1.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.28, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      <mesh position={[0, 1.12, 1.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 16]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Tuas miring mengikuti alphaX/alphaY; turun saat tombol tertekan */}
      <group position={[0, pressed ? 1.3 : 1.5, 0]} rotation={[tiltX, 0, tiltZ]}>
        {/* Boot karet berlipat di pangkal stik */}
        <mesh geometry={BOOT_GEOMETRY} dispose={null} position={[0, -0.02, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.karet} side={THREE.DoubleSide} />
        </mesh>
        {/* Batang stik metalik */}
        <mesh position={[0, 0.85, 0]} castShadow onPointerDown={handleStickPointerDown}>
          <cylinderGeometry args={[0.2, 0.27, 1.7, 16]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
        {/* Topi ibu jari cekung (lathe) — bukan bola */}
        <mesh
          geometry={THUMB_CAP_GEOMETRY}
          dispose={null}
          position={[0, 1.5, 0]}
          castShadow
          onPointerDown={handleStickPointerDown}
        >
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.karet}
            emissive="#00e5ff"
            emissiveIntensity={pressed ? 0.35 : 0.03}
          />
        </mesh>
      </group>
    </group>
  );
};
