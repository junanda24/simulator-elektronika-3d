import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const DOT_COUNT = 5;

/** Vektor temp bersama: getPointAt tanpa target mengalokasi Vector3 baru
 *  di setiap panggilan (5 titik × tiap frame × tiap kabel). Dipakai ulang
 *  secara sinkron di dalam loop, aman dari satu-satunya thread render. */
const TMP_POINT = new THREE.Vector3();

/**
 * Titik-titik cahaya kuning yang mengalir di sepanjang kurva kabel,
 * mengikuti arah & besar beda potensial kedua ujungnya (Batch 6).
 *
 * deltaV = V(net a) − V(net b) dari snapshot MNA:
 * - deltaV positif → arus konvensional mengalir a → b.
 * - deltaV negatif → titik bergerak b → a (parameter kurva dibalik).
 * Kecepatan aliran ∝ min(|deltaV|, 5) volt. Tidak aktif (null) bila
 * simulasi berhenti atau |deltaV| < 0,05 V (kabel praktis tak berarus).
 */
export default function CurrentFlowDots({
  curve,
  deltaV,
  running,
}: {
  curve: THREE.CatmullRomCurve3;
  deltaV: number;
  running: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const offset = useRef(0);
  const active = running && Math.abs(deltaV) >= 0.05;

  useFrame((_, delta) => {
    if (!group.current) return;
    if (!active) {
      group.current.visible = false;
      return;
    }
    group.current.visible = true;
    const speed = 0.15 * Math.min(Math.abs(deltaV), 5);
    offset.current = (offset.current + delta * speed) % 1;
    const forward = deltaV >= 0;
    for (let i = 0; i < DOT_COUNT; i++) {
      const mesh = group.current.children[i];
      if (!mesh) continue;
      const frac = (offset.current + i / DOT_COUNT) % 1;
      const t = forward ? frac : (1 - frac) % 1;
      mesh.position.copy(curve.getPointAt(t, TMP_POINT));
    }
  });

  if (!active) return null;
  return (
    <group ref={group}>
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color="#FDE68A" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
