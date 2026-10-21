import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { BoardDefinition } from '../../../shared/boards/definitions';

/**
 * Model 3D generik untuk board non-Uno (ESP32 DevKit, NodeMCU ESP8266,
 * Raspberry Pi Pico). Murni dari props BoardDefinition — tanpa store.
 * Pola visual mengikuti UnoBoard: PCB RoundedBox, silkscreen CanvasTexture
 * prosedural, header InstancedMesh, aksen metalik untuk USB/modul.
 *
 * Konvensi koordinat lokal: PCB setebal 1.2 dengan permukaan atas di
 * y = 1.2; header duduk di y = 1.15 (sama seperti definisi pin);
 * z negatif = tepi atas board (sisi USB).
 */

const PCB_HEIGHT = 1.2;
const HEADER_Y = 1.15;
const PX_PER_UNIT = 46;

/** Peta koordinat lokal pin → piksel canvas (linear dari ukuran PCB). */
function createSilkscreenTexture(definition: BoardDefinition): THREE.CanvasTexture {
  const [w, d] = definition.size;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * PX_PER_UNIT);
  canvas.height = Math.round(d * PX_PER_UNIT);
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const toPx = (lx: number, lz: number): [number, number] => [
    (lx / w + 0.5) * canvas.width,
    (lz / d + 0.5) * canvas.height,
  ];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Jejak PCB (traces) samar di bawah silkscreen: jalur siku (Manhattan)
  // dari sekitar sebagian pin menuju tengah board + titik via gelap.
  // Deterministik dari indeks pin; digambar SEBELUM label agar label
  // putih tetap paling terbaca.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = Math.max(2, Math.round(0.07 * PX_PER_UNIT));
  ctx.lineCap = 'round';
  definition.pins.forEach((pin, i) => {
    if (i % 3 === 2) return; // hanya ±2/3 pin berjejak agar tidak ramai
    const [sx, sy] = toPx(pin.local[0], pin.local[2]);
    const inward = pin.local[0] < 0 ? 1 : -1;
    const midX = sx + inward * (((i % 4) + 2) * 0.35 * PX_PER_UNIT);
    const [cx, cy] = toPx(0, pin.local[2] * 0.4);
    ctx.beginPath();
    ctx.moveTo(sx + inward * 0.8 * PX_PER_UNIT, sy);
    ctx.lineTo(midX, sy);
    ctx.lineTo(midX, cy);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.arc(midX, cy, 0.09 * PX_PER_UNIT, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = 'rgba(255,255,255,0.92)';

  // Label tiap pin, digambar ke arah tengah board agar tidak tertutup header
  ctx.font = `600 ${Math.round(0.52 * PX_PER_UNIT)}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'middle';
  for (const pin of definition.pins) {
    const [cx, cy] = toPx(pin.local[0], pin.local[2]);
    if (pin.local[0] < 0) {
      ctx.textAlign = 'left';
      ctx.fillText(pin.label, cx + 0.55 * PX_PER_UNIT, cy);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(pin.label, cx - 0.55 * PX_PER_UNIT, cy);
    }
  }

  // Nama board besar — digeser ke bawah komponen tengah (modul/chip)
  // supaya tetap terbaca: ESP32/NodeMCU bermodul kaleng, Pico berchip.
  const nameZ =
    definition.id === 'pico' ? 4.6 : definition.id === 'nodemcu' ? 2.4 : 2.2;
  const [nx, ny] = toPx(0, nameZ);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(0.72 * PX_PER_UNIT)}px "JetBrains Mono", monospace`;
  ctx.fillText(definition.name.toUpperCase(), nx, ny);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const METAL = { color: '#c0c4cc', metalness: 0.9, roughness: 0.35 } as const;

function UsbPort({ z }: { z: number }) {
  return (
    <mesh position={[0, PCB_HEIGHT + 0.5, z]} castShadow>
      <boxGeometry args={[4.5, 1, 3]} />
      <meshStandardMaterial {...METAL} />
    </mesh>
  );
}

function PowerLed({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.6, 0.25, 0.6]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        roughness={0.4}
      />
    </mesh>
  );
}

/** Ciri khas ESP32 DevKit: modul kaleng perak + tombol EN/BOOT. */
function Esp32Features({ depth }: { depth: number }) {
  const usbZ = -depth / 2 + 1.2;
  return (
    <group>
      <UsbPort z={usbZ} />
      {/* Modul kaleng perak di tengah-atas */}
      <mesh position={[0, PCB_HEIGHT + 0.4, -5.5]} castShadow>
        <boxGeometry args={[7, 0.8, 9]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Area label lebih terang di atas modul */}
      <mesh position={[0, PCB_HEIGHT + 0.83, -5.5]}>
        <boxGeometry args={[5.6, 0.06, 7.2]} />
        <meshStandardMaterial color="#dde1e6" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Tombol EN / BOOT di tepi bawah modul */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, PCB_HEIGHT + 0.25, -0.2]} castShadow>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
          <meshStandardMaterial color="#2a2a2e" roughness={0.5} />
        </mesh>
      ))}
      <PowerLed position={[2.4, PCB_HEIGHT + 0.13, usbZ + 0.4]} color="#ff2a2a" />
    </group>
  );
}

