import { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import { updateBuzzerTone } from '../../../utils/soundFx';
import { LiveBadge } from '../../../../features/stage3d/LiveBadge';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Frekuensi nada buzzer aktif (Hz) — bunyi "biiip" khas buzzer 5 V. */
const BUZZER_FREQ_HZ = 2400;

/**
 * Buzzer aktif prosedural: silinder hitam tegak dengan lubang suara di
 * atas dan tanda + di dekat kaki PLUS. Bagian atas berpendar halus saat
 * arus 'main' mengalir di atas 5 mA (buzzer sedang berbunyi).
 *
 * Saat berbunyi (arus main > 5 mA), oscillator Web Audio dinyalakan lewat
 * soundFx.updateBuzzerTone dan dua cincin gelombang suara membesar &
 * memudar bergantian di atas lubang suara.
 */
export const BuzzerRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const current = Math.abs(instance.simState.branchCurrents['main'] ?? 0);
  const sounding = current > 0.005;
  const aktif = (instance.simState.branchCurrents['main'] ?? 0) > 0.005;

  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);

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
      {/* Kaki PLUS — lebih panjang, sisi lokal -Z */}
      <mesh position={[0, 0.3, -1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.4, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Kaki MINUS — lebih pendek, sisi lokal +Z */}
      <mesh position={[0, 0, 1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.8, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>

      {/* Badan silinder hitam */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.15, 1.9, 24]} />
        <meshStandardMaterial
          color="#17181c"
          roughness={0.55}
          emissive="#f59e0b"
          emissiveIntensity={sounding ? 0.18 : 0}
        />
      </mesh>

      {/* Lubang suara di permukaan atas */}
      <mesh position={[0, 2.87, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 20]} />
        <meshStandardMaterial color="#000000" roughness={0.9} />
      </mesh>

      {/* Tanda + dari dua balok tipis di atas, dekat sisi PLUS */}
      <group position={[0.62, 2.86, -0.62]}>
        <mesh>
          <boxGeometry args={[0.5, 0.05, 0.14]} />
          <meshStandardMaterial color="#e8ecf1" roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.14, 0.05, 0.5]} />
          <meshStandardMaterial color="#e8ecf1" roughness={0.5} />
        </mesh>
      </group>

      {/* Cincin gelombang suara — hanya saat buzzer berbunyi */}
      {aktif && (
        <>
          <mesh ref={ringARef} position={[0, 3.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 1.0, 40]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <mesh ref={ringBRef} position={[0, 3.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 1.0, 40]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </>
      )}

      {/* Badge arus cabang utama live saat buzzer berbunyi */}
      <LiveBadge instance={instance} y={4.0} />
    </group>
  );
};
