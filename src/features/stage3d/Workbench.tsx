import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import Breadboard from './Breadboard';
import Smoke from './effects/Smoke';
import GenericBoard from './boards/GenericBoard';
import UnoBoard from '../../shared/boards/uno/UnoBoard';
import {
  boardPinAtLocal,
  getBoardDefinition,
} from '../../shared/boards/definitions';
import { getComponentPlugin } from '../../shared/components/registry';
import type { ComponentInstanceState } from '../../shared/types';
import {
  BREADBOARD_ORIGIN,
  holeAtLocal,
  parseHole,
} from '../../shared/boards/breadboard';

import { computeViewOffset } from '../../app/viewportInsets';
import { useUiSettings } from '../../app/uiSettings';
import { useCircuitStore } from '../wiring/store/circuitStore';
import { terminalWorldPosition } from '../wiring/terminals';
import type { TerminalRef } from '../wiring/netlist';
import { computePlacement, type PlacementRotation } from '../wiring/placement';
import WireMesh3D from '../wiring/components/WireMesh3D';
import DanglingWirePreview from '../wiring/components/DanglingWirePreview';
import GhostPlacementMesh from './effects/GhostPlacementMesh';

// Posisi "rumah" kamera: dibingkai ulang setelah board digeser mendekati
// breadboard (origin -42 → -21) — target kini di tengah bentang board↔
// breadboard (-6) dan kamera sedikit lebih rapat (40, 42, 52).
export const CAMERA_HOME = new THREE.Vector3(40, 42, 52);
export const TARGET_HOME = new THREE.Vector3(-6, 0, 0);

/**
 * Preferensi gerak dikurangi dari OS (prefers-reduced-motion): penerbangan
 * kamera menjadi instan, bukan meluncur (SINTESIS-FINAL §J). Dievaluasi
 * per perintah kamera agar perubahan preferensi di tengah sesi dihormati.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Kamera: reset manual + fokus autopsi + preset view (GSAP, STYLE_GUIDE §4.4).
 * Aturan easing (SINTESIS-FINAL §C): SEMUA gerakan kamera perintah-user
 * (reset/home, preset, fokus seleksi) memakai power2.inOut 600ms; fokus
 * autopsi adalah SATU-SATUNYA pengecualian — power3.out 600ms sesuai
 * STYLE_GUIDE §4 butir 4. Saat prefers-reduced-motion aktif, semua
 * penerbangan menjadi instan (durasi 0).
 */
