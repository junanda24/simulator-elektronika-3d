import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';

interface UnoBoardProps {
  position?: [number, number, number];
}

const PCB_WIDTH = 27; // 68.6 mm dalam satuan pitch
const PCB_DEPTH = 21; // 53.4 mm
const PCB_TOP_Y = 0.6;

/** Silkscreen putih digambar prosedural ke canvas 2D (TECH_STACK.md §2.3). */
function createSilkscreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 796;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';

  // Judul board
  ctx.font = '700 62px "JetBrains Mono", monospace';
  ctx.fillText('ARDUINO UNO', 470, 430);
  ctx.font = '600 30px "JetBrains Mono", monospace';
  ctx.fillText('R3', 470, 478);

  // Label pin digital di tepi atas (D13 .. D0)
  ctx.font = '600 24px "JetBrains Mono", monospace';
  for (let i = 0; i < 14; i += 1) {
    const x = 150 + i * 58;
    ctx.fillText(`D${13 - i}`, x, 84);
  }
  // Label header daya di tepi bawah kiri
  const powerLabels = ['VIN', 'GND', 'GND', '5V', '3V3', 'RST', 'IO', 'AREF'];
  powerLabels.forEach((label, i) => {
    ctx.fillText(label, 132 + i * 58, 724);
  });
  // Label pin analog di tepi bawah kanan
  for (let i = 0; i < 6; i += 1) {
    ctx.fillText(`A${i}`, 620 + i * 58, 724);
  }
  ctx.fillText('TX', 880, 84);
  ctx.fillText('RX', 940, 84);

  // Dekorasi: lingkaran logo + garis jalur
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(880, 400, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.fillText('~', 880, 416);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.30)';
  ctx.beginPath();
  ctx.moveTo(120, 560);
  ctx.lineTo(420, 560);
  ctx.lineTo(470, 610);
  ctx.lineTo(760, 610);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Posisi pin header betina: digital (atas), daya + analog (bawah). */
function buildHeaderPositions(): Array<[number, number, number]> {
  const positions: Array<[number, number, number]> = [];
  for (let i = 0; i < 14; i += 1) positions.push([-6.5 + i, 1.15, -9.6]);
  for (let i = 0; i < 8; i += 1) positions.push([-8.9 + i, 1.15, 9.6]);
  for (let i = 0; i < 6; i += 1) positions.push([3.1 + i, 1.15, 9.6]);
  return positions;
}

/**
 * Arduino Uno R3 prosedural (tanpa aset .glb): PCB biru teal khas Uno,
 * silkscreen CanvasTexture, header betina InstancedMesh, port USB,
 * jack barrel, chip ATmega, kristal, dan kapasitor.
 */
export default function UnoBoard({ position = [0, 0, 0] }: UnoBoardProps) {
  const headersRef = useRef<THREE.InstancedMesh>(null);
  const silkscreen = useMemo(createSilkscreenTexture, []);
  const headerPositions = useMemo(buildHeaderPositions, []);
  const headerGeometry = useMemo(() => new THREE.BoxGeometry(0.9, 1.1, 0.9), []);
  const headerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#101014', roughness: 0.6 }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = headersRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    headerPositions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [headerPositions]);

  return (
    <group position={position}>
      {/* PCB */}
      <RoundedBox
        args={[PCB_WIDTH, PCB_TOP_Y, PCB_DEPTH]}
        radius={0.18}
        smoothness={4}
        position={[0, PCB_TOP_Y / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color="#008184" clearcoat={0.6} roughness={0.3} />
      </RoundedBox>

      {/* Silkscreen di permukaan PCB */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PCB_TOP_Y + 0.02, 0]}>
        <planeGeometry args={[PCB_WIDTH - 0.8, PCB_DEPTH - 0.8]} />
        <meshBasicMaterial map={silkscreen} transparent depthWrite={false} />
      </mesh>

      {/* Header betina: satu InstancedMesh */}
      <instancedMesh
        ref={headersRef}
        args={[headerGeometry, headerMaterial, headerPositions.length]}
        castShadow
      />

      {/* Port USB-B (perak) di tepi kiri */}
      <mesh position={[-12.2, 1.9, -5]} castShadow>
        <boxGeometry args={[4.6, 3.2, 5]} />
        <meshStandardMaterial color="#c9ccd4" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Jack barrel DC (silinder hitam) */}
      <mesh position={[-11.4, 1.6, 6.8]} castShadow>
        <cylinderGeometry args={[2.1, 2.1, 3.2, 24]} />
        <meshStandardMaterial color="#17181c" roughness={0.5} />
      </mesh>

      {/* Chip ATmega328P */}
      <mesh position={[3.5, 1, 0]} castShadow>
        <boxGeometry args={[12, 0.8, 2.8]} />
        <meshStandardMaterial color="#1b1b1f" roughness={0.45} />
      </mesh>

      {/* Kristal osilator (perak kecil) */}
      <mesh position={[-3.4, 0.95, 3.4]} castShadow>
        <boxGeometry args={[2, 0.7, 1.4]} />
        <meshStandardMaterial color="#c9ccd4" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Dua kapasitor elektrolit */}
      <mesh position={[-9.4, 1.5, 1.6]} castShadow>
        <cylinderGeometry args={[1.1, 1.1, 2.4, 20]} />
        <meshStandardMaterial color="#23252b" roughness={0.4} />
      </mesh>
      <mesh position={[-9.4, 1.5, 4.6]} castShadow>
        <cylinderGeometry args={[1.1, 1.1, 2.4, 20]} />
        <meshStandardMaterial color="#23252b" roughness={0.4} />
      </mesh>

      {/* Tombol reset */}
      <mesh position={[-11.8, 1.1, -9]} castShadow>
        <boxGeometry args={[2, 1, 2]} />
        <meshStandardMaterial color="#3a3d45" roughness={0.5} />
      </mesh>
    </group>
  );
}
