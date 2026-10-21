import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
  createMaterial3D,
} from '../../../features/stage3d/materials3d';
import { createLabelTexture } from '../../../features/stage3d/labelTexture';

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

  // Jejak PCB (traces) samar di bawah silkscreen: jalur siku (Manhattan)
  // deterministik dari baris header menuju tengah board + titik via,
  // digambar SEBELUM label agar teks putih tetap paling terbaca.
  // Pemetaan bidang silkscreen 26.2 x 20.2 unit -> canvas 1024 x 796 px.
  const PXU = 39; // piksel per unit (kurang lebih)
  const toPx = (lx: number, lz: number): [number, number] => [
    (lx / 26.2 + 0.5) * canvas.width,
    (lz / 20.2 + 0.5) * canvas.height,
  ];
  const tracePins: Array<[number, number]> = [];
  for (let i = 0; i < 14; i += 1) tracePins.push([-6.5 + i, -9.6]);
  for (let i = 0; i < 8; i += 1) tracePins.push([-8.9 + i, 9.6]);
  for (let i = 0; i < 6; i += 1) tracePins.push([3.1 + i, 9.6]);
  ctx.strokeStyle = 'rgba(200,245,255,0.08)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  tracePins.forEach(([lx, lz], i) => {
    if (i % 3 === 2) return; // hanya ±2/3 pin berjejak agar tidak ramai
    const [sx, sy] = toPx(lx, lz);
    const inward = lz < 0 ? 1 : -1; // arah menuju tengah board (sumbu z)
    const startY = sy + inward * 0.9 * PXU;
    const [endX] = toPx(lx * 0.3, 0);
    const [, endY] = toPx(0, lz * 0.35);
    ctx.beginPath();
    ctx.moveTo(sx, startY);
    ctx.lineTo(sx, endY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.arc(sx, endY, 0.09 * PXU, 0, Math.PI * 2);
    ctx.fill();
  });

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

  // Label "ON" untuk LED daya di dekat jack barrel (LED 3D di [−8.6, 8.35];
  // teks ditaruh tepat ke arah tengah board dari LED-nya).
  ctx.font = '600 21px "JetBrains Mono", monospace';
  const [onX, onY] = toPx(-8.6, 7.5);
  ctx.fillText('ON', onX, onY);

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

/**
 * Cetakan muka atas DIP ATmega328P via helper label resmi: titik pin-1
 * di ujung takik + teks tipe seperti ukiran laser aslinya (abu terang
 * di atas hitam #1B1B1F). Kanvas memetakan seluruh muka atas chip;
 * sumbu x kanvas = sumbu x chip (ujung takik di kiri / −x).
 */