function CameraRig({ resetSignal }: { resetSignal: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const focusNonce = useCircuitStore((s) => s.focusNonce);
  const focusPosition = useCircuitStore((s) => s.focusPosition);
  const cameraView = useCircuitStore((s) => s.cameraView);
  const turntableOn = useUiSettings((s) => s.turntable);
  const isDragging3D = useCircuitStore((s) => s.isDragging3D);
  const firstFocus = useRef(true);
  const firstView = useRef(true);

  // KEPEMILIKAN KAMERA TUNGGAL: begitu user menyentuh canvas (pointerdown /
  // wheel), semua tween GSAP pada kamera dibunuh seketika. Tanpa ini, tween
  // fokus/preset yang masih berjalan (ticker GSAP sendiri) terus menulis
  // camera.position BERSAMAAN dengan OrbitControls — kamera terasa keset /
  // patah-patah terutama tepat setelah drag dilepas. overwrite:'auto' di
  // semua tween mencegah tween lama & baru bertumpuk pada properti sama.
  useEffect(() => {
    const el = gl.domElement;
    const killCameraTweens = () => {
      gsap.killTweensOf(camera.position);
      if (controls) gsap.killTweensOf(controls.target);
    };
    el.addEventListener('pointerdown', killCameraTweens);
    el.addEventListener('wheel', killCameraTweens, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', killCameraTweens);
      el.removeEventListener('wheel', killCameraTweens);
    };
  }, [gl, camera, controls]);

  // TURNTABLE IDLE (adopsi learn-arduino-red, terverifikasi di sana kamera
  // berputar seperempat putaran saat idle): bila setelan "Putar otomatis
  // saat idle" nyala (useUiSettings.turntable, opt-in), kamera berputar
  // pelan sendiri setelah ±8 detik tanpa interaksi. Mekanismenya MURNI
  // OrbitControls.autoRotate — tidak ada tween GSAP baru, dan easing /
  // preset / setViewOffset / overwrite tidak disentuh.
  // Gerbang, dievaluasi ulang tepat saat timer jatuh tempo: tidak sedang
  // drag komponen 3D, prefers-reduced-motion tidak aktif, dan tidak ada
  // tween kamera GSAP yang berjalan (gsap.isTweening pada camera.position
  // / controls.target; bila ada, timer dipasang ulang dan dicek lagi).
  // Interaksi apa pun mematikan putaran SEKETIKA + mereset timer:
  // pointerdown / wheel pada gl.domElement, keydown (aktivitas user),
  // perintah kamera baru (cameraView berubah), dan perubahan status drag
  // 3D — dua yang terakhir bekerja lewat dependensi effect: perubahan
  // nilainya menjalankan ulang effect dan cleanup-nya mematikan putaran.
  useEffect(() => {
    if (!controls) return undefined;
    const ctl = controls;
    ctl.autoRotate = false;
    if (!turntableOn) return undefined;
    const el = gl.domElement;
    let timer: number | null = null;
    const stop = () => {
      ctl.autoRotate = false;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const arm = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (useCircuitStore.getState().isDragging3D) return;
        if (prefersReducedMotion()) return;
        if (gsap.isTweening(camera.position) || gsap.isTweening(ctl.target)) {
          arm();
          return;
        }
        ctl.autoRotateSpeed = 0.6;
        ctl.autoRotate = true;
      }, 8000);
    };
    const onActivity = () => {
      stop();
      arm();
    };
    el.addEventListener('pointerdown', onActivity);
    el.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    arm();
    return () => {
      stop();
      el.removeEventListener('pointerdown', onActivity);
      el.removeEventListener('wheel', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [controls, gl, camera, turntableOn, cameraView, isDragging3D]);

  // BINGKAI REKTANGEL BEBAS (Floating Studio HUD, SINTESIS-FINAL §C): panel
  // kini melayang DI ATAS kanvas full-bleed, jadi proyeksi kamera digeser
  // dengan setViewOffset agar meja tampak terbingkai di ruang bebas antar
  // panel (katalog kiri, dock kanan, kapsul atas, dock bawah). Ini murni
  // proyeksi — posisi kamera, OrbitControls, dan tween GSAP tidak berubah
  // perilaku. Diperbarui pada setiap resize; dibersihkan saat unmount.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (typeof cam.setViewOffset !== 'function') return undefined;
    const o = computeViewOffset(size.width, size.height);
    cam.setViewOffset(o.fullWidth, o.fullHeight, o.x, o.y, o.width, o.height);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
      cam.updateProjectionMatrix();
    };
  }, [camera, size]);

  useEffect(() => {
    if (resetSignal === 0 || !controls) return;
    // Reset/home adalah perintah user → power2.inOut (aturan §C); instan
    // bila prefers-reduced-motion aktif.
    const duration = prefersReducedMotion() ? 0 : 0.6;
    gsap.to(camera.position, {
      x: CAMERA_HOME.x, y: CAMERA_HOME.y, z: CAMERA_HOME.z, duration, ease: 'power2.inOut',
      overwrite: 'auto',
    });
    gsap.to(controls.target, {
      x: TARGET_HOME.x, y: TARGET_HOME.y, z: TARGET_HOME.z, duration, ease: 'power2.inOut',
      overwrite: 'auto',
      onUpdate: () => controls.update(),
    });
  }, [resetSignal, controls, camera]);

  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    if (!controls || !focusPosition) return;
    const [x, y, z] = focusPosition;
    // Fokus AUTOPSI kerusakan: satu-satunya pengecualian easing yang
    // terdokumentasi — power3.out sesuai STYLE_GUIDE §4 butir 4 (gerakan
    // kamera perintah-user lain memakai power2.inOut). Tetap instan bila
    // prefers-reduced-motion aktif.
    const duration = prefersReducedMotion() ? 0 : 0.6;
    gsap.to(camera.position, {
      x: x + 13, y: y + 12, z: z + 16, duration, ease: 'power3.out',
      overwrite: 'auto',
    });
    gsap.to(controls.target, {
      x, y, z, duration, ease: 'power3.out',
      overwrite: 'auto',
      onUpdate: () => controls.update(),
    });
  }, [focusNonce, focusPosition, controls, camera]);

  // Preset view dari UI (tombol Perspektif/Atas/Depan/Dekat & fokus autopsi):
  // nonce berubah → luncurkan kamera ke posisi + target yang diperintahkan.
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    if (!controls || !cameraView) return;
    const [tx, ty, tz] = cameraView.target;
    const [px, py, pz] = cameraView.position;
    // Preset/fokus seleksi = perintah user → power2.inOut; instan bila
    // prefers-reduced-motion aktif.
    const duration = prefersReducedMotion() ? 0 : 0.6;
    gsap.to(camera.position, {
      x: px, y: py, z: pz, duration, ease: 'power2.inOut',
      overwrite: 'auto',
    });
    gsap.to(controls.target, {
      x: tx, y: ty, z: tz, duration, ease: 'power2.inOut',
      overwrite: 'auto',
      onUpdate: () => controls.update(),
    });
  }, [cameraView, controls, camera]);

  return null;
}

