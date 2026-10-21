import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getComponentPlugin } from '../../../shared/components/registry';
import { holeWorldPosition } from '../../../shared/boards/breadboard';
import { useCircuitStore } from '../../wiring/store/circuitStore';
import { computePlacement, type PlacementRotation } from '../../wiring/placement';
import { terminalWorldPosition } from '../../wiring/terminals';

/**
 * Ghost penempatan komponen (Batch 6): saat user memilih komponen dari
 * katalog dan mengarahkan kursor ke breadboard, model asli komponen
 * tampil melayang persis di posisi+rotasi hasil computePlacement —
 * yaitu posisi yang SAMA PERSIS dengan hasil placeAt bila diklik.
 * Selubung transparan mengelilingi footprint: hijau #22C55E bila
 * penempatan valid, merah #EF4444 di lubang hover (tanpa model) bila
 * lubang tujuan tidak valid/terisi. Ghost bersifat click-through:
 * raycast seluruh subtree dimatikan agar tidak menghalangi
 * InteractionPlane. Melengkapi marker lubang hijau di HoverMarkers.
 */
export default function GhostPlacementMesh() {
  const placingType = useCircuitStore((s) => s.placingType);
  const hover = useCircuitStore((s) => s.hover);
  const pinHoles = useCircuitStore((s) => s.pinHoles);
  // placementRotation ditambahkan Agent 1A pada store; baca defensif.
  const placementRotation = useCircuitStore(
    (s) => (s as { placementRotation?: PlacementRotation }).placementRotation ?? 0,
  );
  const ghostGroup = useRef<THREE.Group>(null);

  const hoverHoleId = hover?.ref.kind === 'hole' ? hover.ref.holeId : null;

  const placement = useMemo(() => {
    if (!placingType || !hoverHoleId) return null;
    const occupied = new Set(
      Object.values(pinHoles).flatMap((m) => Object.values(m)),
    );
    return computePlacement(placingType, hoverHoleId, occupied, placementRotation);
  }, [placingType, hoverHoleId, pinHoles, placementRotation]);

  // Ghost tidak boleh menangkap event pointer (klik harus tembus ke
  // InteractionPlane agar placeAt tetap bekerja).
  useLayoutEffect(() => {
    ghostGroup.current?.traverse((obj) => {
      (obj as THREE.Mesh).raycast = () => null;
    });
  }, [placement]);

  if (!placingType || !hoverHoleId) return null;

  const plugin = placement ? getComponentPlugin(placingType) : undefined;

  // Selubung validitas: dari sebaran lubang kaki hasil placement,
  // atau kotak merah di lubang hover bila placement tidak valid.
  let shell: {
    center: [number, number, number];
    size: [number, number, number];
    valid: boolean;
  } | null = null;
  if (placement) {
    const positions = Object.values(placement.pinHoles)
      .map((holeId) => holeWorldPosition(holeId))
      .filter((p): p is [number, number, number] => p !== null);
    if (positions.length > 0) {
      const xs = positions.map((p) => p[0]);
      const zs = positions.map((p) => p[2]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      shell = {
        center: [
          (minX + maxX) / 2,
          placement.instance.position[1] + 0.8,
          (minZ + maxZ) / 2,
        ],
        size: [maxX - minX + 1.4, 1.6, maxZ - minZ + 1.4],
        valid: true,
      };
    }
  } else {
    const hoverPos = terminalWorldPosition({ kind: 'hole', holeId: hoverHoleId });
    if (hoverPos) {
      shell = {
        center: [hoverPos[0], hoverPos[1] + 0.8, hoverPos[2]],
        size: [1.8, 1.6, 1.8],
        valid: false,
      };
    }
  }

  const Render = plugin?.Render3D;
  return (
    <group>
      {placement && Render && (
        <group ref={ghostGroup}>
          <Render instance={placement.instance} onInteract={() => {}} />
        </group>
      )}
      {shell && (
        <mesh position={shell.center} raycast={() => null}>
          <boxGeometry args={shell.size} />
          <meshBasicMaterial
            color={shell.valid ? '#22C55E' : '#EF4444'}
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
