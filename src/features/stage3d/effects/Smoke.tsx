import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { playBurnPop } from '../../../shared/utils/soundFx';

/**
 * Efek kerusakan berlapis untuk komponen yang rusak:
 * 1. Bunyi letupan (playBurnPop) tepat satu kali saat mount.
 * 2. Percikan api kuning — 12 partikel terlontar acak, jatuh oleh
 *    gravitasi, hilang setelah 0,4 detik.
 * 3. Kilatan cahaya oranye — pointLight meredup eksponensial ±0,25 detik.
 * 4. Getaran kamera singkat (250 ms, amplitudo ±0,12) yang batal sendiri
 *    bila kamera digerakkan pihak lain (user / CameraRig).
 * 5. Kepulan asap abu yang naik terus (perilaku asli, dipertahankan).
 * 6. Bara pijar pada badan komponen: denyut cahaya aditif ±1,5 detik di
 *    jantung komponen tepat saat kerusakan terjadi (gelombang animasi —
 *    melengkapi kilatan yang menerangi SEKITAR komponen).
 * Posisi partikel dimutasi langsung pada BufferAttribute — tanpa re-render.
 */

const PARTICLE_COUNT = 26;
/** Tinggi pangkal asap di atas titik asal komponen. */
const BASE_LIFT = 1.2;
/** Jarak naik maksimum sebelum partikel reset ke bawah. */
const RISE_SPAN = 3.2;
/** Radius sebaran di dasar dan di puncak kepulan. */
const RADIUS_MIN = 0.12;
const RADIUS_MAX = 1.0;

/** Jumlah partikel percikan api saat ledakan. */
const SPARK_COUNT = 12;
/** Umur percikan dalam detik; setelah itu points disembunyikan. */
const SPARK_LIFE = 0.4;
/** Gravitasi percikan (diperlambat setengah agar terasa melayang). */
const SPARK_GRAVITY = -9.8 * 0.5;
/** Tinggi pangkal percikan dari titik asal komponen. */
const SPARK_LIFT = 0.9;

/** Durasi kilatan & getaran kamera dalam detik. */
const FLASH_DURATION = 0.25;
const SHAKE_DURATION = 0.25;
/** Amplitudo maksimum getaran kamera per sumbu. */
const SHAKE_AMPLITUDE = 0.12;
/** Batas gerak kamera dari posisi tangkapan sebelum shake dibatalkan. */
const SHAKE_CANCEL_DISTANCE = 1;

/**
 * Preferensi gerak dikurangi dari OS (prefers-reduced-motion): getaran
 * kamera DIMATIKAN (SINTESIS-FINAL §J) — lapisan asap, percikan, dan
 * kilatan tidak terpengaruh. Dievaluasi sekali saat modul dimuat.
 */
