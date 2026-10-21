import {
  memo,
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
 * 2. TERPILIH (target #4): cincin sorotan STATIS di pangkal komponen,
 *    berukuran mengikuti sebaran lubang kaki instance itu sendiri.
 *    (Versi awal memakai cincin bernapas + cincin sonar mengembang —
 *    keduanya DIBUANG atas perintah user arah SOLID 2026-10-21,
 *    "buang efek shimmering": cincin kini diam dan jelas.)
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
 * tampil di tempat; cincin terpilih memang sudah statis untuk semua
 * pengguna sejak arah SOLID, jadi tidak ada penurunan tier di sana.
 *
 * Performa (gsap-performance + 60fps): yang dianimasikan hanya
 * transform grup masuk (position/scale) — tidak ada alokasi per frame
 * (GSAP menulis ke Vector3 yang ada), tween masuk bersifat sementara
 * dan dibunuh saat unmount. Cincin terpilih tidak memakai ticker
 * sama sekali.
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
 * Cincin sorotan komponen terpilih: SATU cincin statis diam dengan
 * opacity tetap — tanpa napas, tanpa sonar, tanpa ticker (efek denyut
 * & cincin mengembang dibuang atas perintah user arah SOLID
 * 2026-10-21). Jari-jari dihitung SEKALI dari sebaran lubang kaki
 * instance (pinHoles store → posisi dunia lubang) agar cincin memeluk
 * footprint komponen yang sebenarnya, bukan lingkaran generik.
 */
function SelectionRing({ instanceId }: { instanceId: string }) {
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

  return (
    <mesh
      position={[0, 0.07, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={() => null}
    >
      <ringGeometry args={[radius - 0.14, radius, 48]} />
      <meshBasicMaterial
        color="#00E5FF"
        transparent
        opacity={0.55}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
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
        {selected && <SelectionRing instanceId={instance.id} />}
      </group>
    );
  });
  return Shell;
}
