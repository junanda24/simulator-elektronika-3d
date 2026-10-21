import { useEffect, useMemo, useRef } from 'react';
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
import {
  BREADBOARD_ORIGIN,
  holeAtLocal,
  parseHole,
} from '../../shared/boards/breadboard';

import { useCircuitStore } from '../wiring/store/circuitStore';
import { terminalWorldPosition } from '../wiring/terminals';
import type { TerminalRef } from '../wiring/netlist';
import { computePlacement, type PlacementRotation } from '../wiring/placement';
import WireMesh3D from '../wiring/components/WireMesh3D';
import DanglingWirePreview from '../wiring/components/DanglingWirePreview';
import GhostPlacementMesh from './effects/GhostPlacementMesh';

export const CAMERA_HOME = new THREE.Vector3(48, 42, 52);
export const TARGET_HOME = new THREE.Vector3(2, 0, 0);

/** Kamera: reset manual + fokus autopsi + preset view (GSAP, STYLE_GUIDE §4.4). */
function CameraRig({ resetSignal }: { resetSignal: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const focusNonce = useCircuitStore((s) => s.focusNonce);
  const focusPosition = useCircuitStore((s) => s.focusPosition);
  const cameraView = useCircuitStore((s) => s.cameraView);
  const firstFocus = useRef(true);
  const firstView = useRef(true);

  useEffect(() => {
    if (resetSignal === 0 || !controls) return;
    gsap.to(camera.position, {
      x: CAMERA_HOME.x, y: CAMERA_HOME.y, z: CAMERA_HOME.z, duration: 0.6, ease: 'power3.out',
    });
    gsap.to(controls.target, {
      x: TARGET_HOME.x, y: TARGET_HOME.y, z: TARGET_HOME.z, duration: 0.6, ease: 'power3.out',
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
    gsap.to(camera.position, {
      x: x + 13, y: y + 12, z: z + 16, duration: 0.6, ease: 'power3.out',
    });
    gsap.to(controls.target, {
      x, y, z, duration: 0.6, ease: 'power3.out',
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
    gsap.to(camera.position, {
      x: px, y: py, z: pz, duration: 0.6, ease: 'power2.inOut',
    });
    gsap.to(controls.target, {
      x: tx, y: ty, z: tz, duration: 0.6, ease: 'power2.inOut',
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

/** Semua isi scene yang digerakkan store sirkuit. */
function CircuitScene() {
  const instances = useCircuitStore((s) => s.instances);
  const wires = useCircuitStore((s) => s.wires);
  const selectInstance = useCircuitStore((s) => s.selectInstance);
  const interact = useCircuitStore((s) => s.interact);

  return (
    <group>
      {instances.map((instance) => {
        const plugin = getComponentPlugin(instance.type);
        if (!plugin) return null;
        const Render = plugin.Render3D;
        return (
          <group
            key={instance.id}
            onClick={(e) => {
              e.stopPropagation();
              selectInstance(instance.id);
            }}
          >
            <Render
              instance={instance}
              onInteract={(patch) => interact(instance.id, patch)}
            />
            {instance.simState.isDamaged && <Smoke position={instance.position} />}
          </group>
        );
      })}
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
      dpr={[1, 2]}
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
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
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
      {/* Bayangan kontak lembut tepat di bawah board & breadboard (tanpa HDR eksternal). */}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={170} blur={2.2} far={4} resolution={1024} />

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
        target={TARGET_HOME.toArray()}
        maxPolarAngle={1.45}
        minDistance={10}
        maxDistance={120}
      />
      <CameraRig resetSignal={resetSignal} />
    </Canvas>
  );
}
