import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import { useCircuitStore } from '../store/circuitStore';
import { terminalWorldPosition } from '../terminals';

/**
 * Preview kabel elastis saat user sedang menarik kabel dari satu
 * terminal (Batch 6, menggantikan garis putus-putus lurus lama).
 * Ujung bebas mengikuti posisi kursor 3D (store.wireCursorPos, diumpan
 * InteractionPlane pada Workbench); fallback ke posisi terminal yang
 * sedang di-hover. Lengkungan CatmullRom 3 titik: awal tetap, tengah
 * terangkat proporsional terhadap jarak, ujung di kursor.
 */
export default function DanglingWirePreview() {
  const pendingFrom = useCircuitStore((s) => s.pendingFrom);
  const wireColor = useCircuitStore((s) => s.wireColor);
  const hover = useCircuitStore((s) => s.hover);
  const wireCursorPos = useCircuitStore((s) => s.wireCursorPos);
  const instances = useCircuitStore((s) => s.instances);
  const boardId = useCircuitStore((s) => s.boardId);
  const board = getBoardDefinition(boardId);

  const geometry = useMemo(() => {
    if (!pendingFrom) return null;
    const start = terminalWorldPosition(pendingFrom, board, instances);
    if (!start) return null;
    const end =
      wireCursorPos ?? (hover ? terminalWorldPosition(hover.ref, board, instances) : null);
    if (!end) return null;
    const dist = Math.hypot(end[0] - start[0], end[2] - start[2]);
    const mid: [number, number, number] = [
      (start[0] + end[0]) / 2,
      Math.max(start[1], end[1]) + Math.min(dist * 0.35, 1.8),
      (start[2] + end[2]) / 2,
    ];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...start),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...end),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.04, 8, false);
  }, [pendingFrom, wireCursorPos, hover, board, instances]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={wireColor}
        transparent
        opacity={0.75}
        roughness={0.3}
      />
    </mesh>
  );
}