function createChipTopTexture(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      const ink = 'rgba(216,220,226,0.92)';
      ctx.fillStyle = ink;
      // Titik pin-1: lingkaran kecil dekat ujung takik (−x)
      ctx.beginPath();
      ctx.arc(width * 0.1, height / 2, height * 0.13, 0, Math.PI * 2);
      ctx.fill();
      // Teks tipe, dibaca sepanjang sumbu chip
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${Math.round(height * 0.2)}px Arial, sans-serif`;
      ctx.fillText('ATMEL', width * 0.56, height * 0.26);
      ctx.font = `700 ${Math.round(height * 0.34)}px Arial, sans-serif`;
      ctx.fillText('ATmega328P-PU', width * 0.56, height * 0.58);
      ctx.font = `500 ${Math.round(height * 0.16)}px Arial, sans-serif`;
      ctx.fillText('2341', width * 0.56, height * 0.84);
    },
    { width: 1024, height: 256 },
  );
}

/**
 * Badan DIP-28 sebagai extrude dari outline tampak atas: persegi dengan
 * TAKIK setengah lingkaran sungguhan di ujung pin-1 (−x) + bevel halus
 * di semua tepi (SPESIFIKASI §2.3), menggantikan box polos lama.
 */
function createDipBodyGeometry(): THREE.ExtrudeGeometry {
  const L = 6; // setengah panjang (total 12)
  const W = 1.4; // setengah lebar (total 2.8)
  const R = 0.55; // radius takik
  const shape = new THREE.Shape();
  shape.moveTo(-L, -W);
  shape.lineTo(L, -W);
  shape.lineTo(L, W);
  shape.lineTo(-L, W);
  shape.lineTo(-L, R);
  // Busur menggigit ke DALAM badan (lewat titik (−L+R, 0))
  shape.absarc(-L, 0, R, Math.PI / 2, Math.PI * 1.5, true);
  shape.lineTo(-L, -W);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.7,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 24,
  });
  // Shape XY (x = panjang chip, y = lebar) → alas XZ, extrude → +y
  geometry.rotateX(-Math.PI / 2);
  return geometry;
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
  const holesRef = useRef<THREE.InstancedMesh>(null);
  const silkscreen = useMemo(createSilkscreenTexture, []);
  const chipTop = useMemo(createChipTopTexture, []);
  const dipGeometry = useMemo(createDipBodyGeometry, []);
  const headerPositions = useMemo(buildHeaderPositions, []);
  const headerGeometry = useMemo(() => new THREE.BoxGeometry(0.9, 1.1, 0.9), []);
  const headerMaterial = useMemo(() => createMaterial3D('plastikHitam'), []);
  // Lubang soket: cakram gelap kecil di permukaan atas tiap header betina
  const holeGeometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), []);
  const holeMaterial = useMemo(
    () => createMaterial3D('plastikHitam', { color: '#050506', roughness: 0.85 }),
    [],
  );

  useEffect(
    () => () => {
      chipTop.dispose();
      dipGeometry.dispose();
    },
    [chipTop, dipGeometry],
  );

  useLayoutEffect(() => {
    const mesh = headersRef.current;
    if (!mesh) return;
    const holes = holesRef.current;
    const dummy = new THREE.Object3D();
    headerPositions.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (holes) {
        dummy.position.set(x, y + 0.57, z); // tepat di permukaan atas header
        dummy.updateMatrix();
        holes.setMatrixAt(index, dummy.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (holes) holes.instanceMatrix.needsUpdate = true;
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
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={COLOR_TOKENS.unoTeal} />
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

      {/* Lubang soket di permukaan atas tiap header betina */}
      <instancedMesh
        ref={holesRef}
        args={[holeGeometry, holeMaterial, headerPositions.length]}
      />

      {/* Port USB-B (perak) di tepi kiri: cangkang + bibir gulung di muka
          luar, bukaan gelap dengan lidah konektor, dua lubang pengait
          di permukaan atas — seperti konektor USB-B asli */}
      <group position={[-12.2, 1.9, -5]}>
        <mesh castShadow>
          <boxGeometry args={[4.6, 3.2, 5]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
        {/* Bibir/flensa gulung di muka luar (−x) */}
        <mesh position={[-2.42, 0, 0]} castShadow>
          <boxGeometry args={[0.4, 3.5, 5.3]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
        {/* Bukaan konektor: pelat gelap + lidah plastik di tengahnya */}
        <mesh position={[-2.64, 0, 0]}>
          <boxGeometry args={[0.06, 2, 3.8]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.plastikHitam}
            color="#0a0a0c"
            roughness={0.9}
          />
        </mesh>
        <mesh position={[-2.68, 0, 0]}>
          <boxGeometry args={[0.06, 0.6, 3]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color="#3a3d45" />
        </mesh>
        {/* Dua lubang pengait pegas di atas cangkang */}
        {[-1.3, 1.3].map((dz) => (
          <mesh key={dz} position={[0, 1.62, dz]}>
            <boxGeometry args={[1, 0.1, 1]} />
            <meshPhysicalMaterial
              {...MATERIAL_PROPS.plastikHitam}
              color="#26282e"
              roughness={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* Jack barrel DC: housing kotak hitam di tepi board dengan lubang
          menghadap SAMPING (keluar board, −x) seperti aslinya — bukan
          silinder berdiri berlubang di atas seperti versi lama */}
      <group position={[-11.9, 0, 7]}>
        <RoundedBox
          args={[3, 2.8, 3.8]}
          radius={0.25}
          smoothness={4}
          position={[0, PCB_TOP_Y + 1.4, 0]}
          castShadow
        >
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </RoundedBox>
        {/* Bezel cincin di muka luar */}
        <mesh position={[-1.56, PCB_TOP_Y + 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[1, 1, 0.3, 24]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color="#26282e" />
        </mesh>
        {/* Lubang jack gelap */}
        <mesh position={[-1.6, PCB_TOP_Y + 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.78, 0.78, 0.34, 24]} />
          <meshPhysicalMaterial
            {...MATERIAL_PROPS.plastikHitam}
            color="#060607"
            roughness={0.95}
          />
        </mesh>
        {/* Pin tengah konduktor di dalam lubang */}
        <mesh position={[-1.62, PCB_TOP_Y + 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.16, 0.16, 0.5, 12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      </group>

      {/* LED daya hijau kecil di dekat jack, berlabel "ON" di silkscreen */}
      <mesh position={[-8.6, PCB_TOP_Y + 0.13, 8.35]}>
        <boxGeometry args={[0.55, 0.26, 0.55]} />
        <meshStandardMaterial
          color="#0d3a1c"
          emissive={COLOR_TOKENS.ledGreen}
          emissiveIntensity={1.6}
          roughness={0.4}
        />
      </mesh>

      {/* Soket DIP di bawah chip ATmega */}
      <mesh position={[3.5, PCB_TOP_Y + 0.13, 0]} castShadow>
        <boxGeometry args={[12.5, 0.26, 3.3]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color="#101014" />
      </mesh>

      {/* Chip ATmega328P: badan extrude bertakik + cetakan muka atas */}
      <mesh geometry={dipGeometry} position={[3.5, PCB_TOP_Y + 0.26, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, PCB_TOP_Y + 1.02, 0]}>
        <planeGeometry args={[11.6, 2.5]} />
        <meshBasicMaterial map={chipTop} transparent depthWrite={false} />
      </mesh>

      {/* Kristal osilator (perak kecil) */}
      <mesh position={[-3.4, 0.95, 3.4]} castShadow>
        <boxGeometry args={[2, 0.7, 1.4]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Dua kapasitor elektrolit + tutup aluminium berskor */}
      {[
        [-9.4, 1.6],
        [-9.4, 4.6],
      ].map(([cx, cz]) => (
        <group key={cz} position={[cx, 0, cz]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 2.4, 24]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color="#23252b" />
          </mesh>
          <mesh position={[0, 2.72, 0]}>
            <cylinderGeometry args={[1.02, 1.02, 0.08, 24]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
          </mesh>
        </group>
      ))}

      {/* Tombol reset: frame + plunger bundar merah di tengahnya */}
      <mesh position={[-11.8, 1.1, -9]} castShadow>
        <boxGeometry args={[2, 1, 2]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      <mesh position={[-11.8, 1.8, -9]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 0.4, 20]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={COLOR_TOKENS.cableRed} />
      </mesh>
    </group>
  );
}
