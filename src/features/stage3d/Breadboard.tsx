import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';

interface BreadboardProps {
  position?: [number, number, number];
}

/** Kolom terminal kiri & kanan (pitch 1 unit), dipisah parit tengah. */
const TERMINAL_COLUMNS = [-5.5, -4.5, -3.5, -2.5, -1.5, 1.5, 2.5, 3.5, 4.5, 5.5];
/** Kolom rail daya di kedua tepi. */
const RAIL_COLUMNS = [-9.3, -8.1, 8.1, 9.3];
const TERMINAL_ROWS = 63;
const RAIL_HOLES = 50;
/** Tinggi permukaan breadboard; kaki komponen menancap pada bidang ini. */
export const BREADBOARD_TOP_Y = 3;

function buildHolePositions(): Array<[number, number, number]> {
  const positions: Array<[number, number, number]> = [];
  for (let row = 0; row < TERMINAL_ROWS; row += 1) {
    const z = -31 + row;
    for (const x of TERMINAL_COLUMNS) positions.push([x, 2.95, z]);
  }
  for (let i = 0; i < RAIL_HOLES; i += 1) {
    const z = -24.5 + i;
    for (const x of RAIL_COLUMNS) positions.push([x, 2.95, z]);
  }
  return positions;
}

/**
 * Breadboard 830 titik: 2 blok terminal (63 x 5) + parit tengah
 * + 4 rail daya x 50 lubang. Semua lubang dirender sebagai SATU
 * InstancedMesh (satu draw call), sesuai TECH_STACK.md §2.
 * Skala: 1 unit = 1 pitch (2.54 mm), bodi 22 x 66 unit.
 */
export default function Breadboard({ position = [0, 0, 0] }: BreadboardProps) {
  const holesRef = useRef<THREE.InstancedMesh>(null);
  const holePositions = useMemo(buildHolePositions, []);
  const holeGeometry = useMemo(() => new THREE.BoxGeometry(0.55, 0.25, 0.55), []);
  const holeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#17181c', roughness: 0.95 }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = holesRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    holePositions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [holePositions]);

  return (
    <group position={position}>
      {/* Bodi putih gading */}
      <RoundedBox
        args={[22, BREADBOARD_TOP_Y, 66]}
        radius={0.35}
        smoothness={4}
        position={[0, BREADBOARD_TOP_Y / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#f2ede2" roughness={0.55} />
      </RoundedBox>

      {/* Parit tengah pemisah dua blok terminal */}
      <mesh position={[0, 2.99, 0]}>
        <boxGeometry args={[1.8, 0.06, 63]} />
        <meshStandardMaterial color="#ddd6c4" roughness={0.8} />
      </mesh>

      {/* Lubang: satu InstancedMesh untuk 830 titik */}
      <instancedMesh
        ref={holesRef}
        args={[holeGeometry, holeMaterial, holePositions.length]}
        receiveShadow
      />

      {/* Garis penanda rail daya: merah (+) dan biru (-) */}
      <mesh position={[-7.5, 3.02, 0]}>
        <boxGeometry args={[0.16, 0.03, 50]} />
        <meshStandardMaterial color="#d42a1e" roughness={0.6} />
      </mesh>
      <mesh position={[-10, 3.02, 0]}>
        <boxGeometry args={[0.16, 0.03, 50]} />
        <meshStandardMaterial color="#2456c8" roughness={0.6} />
      </mesh>
      <mesh position={[7.5, 3.02, 0]}>
        <boxGeometry args={[0.16, 0.03, 50]} />
        <meshStandardMaterial color="#2456c8" roughness={0.6} />
      </mesh>
      <mesh position={[10, 3.02, 0]}>
        <boxGeometry args={[0.16, 0.03, 50]} />
        <meshStandardMaterial color="#d42a1e" roughness={0.6} />
      </mesh>
    </group>
  );
}