const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  // Bunyi letupan tepat satu kali saat efek kerusakan muncul.
  useEffect(() => {
    playBurnPop();
  }, []);

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

  // --- Percikan api -------------------------------------------------------
  const sparkPositions = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const sparkVelocities = useMemo(() => {
    const rand = mulberry32(977351);
    const vel = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i += 1) {
      // Arah acak di bola, dibiaskan ke atas agar percikan terlontar naik.
      const angle = rand() * Math.PI * 2;
      const horizontal = 0.6 + rand() * 1.8;
      vel[i * 3] = Math.cos(angle) * horizontal;
      vel[i * 3 + 1] = 1.5 + rand() * 2.0;
      vel[i * 3 + 2] = Math.sin(angle) * horizontal;
    }
    return vel;
  }, []);

  const sparkGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    return geo;
  }, [sparkPositions]);

  const sparkPointsRef = useRef<THREE.Points>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const emberRef = useRef<THREE.Mesh>(null);

  /** Waktu clock saat efek pertama kali dirender (acuan semua lapisan). */
  const startTimeRef = useRef<number | null>(null);
  /** State getaran kamera: posisi tangkapan + offset frame sebelumnya.
   * Dianggap selesai sejak awal bila prefers-reduced-motion aktif, agar
   * blok getaran di useFrame tidak pernah berjalan. */
  const shakeRef = useRef({
    captured: new THREE.Vector3(),
    prevOffset: new THREE.Vector3(),
    done: REDUCED_MOTION,
  });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (startTimeRef.current === null) {
      startTimeRef.current = t;
      shakeRef.current.captured.copy(state.camera.position);
    }
    const age = t - startTimeRef.current;

    // --- Kepulan asap (perilaku asli) ---
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

    // --- Percikan api: integrasi kecepatan + gravitasi selama 0,4 detik ---
    const sparks = sparkPointsRef.current;
    if (sparks) {
      if (age <= SPARK_LIFE) {
        const dt = Math.min(delta, 0.05);
        for (let i = 0; i < SPARK_COUNT; i += 1) {
          const idx = i * 3;
          sparkVelocities[idx + 1] += SPARK_GRAVITY * dt;
          sparkPositions[idx] += sparkVelocities[idx] * dt;
          sparkPositions[idx + 1] += sparkVelocities[idx + 1] * dt;
          sparkPositions[idx + 2] += sparkVelocities[idx + 2] * dt;
        }
        const sparkAttr = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
        sparkAttr.needsUpdate = true;
      } else if (sparks.visible) {
        sparks.visible = false;
      }
    }

    // --- Kilatan cahaya: 8 → 0 eksponensial dalam ±0,25 detik ---
    if (flashRef.current) {
      flashRef.current.intensity =
        age <= FLASH_DURATION + 0.1 ? 8 * Math.exp(-14 * age) : 0;
    }

    // --- Bara pijar PADA badan komponen (pelengkap kilatan, bukan
    // duplikat): bola pijar aditif di jantung komponen yang menyala
    // terang lalu berdenyut meredup selama ±1,5 detik — komponen yang
    // baru terbakar terlihat "panas" sesaat, sesudahnya kepulan asap
    // yang menjadi petunjuk permanen. Amplop linear + kedip sinus
    // cepat; skala & opacity dimutasi langsung, tanpa alokasi. Lapisan
    // cahaya murni (bukan perpindahan), jadi — sama seperti percikan &
    // kilatan di file ini — tidak digerbang reduced-motion; yang
    // digerbang di sini hanya getaran kamera. ---
    const ember = emberRef.current;
    if (ember) {
      const EMBER_LIFE = 1.5;
      if (age <= EMBER_LIFE) {
        const envelope = 1 - age / EMBER_LIFE;
        const flicker = 0.7 + 0.3 * Math.sin(age * 26);
        const s = Math.max(0.001, 0.6 * envelope * flicker);
        ember.visible = true;
        ember.scale.set(s, s, s);
        (ember.material as THREE.MeshBasicMaterial).opacity = 0.85 * envelope;
      } else if (ember.visible) {
        ember.visible = false;
      }
    }

    // --- Getaran kamera: offset acak kecil selama 250 ms ---
    const shake = shakeRef.current;
    if (!shake.done) {
      const cam = state.camera;
      // Posisi dasar = posisi sekarang tanpa offset yang kita pasang sendiri.
      const baseX = cam.position.x - shake.prevOffset.x;
      const baseY = cam.position.y - shake.prevOffset.y;
      const baseZ = cam.position.z - shake.prevOffset.z;
      const moved = Math.hypot(
        baseX - shake.captured.x,
        baseY - shake.captured.y,
        baseZ - shake.captured.z,
      );
      if (age > SHAKE_DURATION || moved > SHAKE_CANCEL_DISTANCE) {
        // Selesai / dibatalkan: kembalikan kamera persis ke posisi dasar.
        cam.position.set(baseX, baseY, baseZ);
        shake.prevOffset.set(0, 0, 0);
        shake.done = true;
      } else {
        const decay = 1 - age / SHAKE_DURATION;
        const offX = (Math.random() * 2 - 1) * SHAKE_AMPLITUDE * decay;
        const offY = (Math.random() * 2 - 1) * SHAKE_AMPLITUDE * decay;
        const offZ = (Math.random() * 2 - 1) * SHAKE_AMPLITUDE * decay;
        cam.position.set(baseX + offX, baseY + offY, baseZ + offZ);
        shake.prevOffset.set(offX, offY, offZ);
      }
    }
  });

  return (
    <>
      {/* Kepulan asap abu (asli) */}
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

      {/* Percikan api kuning-oranye sesaat */}
      <points
        ref={sparkPointsRef}
        geometry={sparkGeometry}
        position={[position[0], position[1] + SPARK_LIFT, position[2]]}
        frustumCulled={false}
      >
        <pointsMaterial
          color="#FACC15"
          size={0.55}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </points>

      {/* Kilatan ledakan */}
      <pointLight
        ref={flashRef}
        position={[position[0], position[1] + BASE_LIFT, position[2]]}
        color="#FF5500"
        intensity={0}
        distance={9}
        decay={2}
      />

      {/* Bara pijar sesaat di jantung komponen yang baru rusak */}
      <mesh
        ref={emberRef}
        position={[position[0], position[1] + 0.55, position[2]]}
        visible={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshBasicMaterial
          color="#FF7A1A"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

export default Smoke;
