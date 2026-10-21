import { useEffect, useMemo, useRef } from 'react';
import type { ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import { updateBuzzerTone } from '../../../utils/soundFx';
import { MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3): badan = kelas plastikHitam (#1B1B1F,
 * bukan #000), kaki = kelas metalPin, cetakan sisi = helper label
 * resmi `stage3d/labelTexture.ts`. Frekuensi & pemicu bunyi
 * (soundFx.updateBuzzerTone) TIDAK berubah — gelombang visual murni.
 */

/** Frekuensi nada buzzer aktif (Hz) — bunyi "biiip" khas buzzer 5 V. */
const BUZZER_FREQ_HZ = 2400;

/** Tinggi permukaan atas badan (pusat 2,82 + setengah tinggi 3,74/2). */
const TOP_Y = 4.69;

/**
 * Tekstur cetakan melingkari sisi badan: "+" besar tepat di atas kaki
 * PLUS (sisi −Z; pada UV silinder three.js arah −Z jatuh di u = 0,5)
 * dan teks "5V BUZZER" tercetak putih di dua sisi — meniru cetakan
 * housing buzzer aktif asli (moodboard B18: cetakan teks di sisi).
 * Latar transparan agar warna badan plastikHitam tetap terlihat.
 */
function createBuzzerSidePrint(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#f2f2f2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 150px Arial, Helvetica, sans-serif';
      ctx.fillText('+', width * 0.5, height / 2);
      ctx.font = '700 82px Arial, Helvetica, sans-serif';
      ctx.fillText('5V BUZZER', width * 0.18, height / 2);
      ctx.fillText('5V BUZZER', width * 0.82, height / 2);
    },
    { width: 1024, height: 256 },
  );
}

/**
 * Buzzer aktif prosedural (SPESIFIKASI-GAYA-3D §5 Gelombang 2; riset
 * Part A: Ø12 × 9,5 mm): silinder hitam matte SEDIKIT TIRUS
 * (atas Ø11,3 / bawah Ø12 mm) kelas plastikHitam, lubang suara berupa
 * CEKUNGAN nyata di muka atas (bibir torus + dasar masuk ke dalam,
 * bukan cakram tempel), tanda "+" timbul TIPIS tercetak di atas dekat
 * sisi PLUS, dan pita cetakan sisi via helper label. Perilaku bunyi
 * tidak berubah: oscillator Web Audio lewat soundFx.updateBuzzerTone
 * saat arus 'main' > 5 mA, dua cincin gelombang suara membesar &
 * memudar bergantian, dan badan berpendar amber halus saat berbunyi.
 */
export const BuzzerRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const current = Math.abs(instance.simState.branchCurrents['main'] ?? 0);
  const sounding = current > 0.005;
  const aktif = (instance.simState.branchCurrents['main'] ?? 0) > 0.005;

  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);

  const sidePrint = useMemo(createBuzzerSidePrint, []);
  useEffect(() => () => sidePrint.dispose(), [sidePrint]);

  // Nada buzzer mengikuti status aktif; matikan juga saat unmount.
  useEffect(() => {
    updateBuzzerTone(BUZZER_FREQ_HZ, aktif);
  }, [aktif]);
  useEffect(
    () => () => {
      updateBuzzerTone(BUZZER_FREQ_HZ, false);
    },
    [],
  );

  // Cincin gelombang suara: skala 1→2,2 dan opacity 0,5→0 berulang,
  // dua cincin berbeda fase setengah siklus.
  useFrame((state) => {
    if (!aktif) return;
    const t = state.clock.elapsedTime;
    const animateRing = (mesh: THREE.Mesh | null, phase: number) => {
      if (!mesh) return;
      const scale = 1 + phase * 1.2;
      mesh.scale.set(scale, scale, scale);
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.5 * (1 - phase);
    };
    animateRing(ringARef.current, (t * 0.9) % 1);
    animateRing(ringBRef.current, (t * 0.9 + 0.5) % 1);
  });

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki PLUS — lebih panjang, sisi lokal -Z (jangkar pin tetap) */}
      <mesh position={[0, 0.3, -1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.4, 14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Kaki MINUS — lebih pendek, sisi lokal +Z */}
      <mesh position={[0, 0.05, 1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2, 14]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Badan silinder hitam sedikit tirus Ø12 × 9,5 mm */}
      <mesh position={[0, 2.82, 0]} castShadow>
        <cylinderGeometry args={[2.24, 2.38, 3.74, 32]} />
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.plastikHitam}
          emissive="#f59e0b"
          emissiveIntensity={sounding ? 0.18 : 0}
        />
      </mesh>

      {/* Pita cetakan sisi (helper label): "+" di atas kaki PLUS +
          teks "5V BUZZER", tercetak putih melingkari badan */}
      <mesh position={[0, 2.7, 0]}>
        <cylinderGeometry args={[2.4, 2.42, 1.5, 32, 1, true]} />
        <meshStandardMaterial
          map={sidePrint}
          transparent
          roughness={0.5}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Lubang suara: CEKUNGAN nyata di muka atas — bibir torus
          membulat + dasar lubang masuk di bawah permukaan atas */}
      <mesh position={[0, TOP_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56, 0.07, 10, 28]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      <mesh position={[0, TOP_Y - 0.07, 0]}>
        <cylinderGeometry args={[0.58, 0.5, 0.14, 24]} />
        <meshStandardMaterial color="#000000" roughness={0.95} />
      </mesh>

      {/* Tanda + timbul TIPIS tercetak di atas, dekat sisi PLUS
          (pengganti dua balok putih tebal model lama) */}
      <group position={[1.32, TOP_Y + 0.015, -1.32]}>
        <mesh>
          <boxGeometry args={[0.66, 0.05, 0.18]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.18, 0.05, 0.66]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      </group>

      {/* Cincin gelombang suara — hanya saat buzzer berbunyi */}
      {aktif && (
        <>
          <mesh ref={ringARef} position={[0, 4.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 1.0, 40]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <mesh ref={ringBRef} position={[0, 4.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 1.0, 40]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </>
      )}

      {/* Badge arus cabang utama live saat buzzer berbunyi */}
      <LiveBadge instance={instance} y={5.9} />
    </group>
  );
};
