import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentType,
} from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import type {
  ComponentInstanceState,
  ComponentRenderProps,
} from '../../../shared/types';
import { holeWorldPosition } from '../../../shared/boards/breadboard';
import { useCircuitStore } from '../../wiring/store/circuitStore';

/**
 * Shell gerak untuk SEMUA Render3D komponen (dipasang di registry):
 *
 * 1. MASUK (target animasi #1): instance yang benar-benar ada di store
 *    tampil dengan jatuh/settle lembut — grup dalam mulai +2,4 unit di
 *    atas posisi akhir & skala 0,9, lalu mendarat dengan back.out(1.35)
 *    (overshoot kecil, gaya "Playful" terkendali ala motion-design:
 *    entrance = decelerate + follow-through). Penempatan massal
 *    (demo/share/undo) masuk berjenjang: stagger mikro 45 ms per
 *    komponen dalam jendela batch yang sama, dibatasi 10 langkah
 *    (total rentang delay < 500 ms sesuai anggaran stagger).
 * 2. TERPILIH (target #4): cincin denyut halus di pangkal komponen —
 *    cincin tetap bernapas + cincin sonar mengembang — berukuran
 *    mengikuti sebaran lubang kaki instance itu sendiri.
 *
 * Cara kerja tanpa menyentuh kontrak model: grup LUAR shell membawa
 * position + rotation instance (persis yang dulu dilakukan grup akar
 * tiap model), grup DALAM yang dianimasikan GSAP menjadi pivot di titik
 * asal komponen, dan model menerima instance dengan position [0,0,0] &
 * rotation 0. Aman karena terverifikasi ke-20 model hanya membaca
 * position/rotation di grup akarnya sendiri (satu-satunya pembaca lain,
 * LiveBadge & gizmo, hidup DI DALAM pohon model dan ikut transformasi
 * shell). onInteract diteruskan apa adanya; Smoke dirender InstanceView
 * di luar Render sehingga tidak terpengaruh.
 *
 * Ghost penempatan & preview katalog BUKAN anggota store: shell
 * mendeteksinya lewat keanggotaan id di store saat render pertama dan
 * meneruskan Render polos persis seperti sebelum shell ini ada.
 *
 * Reduced motion (gerbang yang sama dengan CameraRig/Smoke —
 * matchMedia prefers-reduced-motion, dievaluasi per mount): animasi
 * masuk Tier-1 (perpindahan + skala) dihapus total, komponen langsung
 * tampil di tempat; cincin terpilih diturunkan ke Tier-2/3 — tetap
 * tampil statis sebagai petunjuk orientasi, tanpa denyut/sonar
 * (pola tiered accessible-animation: jangan membunuh petunjuk, bunuh
 * gerakannya).
 *
 * Performa (gsap-performance + 60fps): yang dianimasikan hanya
 * transform grup (position/scale) & opacity material cincin — tidak ada
 * alokasi per frame (GSAP menulis ke Vector3 yang ada; ticker cincin
 * memakai ulang objek material), tween masuk bersifat sementara dan
 * dibunuh saat unmount, ticker cincin hanya hidup selama komponen
 * terpilih.
 */

/** Ketinggian awal jatuh (unit) & skala awal animasi masuk. */
const DROP_HEIGHT = 2.4;
const START_SCALE = 0.9;
/** Durasi settle masuk (detik) — pita "card enter" motion-design. */
const ENTER_DURATION = 0.5;
/** Overshoot settle: back.out dengan faktor kecil (10–20% playful). */
const ENTER_EASE = 'back.out(1.35)';
/** Stagger mikro antar-komponen dalam satu batch penempatan. */
const STAGGER_STEP_S = 0.045;
const STAGGER_MAX_INDEX = 10;
/** Mount yang berdekatan dalam jendela ini dianggap satu batch. */
const BATCH_WINDOW_MS = 160;

/** Gerbang reduced-motion proyek — pola sama dengan CameraRig. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Keadaan batch penempatan massal (modul-level, diatur ulang per jendela). */
let batchStamp = Number.NEGATIVE_INFINITY;
let batchCount = 0;

function nextBatchDelay(): number {
  const now = performance.now();
  if (now - batchStamp > BATCH_WINDOW_MS) {
    batchStamp = now;
    batchCount = 0;
  }
  const index = batchCount;
  batchCount += 1;
  return Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_S;
}

/**
 * Cincin sorotan komponen terpilih: cincin tetap yang bernapas pelan
 * (ambient layer) + cincin sonar yang mengembang & memudar (primary
 * layer), mengikuti bahasa gerak proyek (sine ease-in-out untuk loop
 * ambient). Jari-jari dihitung SEKALI dari sebaran lubang kaki instance
 * (pinHoles store → posisi dunia lubang) agar cincin memeluk footprint
 * komponen yang sebenarnya, bukan lingkaran generik. Saat reduced
 * motion: hanya cincin tetap, opacity statis, tanpa ticker.
 */
