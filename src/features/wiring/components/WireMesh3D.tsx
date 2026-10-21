import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { useFrame } from '@react-three/fiber';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import { useCircuitStore } from '../store/circuitStore';
import { terminalWorldPosition } from '../terminals';
import type { WireConnection } from '../netlist';
import CurrentFlowDots from '../../stage3d/effects/CurrentFlowDots';

/** Gerbang reduced-motion proyek — pola sama dengan CameraRig/Smoke. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Segmen tubular TubeGeometry kabel (harus sama dengan pemanggilan di bawah). */
const TUBULAR_SEGMENTS = 40;
/** Durasi efek menggambar kabel baru (detik) — pita micro-feedback. */
const DRAW_DURATION_S = 0.25;

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
/**
 * Pembaca tegangan khusus titik aliran: HANYA komponen mungil ini yang
 * berlangganan `voltages` (berubah tiap snapshot, ±60×/detik saat simulasi
 * berjalan). WireMesh3D induknya sengaja TIDAK berlangganan tegangan agar
 * geometri tube dan perhitungan netlist (mahal) tidak ikut dibangun ulang
 * oleh badai snapshot — dulu keduanya terikat di memo yang sama.
 */
function WireFlowDots({
  curve,
  netA,
  netB,
}: {
  curve: THREE.CatmullRomCurve3;
  netA: string;
  netB: string;
}) {
  const running = useCircuitStore((s) => s.running);
  const voltages = useCircuitStore((s) => s.voltages);
  const deltaV = (voltages[netA] ?? 0) - (voltages[netB] ?? 0);
  return <CurrentFlowDots curve={curve} deltaV={deltaV} running={running} />;
}

export default function WireMesh3D({ wire }: { wire: WireConnection }) {
  const selectWire = useCircuitStore((s) => s.selectWire);
  const selected = useCircuitStore((s) => s.selectedWireId === wire.id);
  const boardFault = useCircuitStore((s) => s.boardFault);
  const boardId = useCircuitStore((s) => s.boardId);
  // Langganan topologi agar nama net dihitung ulang saat rangkaian berubah.
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
    () => (curve ? new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, selected ? 0.21 : 0.16, 8, false) : null),
    [curve, selected],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  // --- Efek menggambar (draw-on) untuk kabel BARU tersambung -----------
  // TubeGeometry digambar bertahap lewat setDrawRange yang dimajukan per
  // segmen tubular (depan gambar selalu utuh per penampang, bukan potongan
  // segitiga acak): kemajuan 0→1 dalam 250 ms power2.out (entrance =
  // decelerate) mengikuti kurva kabel dari ujung a ke ujung b. Titik aliran
  // (CurrentFlowDots) baru tampil SETELAH gambar selesai. Reduced motion:
  // perjalanan gambar adalah gerak Tier-1 — kabel langsung tampil utuh.
  // Kemajuan hidup di ref & ditulis GSAP tanpa alokasi per frame; geometri
  // yang berganti di tengah jalan (toggle seleksi mengubah radius tube)
  // menerima ulang kemajuan terakhir lewat effect di bawah.
  const drawRef = useRef({ t: 0 });
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const [drawDone, setDrawDone] = useState(false);

  const applyDrawRange = useCallback(() => {
    const geo = geometryRef.current;
    if (!geo || !geo.index) return;
    const t = drawRef.current.t;
    if (t >= 1) {
      geo.setDrawRange(0, Infinity);
      return;
    }
    const perSegment = geo.index.count / TUBULAR_SEGMENTS;
    geo.setDrawRange(0, Math.floor(t * TUBULAR_SEGMENTS) * perSegment);
  }, []);

  useEffect(() => {
    geometryRef.current = geometry;
    applyDrawRange();
  }, [geometry, applyDrawRange]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      drawRef.current.t = 1;
      applyDrawRange();
      setDrawDone(true);
      return undefined;
    }
    const tween = gsap.to(drawRef.current, {
      t: 1,
      duration: DRAW_DURATION_S,
      ease: 'power2.out',
      onUpdate: applyDrawRange,
      onComplete: () => setDrawDone(true),
    });
    return () => {
      tween.kill();
    };
  }, [applyDrawRange]);

  // Nama net kanonis kedua ujung + status jalur korslet. Memo ini HANYA
  // bergantung pada topologi & status fault — bukan tegangan — supaya
  // netNameOf (membangun netlist) tidak jalan ulang tiap snapshot.
  const { netA, netB, thermal } = useMemo(() => {
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
      netA,
      netB,
      thermal: boardFault && (isFaultNet(netA) || isFaultNet(netB)),
    };
  }, [wire, board, boardFault, instances, pinHoles, wires]);

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
      {drawDone && <WireFlowDots curve={curve} netA={netA} netB={netB} />}
    </group>
  );
}
