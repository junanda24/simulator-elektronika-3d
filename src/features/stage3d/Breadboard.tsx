import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { MATERIAL_PROPS } from './materials3d';

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

/** Resolusi tekstur cetakan permukaan (piksel per unit grid). */
const PRINT_PX_PER_UNIT = 48;

/**
 * Tekstur cetakan permukaan ala MB-102, digambar prosedural ke canvas:
 * angka baris tiap 5 baris di sisi luar kedua bank terminal, huruf kolom
 * a–e / f–j di kedua ujung, label + / − rel catu di ujung rel dan secara
 * berkala di margin luar, serta merek kecil di ujung celah tengah.
 * Pemetaan piksel dihitung dari konstanta grid yang sama dengan lubang:
 * x lokal −11..11 → px 0..1056, z lokal −33..33 → py 0..3168
 * (asal canvas = sudut x−/z−, mengikuti konvensi silkscreen board).
 * Bidang cetak ditaruh di y = 3.008 — di atas bodi (3.0) tetapi di bawah
 * puncak lubang (3.075), rel penanda (3.035), dan parit tengah (3.02),
 * sehingga tinta tidak pernah menimpa geometri yang menonjol.
 */
function createPrintTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 22 * PRINT_PX_PER_UNIT;
  canvas.height = 66 * PRINT_PX_PER_UNIT;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;

  const X = (x: number) => (x + 11) * PRINT_PX_PER_UNIT;
  const Y = (z: number) => (z + 33) * PRINT_PX_PER_UNIT;
  const INK = '#374151';
  const RED = '#d42a1e';
  const BLUE = '#2456c8';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Angka baris 1, 5, 10, … 60 di sisi luar bank kiri & kanan
  // (baris n berada di z = −31 + (n − 1), sama seperti lubang terminal).
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.round(0.55 * PRINT_PX_PER_UNIT)}px Arial, sans-serif`;
  for (let n = 1; n <= 60; n += 1) {
    if (n !== 1 && n % 5 !== 0) continue;
    const z = -31 + (n - 1);
    ctx.fillText(String(n), X(-6.9), Y(z));
    ctx.fillText(String(n), X(6.9), Y(z));
  }

  // Huruf kolom di ujung atas & bawah, sejajar kolom terminal nyata.
  ctx.font = `700 ${Math.round(0.62 * PRINT_PX_PER_UNIT)}px Arial, sans-serif`;
  const LETTERS: Array<[string, number]> = [
    ['a', -5.5],
    ['b', -4.5],
    ['c', -3.5],
    ['d', -2.5],
    ['e', -1.5],
    ['f', 1.5],
    ['g', 2.5],
    ['h', 3.5],
    ['i', 4.5],
    ['j', 5.5],
  ];
  for (const [letter, x] of LETTERS) {
    ctx.fillText(letter, X(x), Y(-32.25));
    ctx.fillText(letter, X(x), Y(32.25));
  }

  // Label rel catu besar di kedua ujung tiap rel (rel berakhir di z ±24.5,
  // garis penanda 3D berakhir di z ±25 — label di z ±26.9 bebas geometri).
  // Kolom: L− = −9.3, L+ = −8.1, R− = 8.1, R+ = 9.3.
  ctx.font = `700 ${Math.round(0.8 * PRINT_PX_PER_UNIT)}px Arial, sans-serif`;
  for (const z of [-26.9, 26.9]) {
    ctx.fillStyle = RED;
    ctx.fillText('+', X(-8.1), Y(z));
    ctx.fillText('+', X(9.3), Y(z));
    ctx.fillStyle = BLUE;
    ctx.fillText('−', X(-9.3), Y(z));
    ctx.fillText('−', X(8.1), Y(z));
  }

  // Label berkala di margin luar bodi (strip bebas di luar garis penanda).
  ctx.font = `700 ${Math.round(0.55 * PRINT_PX_PER_UNIT)}px Arial, sans-serif`;
  for (const z of [-15, 0, 15]) {
    ctx.fillStyle = BLUE;
    ctx.fillText('−', X(-10.55), Y(z));
    ctx.fillStyle = RED;
    ctx.fillText('+', X(10.55), Y(z));
  }

  // Merek kecil di ujung celah tengah (bidang parit 3D menutupi bagian
  // tengah celah, jadi teks ditaruh di margin ujung di luar huruf kolom).
  ctx.fillStyle = INK;
  ctx.font = `700 ${Math.round(0.5 * PRINT_PX_PER_UNIT)}px Arial, sans-serif`;
  ctx.fillText('MB-102', X(0), Y(-32.25));
  ctx.font = `600 ${Math.round(0.32 * PRINT_PX_PER_UNIT)}px Arial, sans-serif`;
  ctx.fillText('830 TIE-POINT', X(0), Y(32.25));

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

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
  const printTexture = useMemo(createPrintTexture, []);
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
      {/* Bodi putih gading — material disamakan ke kelas breadboardKrem
          pustaka bersama (SPESIFIKASI §3); warna token #f2ede2 sama */}
      <RoundedBox
        args={[22, BREADBOARD_TOP_Y, 66]}
        radius={0.35}
        smoothness={4}
        position={[0, BREADBOARD_TOP_Y / 2, 0]}
        receiveShadow
        castShadow
      >
        <meshPhysicalMaterial {...MATERIAL_PROPS.breadboardKrem} />
      </RoundedBox>

      {/* Parit tengah pemisah dua blok terminal */}
      <mesh position={[0, 2.99, 0]}>
        <boxGeometry args={[1.8, 0.06, 63]} />
        <meshStandardMaterial color="#ddd6c4" roughness={0.8} />
      </mesh>

      {/* Takik penanda di tengah parit (seperti MB-102 asli): strip
          sedikit lebih gelap melintang di tengah kanal — mesh terpisah,
          tidak menyentuh geometri/instancing lubang sama sekali */}
      <mesh position={[0, 3.03, 0]}>
        <boxGeometry args={[1.8, 0.02, 0.5]} />
        <meshStandardMaterial color="#c9c0a8" roughness={0.85} />
      </mesh>

      {/* Cetakan permukaan (angka baris, huruf kolom, label rel, merek) —
          satu bidang transparan tepat di atas bodi, di bawah semua
          geometri yang menonjol agar tinta selalu terbaca bersih */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 3.008, 0]}>
        <planeGeometry args={[22, 66]} />
        <meshBasicMaterial map={printTexture} transparent depthWrite={false} />
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