function SelectionPulse({
  instanceId,
  reduced,
}: {
  instanceId: string;
  reduced: boolean;
}) {
  const steadyMat = useRef<THREE.MeshBasicMaterial>(null);
  const sonar = useRef<THREE.Mesh>(null);
  const sonarMat = useRef<THREE.MeshBasicMaterial>(null);

  const radius = useMemo(() => {
    const state = useCircuitStore.getState();
    const holes = state.pinHoles[instanceId];
    const origin = state.instances.find((i) => i.id === instanceId)?.position;
    if (!holes || !origin) return 1.6;
    let maxDist = 0;
    Object.values(holes).forEach((holeId) => {
      const pos = holeWorldPosition(holeId);
      if (!pos) return;
      const d = Math.hypot(pos[0] - origin[0], pos[2] - origin[2]);
      if (d > maxDist) maxDist = d;
    });
    return THREE.MathUtils.clamp(maxDist + 0.85, 1.3, 4.6);
  }, [instanceId]);

  useEffect(() => {
    if (reduced) return undefined;
    const tick = () => {
      const t = gsap.ticker.time;
      if (steadyMat.current) {
        steadyMat.current.opacity = 0.38 + 0.18 * Math.sin(t * 3);
      }
      if (sonar.current && sonarMat.current) {
        const phase = (t % 1.6) / 1.6;
        const s = radius * (0.72 + 0.5 * phase);
        sonar.current.scale.set(s, s, s);
        sonarMat.current.opacity = 0.38 * (1 - phase);
      }
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [reduced, radius]);

  return (
    <group>
      <mesh
        position={[0, 0.07, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[radius - 0.14, radius, 48]} />
        <meshBasicMaterial
          ref={steadyMat}
          color="#00E5FF"
          transparent
          opacity={reduced ? 0.55 : 0.45}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {!reduced && (
        <mesh
          ref={sonar}
          position={[0, 0.07, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[0.93, 1, 48]} />
          <meshBasicMaterial
            ref={sonarMat}
            color="#00E5FF"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Bungkus Render3D sebuah plugin dengan shell gerak. Identitas hasil
 * stabil per plugin (dipanggil sekali di registry saat modul dimuat).
 */
export function withInstanceMotion(
  Render: ComponentType<ComponentRenderProps>,
): ComponentType<ComponentRenderProps> {
  const Shell = memo(function InstanceMotionShell({
    instance,
    onInteract,
  }: ComponentRenderProps) {
    const animRef = useRef<THREE.Group>(null);
    // Keanggotaan store ditentukan SEKALI pada render pertama: instance
    // asli selalu sudah tercatat di store sebelum dirender CircuitScene,
    // sedangkan ghost/preview tidak pernah tercatat. Ref (bukan state)
    // agar tidak memicu render tambahan.
    const isRealRef = useRef<boolean | null>(null);
    if (isRealRef.current === null) {
      isRealRef.current = useCircuitStore
        .getState()
        .instances.some((i) => i.id === instance.id);
    }
    const reducedRef = useRef<boolean | null>(null);
    if (reducedRef.current === null) {
      reducedRef.current = prefersReducedMotion();
    }

    const selected = useCircuitStore(
      (s) => s.selectedInstanceId === instance.id,
    );

    // Instance untuk model: transform dipindah ke grup luar shell.
    const innerInstance = useMemo<ComponentInstanceState>(
      () => ({ ...instance, position: [0, 0, 0], rotation: 0 }),
      [instance],
    );

    useLayoutEffect(() => {
      if (!isRealRef.current) return undefined;
      const group = animRef.current;
      if (!group) return undefined;
      if (reducedRef.current) {
        // Tier-1 dihapus: langsung di tempat, tanpa perjalanan/skala.
        gsap.set(group.position, { y: 0 });
        gsap.set(group.scale, { x: 1, y: 1, z: 1 });
        return undefined;
      }
      const delay = nextBatchDelay();
      gsap.set(group.position, { y: DROP_HEIGHT });
      gsap.set(group.scale, { x: START_SCALE, y: START_SCALE, z: START_SCALE });
      const dropTween = gsap.to(group.position, {
        y: 0,
        duration: ENTER_DURATION,
        delay,
        ease: ENTER_EASE,
        overwrite: 'auto',
      });
      const scaleTween = gsap.to(group.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: ENTER_DURATION,
        delay,
        ease: ENTER_EASE,
        overwrite: 'auto',
      });
      return () => {
        dropTween.kill();
        scaleTween.kill();
      };
      // Mount saja: snapshot yang mengganti objek instance tidak boleh
      // memutar ulang animasi masuk.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isRealRef.current) {
      // Ghost penempatan / preview: render polos, persis perilaku lama.
      return <Render instance={instance} onInteract={onInteract} />;
    }

    return (
      <group position={instance.position} rotation={[0, instance.rotation, 0]}>
        <group ref={animRef}>
          <Render instance={innerInstance} onInteract={onInteract} />
        </group>
        {selected && (
          <SelectionPulse instanceId={instance.id} reduced={reducedRef.current} />
        )}
      </group>
    );
  });
  return Shell;
}
