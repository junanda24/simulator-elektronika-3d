import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import { useCircuitStore } from '../store/circuitStore';
import { terminalWorldPosition } from '../terminals';
import type { WireConnection } from '../netlist';
import CurrentFlowDots from '../../stage3d/effects/CurrentFlowDots';

/** Titik tengah melengkung untuk kabel dari A ke B (sama seperti render lama). */
function wirePoints(
  a: [number, number, number],
  b: [number, number, number],
): Array<[number, number, number]> {
  const dist = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const lift = 1.6 + dist * 0.16;
  const mid = (t: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    Math.max(a[1], b[1]) + lift * Math.sin(Math.PI * t),
    a[2] + (b[2] - a[2]) * t,
  ];
  return [a, mid(0.33), mid(0.66), b];
}

/**
 * Satu kabel jumper sebagai TubeGeometry mengikuti CatmullRomCurve3
 * (diekstrak dari Workbench, Batch 6). Kemampuan baru:
 * - Klik → selectWire (emissive menyala halus saat terpilih, seperti lama).
 * - Thermal glow: saat boardFault (korsleting rel, POWER_SHORT_CIRCUIT)
 *   dan salah satu ujung kabel berada di net 'GND' atau net rel catu
 *   board (5V/3V3/VIN/VBUS/...), material membara merah #FF2A54
 *   berdenyut — kabel jalur korslet terlihat jelas (STYLE_GUIDE §4.4).
 * - <CurrentFlowDots> mengalir di sepanjang kurva sesuai beda tegangan
 *   net kedua ujung dari snapshot MNA.
 */
export default function WireMesh3D({ wire }: { wire: WireConnection }) {
  const selectWire = useCircuitStore((s) => s.selectWire);
  const selected = useCircuitStore((s) => s.selectedWireId === wire.id);
  const boardFault = useCircuitStore((s) => s.boardFault);
  const running = useCircuitStore((s) => s.running);
  const voltages = useCircuitStore((s) => s.voltages);
  const boardId = useCircuitStore((s) => s.boardId);
  // Langganan topologi agar nama net & deltaV dihitung ulang saat rangkaian berubah.
  const instances = useCircuitStore((s) => s.instances);
  const pinHoles = useCircuitStore((s) => s.pinHoles);
  const wires = useCircuitStore((s) => s.wires);
  const board = getBoardDefinition(boardId);
  const material = useRef<THREE.MeshStandardMaterial>(null);

  const points = useMemo(() => {
    const a = terminalWorldPosition(wire.a, board);
    const b = terminalWorldPosition(wire.b, board);
    return a && b ? wirePoints(a, b) : null;
  }, [wire, board]);

  const curve = useMemo(
    () =>
      points
        ? new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
        : null,
    [points],
  );

  const geometry = useMemo(
    () => (curve ? new THREE.TubeGeometry(curve, 40, selected ? 0.21 : 0.16, 8, false) : null),
    [curve, selected],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  // Nama net kanonis kedua ujung + status jalur korslet + beda tegangan.
  const { thermal, deltaV } = useMemo(() => {
    void instances;
    void pinHoles;
    void wires;
    const state = useCircuitStore.getState();
    const netA = state.netNameOf(wire.a);
    const netB = state.netNameOf(wire.b);
    const railNets = new Set(board.powerRails.map((r) => r.net));
    const isFaultNet = (net: string) =>
      net === 'GND' || railNets.has(net) || railNets.has(net.replace(/^board:/, ''));
    return {
      thermal: boardFault && (isFaultNet(netA) || isFaultNet(netB)),
      deltaV: (voltages[netA] ?? 0) - (voltages[netB] ?? 0),
    };
  }, [wire, board, boardFault, voltages, instances, pinHoles, wires]);

  // Denyut membara untuk kabel jalur korslet.
  useFrame(({ clock }) => {
    if (!material.current || !thermal) return;
    material.current.emissiveIntensity = 0.6 + 0.4 * Math.sin(clock.elapsedTime * 15);
  });

  if (!points || !curve || !geometry) return null;
  return (
    <group>
      <mesh
        geometry={geometry}
        castShadow
        onClick={(e) => {
          e.stopPropagation();
          selectWire(wire.id);
        }}
      >
        <meshStandardMaterial
          ref={material}
          color={wire.color}
          roughness={0.55}
          emissive={thermal ? '#FF2A54' : selected ? wire.color : '#000000'}
          emissiveIntensity={thermal ? 0.6 : selected ? 0.35 : 0}
        />
      </mesh>
      <CurrentFlowDots curve={curve} deltaV={deltaV} running={running} />
    </group>
  );
}
