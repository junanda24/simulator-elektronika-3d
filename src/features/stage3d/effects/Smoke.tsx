import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Efek kepulan asap untuk komponen yang rusak.
 * Partikel naik dari atas komponen, menyebar seiring tinggi, lalu loop.
 * Posisi dimutasi langsung pada BufferAttribute — tanpa re-render React.
 */

const PARTICLE_COUNT = 26;
/** Tinggi pangkal asap di atas titik asal komponen. */
const BASE_LIFT = 1.2;
/** Jarak naik maksimum sebelum partikel reset ke bawah. */
const RISE_SPAN = 3.2;
/** Radius sebaran di dasar dan di puncak kepulan. */
const RADIUS_MIN = 0.12;
const RADIUS_MAX = 1.0;

interface ParticleSeed {
  /** Kemajuan awal siklus naik (0–1), acak tapi stabil antar-render. */
  phase: number;
  /** Kecepatan naik dalam unit/detik (0.8–1.6). */
  speed: number;
  /** Sudut dasar sebaran di bidang x/z. */
  angle: number;
  /** Amplitudo & frekuensi goyangan sinus saat naik. */
  swayAmp: number;
  swayFreq: number;
}

/** RNG sederhana agar fase partikel stabil (tidak berubah tiap render). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Smoke({ position }: { position: [number, number, number] }) {
  const seeds = useMemo<ParticleSeed[]>(() => {
    const rand = mulberry32(20261021);
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      phase: rand(),
      speed: 0.8 + rand() * 0.8,
      angle: rand() * Math.PI * 2,
      swayAmp: 0.1 + rand() * 0.25,
      swayFreq: 0.8 + rand() * 1.4,
    }));
  }, []);

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);

  const geometryRef = useRef<THREE.BufferGeometry>(geometry);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const seed = seeds[i];
      // Kemajuan siklus 0–1: kecepatan (unit/detik) dibagi rentang naik.
      const progress = (seed.phase + (t * seed.speed) / RISE_SPAN) % 1;
      const height = progress * RISE_SPAN;
      // Sebaran melebar sebanding tinggi kepulan.
      const radius = RADIUS_MIN + progress * (RADIUS_MAX - RADIUS_MIN);
      const sway = Math.sin(t * seed.swayFreq + seed.phase * Math.PI * 2) * seed.swayAmp * progress;
      const idx = i * 3;
      positions[idx] = Math.cos(seed.angle) * radius + sway;
      positions[idx + 1] = BASE_LIFT + height;
      positions[idx + 2] = Math.sin(seed.angle) * radius + Math.cos(t * seed.swayFreq * 0.7 + seed.phase * 6.28) * seed.swayAmp * progress * 0.6;
    }
    const attr = geometryRef.current.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  return (
    <points geometry={geometry} position={position} frustumCulled={false}>
      <pointsMaterial
        color="#9aa0a8"
        size={1.6}
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}

export default Smoke;