/** Bidang interaksi tak terlihat di atas breadboard / board (snapping matematis). */
function InteractionPlane({
  kind,
}: {
  kind: 'breadboard' | 'board';
}) {
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const setHover = useCircuitStore((s) => s.setHover);
  const placeAt = useCircuitStore((s) => s.placeAt);
  const clickTerminal = useCircuitStore((s) => s.clickTerminal);
  const placingType = useCircuitStore((s) => s.placingType);
  const pendingFrom = useCircuitStore((s) => s.pendingFrom);
  const setWireCursorPos = useCircuitStore((s) => s.setWireCursorPos);
  const boardId = useCircuitStore((s) => s.boardId);
  const board = getBoardDefinition(boardId);

  const resolve = (point: THREE.Vector3): TerminalRef | null => {
    if (kind === 'breadboard') {
      const holeId = holeAtLocal(point.x - BREADBOARD_ORIGIN[0], point.z - BREADBOARD_ORIGIN[2]);
      return holeId ? { kind: 'hole', holeId } : null;
    }
    const pin = boardPinAtLocal(board, point.x - board.origin[0], point.z - board.origin[2]);
    return pin ? { kind: 'board', pinId: pin.id } : null;
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const ref = resolve(e.point);
    setHover(ref ? { ref, clientX: e.clientX, clientY: e.clientY } : null);
    // Umpan posisi kursor 3D untuk preview kabel elastis (DanglingWirePreview).
    if (pendingFrom) setWireCursorPos([e.point.x, e.point.y, e.point.z]);
  };

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    downPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    const down = downPos.current;
    downPos.current = null;
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return; // itu drag kamera
    const ref = resolve(e.point);
    if (!ref) return;
    if (placingType) {
      if (ref.kind === 'hole') placeAt(ref.holeId);
      return;
    }
    clickTerminal(ref);
  };

  const isBreadboard = kind === 'breadboard';
  return (
    <mesh
      position={
        isBreadboard
          ? [BREADBOARD_ORIGIN[0], 3.02, BREADBOARD_ORIGIN[2]]
          : [board.origin[0], board.topY + 0.02, board.origin[2]]
      }
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={handleMove}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={() => setHover(null)}
    >
      <planeGeometry args={isBreadboard ? [22, 66] : board.size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

/** Marker lubang saat hover + highlight X-Ray satu strip terminal. */
function HoverMarkers() {
  const hover = useCircuitStore((s) => s.hover);
  const pendingFrom = useCircuitStore((s) => s.pendingFrom);
  const placingType = useCircuitStore((s) => s.placingType);
  const instances = useCircuitStore((s) => s.instances);
  const pinHoles = useCircuitStore((s) => s.pinHoles);
  const boardId = useCircuitStore((s) => s.boardId);
  const board = getBoardDefinition(boardId);

  const placementRotation = useCircuitStore(
    (s) => (s as { placementRotation?: PlacementRotation }).placementRotation ?? 0,
  );
  const ghostHoles = useMemo(() => {
    if (!placingType || !hover || hover.ref.kind !== 'hole') return [];
    const occupied = new Set(Object.values(pinHoles).flatMap((m) => Object.values(m)));
    const placement = computePlacement(placingType, hover.ref.holeId, occupied, placementRotation);
    return placement ? Object.values(placement.pinHoles) : [];
  }, [placingType, hover, pinHoles, placementRotation]);

  void instances;
  const hoverPos = hover ? terminalWorldPosition(hover.ref, board) : null;
  const pendingPos = pendingFrom ? terminalWorldPosition(pendingFrom, board) : null;

  let stripBox: { x: number; z: number } | null = null;
  if (hover?.ref.kind === 'hole') {
    const parsed = parseHole(hover.ref.holeId);
    if (parsed?.kind === 'terminal') {
      stripBox = {
        x: BREADBOARD_ORIGIN[0] + (parsed.bank === 'L' ? -3.5 : 3.5),
        z: BREADBOARD_ORIGIN[2] + (-31 + (parsed.row as number)),
      };
    }
  }

  return (
    <group>
      {stripBox && (
        <mesh position={[stripBox.x, 3.06, stripBox.z]}>
          <boxGeometry args={[5.4, 0.05, 1]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {hoverPos && (
        <mesh position={[hoverPos[0], hoverPos[1] + 0.06, hoverPos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.58, 24]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      )}
      {pendingPos && (
        <mesh position={[pendingPos[0], pendingPos[1] + 0.06, pendingPos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.58, 24]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.95} depthWrite={false} />
        </mesh>
      )}
      {ghostHoles.map((holeId) => {
        const pos = terminalWorldPosition({ kind: 'hole', holeId }, board);
        if (!pos) return null;
        return (
          <mesh key={holeId} position={[pos[0], pos[1] + 0.05, pos[2]]}>
            <boxGeometry args={[0.7, 0.1, 0.7]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.65} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Renderer satu komponen, di-memo: selama objek `instance` tidak berubah
 * identitasnya, model 3D tidak ikut re-render oleh perubahan instance lain.
 * Ini memangkas badai render saat drag interaktif — store `interact` hanya
 * mengganti objek instance yang disentuh, jadi 19 model lain kini diam
 * sementara dulu semuanya render ulang di tiap pointermove. `onInteract`
 * dibuat stabil per instance (useCallback pada id) agar memo tidak bocor.
 * Catatan: snapshot simulasi memang membuat objek instance baru (itu
 * ranah store), jadi memo tidak menahan render ulang dari snapshot —
 * manfaatnya terasa pada jalur interaksi & perubahan kabel/topologi.
 */
const InstanceView = memo(function InstanceView({
  instance,
  interact,
}: {
  instance: ComponentInstanceState;
  interact: (instanceId: string, patch: Record<string, unknown>) => void;
}) {
  const plugin = getComponentPlugin(instance.type);
  const handleInteract = useCallback(
    (patch: Record<string, unknown>) => interact(instance.id, patch),
    [interact, instance.id],
  );
  if (!plugin) return null;
  const Render = plugin.Render3D;
  return (
    <>
      <Render instance={instance} onInteract={handleInteract} />
      {instance.simState.isDamaged && <Smoke position={instance.position} />}
    </>
  );
});

/** Semua isi scene yang digerakkan store sirkuit. */
function CircuitScene() {
  const instances = useCircuitStore((s) => s.instances);
  const wires = useCircuitStore((s) => s.wires);
  const selectInstance = useCircuitStore((s) => s.selectInstance);
  const interact = useCircuitStore((s) => s.interact);

  return (
    <group>
      {instances.map((instance) => (
        <group
          key={instance.id}
          onClick={(e) => {
            e.stopPropagation();
            selectInstance(instance.id);
          }}
        >
          <InstanceView instance={instance} interact={interact} />
        </group>
      ))}
      {wires.map((wire) => (
        <WireMesh3D key={wire.id} wire={wire} />
      ))}
    </group>
  );
}

/** Board aktif dari store: Uno memakai model khususnya, board lain generik. */
function ActiveBoard() {
  const boardId = useCircuitStore((s) => s.boardId);
  const board = getBoardDefinition(boardId);
  if (boardId === 'uno') return <UnoBoard position={board.origin} />;
  return <GenericBoard definition={board} />;
}

/**
 * Panggung 3D "Tactile ESD Workbench": meja ESD, board aktif, breadboard,
 * rangkaian dari store (komponen + kabel), interaksi pasang & wiring.
 */
export default function Workbench({ resetSignal }: { resetSignal: number }) {
  const isDragging3D = useCircuitStore((s) => s.isDragging3D);
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.5]}
      camera={{ position: CAMERA_HOME.toArray(), fov: 45, near: 0.5, far: 600 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#10131a']} />
      <fog attach="fog" args={['#10131a', 190, 380]} />

      <ambientLight intensity={0.55} />
      <directionalLight
        position={[34, 55, 24]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <directionalLight position={[-30, 28, -36]} intensity={0.35} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[420, 420]} />
        <meshStandardMaterial color="#0f241d" roughness={1} />
      </mesh>
      <gridHelper args={[420, 210, '#18382d', '#18382d']} position={[0, 0.02, 0]} />
      {/* Bayangan kontak lembut tepat di bawah board & breadboard (tanpa HDR eksternal).
          frames={1}: bayangan kontak dibakar SEKALI (board & breadboard statis);
          default drei me-render pass kedalaman seluruh scene TIAP frame — pajak
          performa besar yang tidak membeli apa-apa di meja statis. Bayangan
          bergerak tetap datang dari lampu arah. resolution 512 cukup untuk blur. */}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={170} blur={2.2} far={4} frames={1} resolution={512} />

      <ActiveBoard />
      <Breadboard position={BREADBOARD_ORIGIN} />
      <CircuitScene />
      <HoverMarkers />
      <DanglingWirePreview />
      <GhostPlacementMesh />
      <InteractionPlane kind="breadboard" />
      <InteractionPlane kind="board" />

      <OrbitControls
        makeDefault
        enabled={!isDragging3D}
        enableDamping
        target={TARGET_HOME.toArray()}
        maxPolarAngle={1.45}
        minDistance={10}
        maxDistance={120}
      />
      <CameraRig resetSignal={resetSignal} />
    </Canvas>
  );
}