/** Ciri khas NodeMCU: modul perak lebih kecil + area antena tembaga. */
function NodeMcuFeatures({ depth }: { depth: number }) {
  const usbZ = -depth / 2 + 1.2;
  return (
    <group>
      <UsbPort z={usbZ} />
      <mesh position={[0, PCB_HEIGHT + 0.4, -4.5]} castShadow>
        <boxGeometry args={[6.5, 0.8, 8]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      {/* Antena PCB: bidang tembaga tipis di ujung atas modul */}
      <mesh position={[0, PCB_HEIGHT + 0.85, -7.6]}>
        <boxGeometry args={[5.5, 0.1, 1.8]} />
        <meshStandardMaterial color="#b87333" metalness={0.7} roughness={0.45} />
      </mesh>
      <PowerLed position={[2.4, PCB_HEIGHT + 0.13, usbZ + 0.4]} color="#ff2a2a" />
    </group>
  );
}

/** Ciri khas Pico: tanpa modul — chip RP2040 + kristal + LED hijau. */
function PicoFeatures({ depth }: { depth: number }) {
  const usbZ = -depth / 2 + 1.2;
  return (
    <group>
      <UsbPort z={usbZ} />
      <mesh position={[0, PCB_HEIGHT + 0.35, -1]} castShadow>
        <boxGeometry args={[4, 0.7, 4]} />
        <meshStandardMaterial color="#17181c" roughness={0.45} />
      </mesh>
      {/* Kristal perak di samping chip */}
      <mesh position={[3.1, PCB_HEIGHT + 0.25, -1]} castShadow>
        <boxGeometry args={[1.6, 0.5, 1.1]} />
        <meshStandardMaterial {...METAL} />
      </mesh>
      <PowerLed position={[2.2, PCB_HEIGHT + 0.13, usbZ + 0.6]} color="#22ff66" />
    </group>
  );
}

export default function GenericBoard({ definition }: { definition: BoardDefinition }) {
  const [w, d] = definition.size;
  const silkscreen = useMemo(() => createSilkscreenTexture(definition), [definition]);

  const baseRef = useRef<THREE.InstancedMesh>(null);
  const pinRef = useRef<THREE.InstancedMesh>(null);
  const baseGeometry = useMemo(() => new THREE.BoxGeometry(0.55, 0.9, 0.55), []);
  const baseMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#26262b', roughness: 0.6 }),
    [],
  );
  const pinGeometry = useMemo(() => new THREE.BoxGeometry(0.2, 0.5, 0.2), []);
  const pinMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9ccd4', metalness: 0.85, roughness: 0.3 }),
    [],
  );

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const bases = baseRef.current;
    const pins = pinRef.current;
    definition.pins.forEach((pin, index) => {
      if (bases) {
        dummy.position.set(pin.local[0], HEADER_Y, pin.local[2]);
        dummy.updateMatrix();
        bases.setMatrixAt(index, dummy.matrix);
      }
      if (pins) {
        dummy.position.set(pin.local[0], HEADER_Y + 0.45 + 0.25, pin.local[2]);
        dummy.updateMatrix();
        pins.setMatrixAt(index, dummy.matrix);
      }
    });
    if (bases) bases.instanceMatrix.needsUpdate = true;
    if (pins) pins.instanceMatrix.needsUpdate = true;
  }, [definition]);

  const mountHoles: Array<[number, number]> = [
    [-(w / 2 - 0.9), -(d / 2 - 0.9)],
    [w / 2 - 0.9, -(d / 2 - 0.9)],
    [-(w / 2 - 0.9), d / 2 - 0.9],
    [w / 2 - 0.9, d / 2 - 0.9],
  ];

  return (
    <group position={definition.origin}>
      {/* PCB */}
      <RoundedBox
        args={[w, PCB_HEIGHT, d]}
        radius={0.15}
        smoothness={4}
        position={[0, PCB_HEIGHT / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color={definition.pcbColor} clearcoat={0.6} roughness={0.3} />
      </RoundedBox>

      {/* Lubang pemasangan di 4 sudut + sekrup metal berkepala slot minus */}
      {mountHoles.map(([x, z], i) => (
        <group key={`${x}:${z}`} position={[x, 0, z]}>
          <mesh position={[0, PCB_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[0.32, 0.32, PCB_HEIGHT + 0.06, 16]} />
            <meshStandardMaterial color="#0b0b0d" roughness={0.7} />
          </mesh>
          {/* Kepala sekrup: cakram metal di permukaan PCB */}
          <mesh position={[0, PCB_HEIGHT + 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.09, 20]} />
            <meshStandardMaterial color="#c0c4cc" metalness={0.9} roughness={0.35} />
          </mesh>
          {/* Slot minus di kepala sekrup (sudut bervariasi per sudut) */}
          <mesh
            position={[0, PCB_HEIGHT + 0.09, 0]}
            rotation={[0, ((i * 47) % 180) * (Math.PI / 180), 0]}
          >
            <boxGeometry args={[0.42, 0.03, 0.09]} />
            <meshStandardMaterial color="#3a3d45" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Silkscreen: label pin + nama board */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PCB_HEIGHT + 0.01, 0]}>
        <planeGeometry args={[w - 0.4, d - 0.4]} />
        <meshBasicMaterial map={silkscreen} transparent depthWrite={false} />
      </mesh>

      {/* Header: alas plastik + pin metal (InstancedMesh) */}
      <instancedMesh
        ref={baseRef}
        args={[baseGeometry, baseMaterial, definition.pins.length]}
        castShadow
      />
      <instancedMesh
        ref={pinRef}
        args={[pinGeometry, pinMaterial, definition.pins.length]}
        castShadow
      />

      {definition.id === 'esp32' && <Esp32Features depth={d} />}
      {definition.id === 'nodemcu' && <NodeMcuFeatures depth={d} />}
      {definition.id === 'pico' && <PicoFeatures depth={d} />}
    </group>
  );
}
