import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { BoardDefinition } from '../../../shared/boards/definitions';
import {
  MATERIAL_PROPS,
  createMaterial3D,
} from '../materials3d';
import { createLabelTexture } from '../labelTexture';

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

/**
 * Tekstur pola antena PCB: jalur meander tembaga prosedural (helper label
 * resmi) di atas tab substrat modul — ciri antena modul WROOM / ESP-12
 * asli, bukan bidang tembaga datar polos.
 */
function createAntennaTexture(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(205,150,80,0.95)';
      ctx.lineWidth = Math.round(h * 0.13);
      ctx.lineCap = 'square';
      const top = h * 0.24;
      const bottom = h * 0.76;
      const seg = w / 9;
      ctx.beginPath();
      ctx.moveTo(seg * 0.4, top);
      let y = top;
      for (let i = 0; i < 8; i += 1) {
        const x = seg * (0.4 + i + 1);
        ctx.lineTo(x, y);
        y = y === top ? bottom : top;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    { width: 512, height: 128 },
  );
}

/**
 * Tab antena: lempeng substrat gelap menjulur dari ujung kaleng modul ke
 * tepi board dengan pola meander tembaga di muka atasnya.
 */
function AntennaTab({
  z,
  width,
  depth,
}: {
  z: number;
  width: number;
  depth: number;
}) {
  const texture = useMemo(createAntennaTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, PCB_HEIGHT + 0.065, 0]}>
        <boxGeometry args={[width, 0.13, depth]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PCB_HEIGHT + 0.14, 0]}>
        <planeGeometry args={[width - 0.2, depth - 0.2]} />
        <meshStandardMaterial
          map={texture}
          transparent
          metalness={0.55}
          roughness={0.4}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

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

interface ModuleLabelConfig {
  title: string;
  sub: string;
  fcc: string;
  vendor: string;
}

/**
 * Cetakan di atas kaleng modul RF (helper label resmi): nama modul,
 * model, FCC ID, vendor, blok QR-ish prosedural, dan dua kotak
 * sertifikasi — meniru kaleng ESP-WROOM-32 / ESP-12E asli yang padat
 * teks, menggantikan pelat perak polos lama.
 */
function createModuleLabelTexture(cfg: ModuleLabelConfig): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#dde1e6';
      ctx.fillRect(0, 0, w, h);
      const ink = '#41474f';
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${Math.round(w * 0.105)}px Arial, sans-serif`;
      ctx.fillText(cfg.title, w * 0.07, h * 0.15);
      ctx.font = `600 ${Math.round(w * 0.06)}px Arial, sans-serif`;
      ctx.fillText(cfg.sub, w * 0.07, h * 0.245);
      ctx.font = `500 ${Math.round(w * 0.052)}px Arial, sans-serif`;
      ctx.fillText(cfg.fcc, w * 0.07, h * 0.325);
      ctx.fillText('ISM 2.4G 802.11 b/g/n', w * 0.07, h * 0.395);

      // Blok QR-ish deterministik di kanan atas
      const cell = w * 0.03;
      const ox = w * 0.68;
      const oy = h * 0.055;
      for (let r = 0; r < 9; r += 1) {
        for (let c = 0; c < 9; c += 1) {
          const corner = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
          if (corner || (r * 7 + c * 13 + r * c) % 5 < 2) {
            ctx.fillRect(ox + c * cell, oy + r * cell, cell * 0.92, cell * 0.92);
          }
        }
      }

      // Dua kotak sertifikasi ala cetakan kaleng asli
      ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.07, h * 0.48, w * 0.16, w * 0.16);
      ctx.strokeRect(w * 0.28, h * 0.48, w * 0.16, w * 0.16);
      ctx.font = `700 ${Math.round(w * 0.068)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('CE', w * 0.15, h * 0.48 + w * 0.112);
      ctx.fillText('FC', w * 0.36, h * 0.48 + w * 0.112);

      ctx.textAlign = 'left';
      ctx.font = `600 ${Math.round(w * 0.055)}px Arial, sans-serif`;
      ctx.fillText(cfg.vendor, w * 0.07, h * 0.76);
      ctx.font = `500 ${Math.round(w * 0.046)}px Arial, sans-serif`;
      ctx.fillText('SN: 24:6F:28:1A:2B:3C', w * 0.07, h * 0.83);
    },
    { width: 512, height: 640 },
  );
}

/**
 * Konektor micro-USB berbentuk: cangkang metal membulat + bibir di muka
 * luar + bukaan gelap dengan lidah konektor — menggantikan pelat tipis
 * datar lama. `z` = posisi tengah cangkang; muka luar menghadap −z
 * (tepi board) dan sedikit menjorok keluar tepi seperti board asli.
 */
function MicroUsbPort({ z }: { z: number }) {
  return (
    <group position={[0, PCB_HEIGHT + 0.55, z]}>
      <RoundedBox args={[3, 1.1, 2.3]} radius={0.18} smoothness={4} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </RoundedBox>
      {/* Bibir cangkang di muka luar */}
      <mesh position={[0, 0, -1.22]}>
        <boxGeometry args={[3.3, 1.3, 0.28]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Bukaan konektor + lidah di tengahnya */}
      <mesh position={[0, 0, -1.38]}>
        <boxGeometry args={[2.3, 0.62, 0.1]} />
        <meshPhysicalMaterial
          {...MATERIAL_PROPS.plastikHitam}
          color="#0a0a0c"
          roughness={0.9}
        />
      </mesh>
      <mesh position={[0, 0, -1.42]}>
        <boxGeometry args={[2, 0.22, 0.08]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color="#3a3d45" />
      </mesh>
    </group>
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

/** Ciri khas ESP32 DevKit: modul kaleng perak berlabel + tombol EN/BOOT. */
function Esp32Features({ depth }: { depth: number }) {
  const usbZ = -depth / 2 + 1.05;
  const label = useMemo(
    () =>
      createModuleLabelTexture({
        title: 'ESP-WROOM-32',
        sub: 'MODEL: ESP32-WROOM-32',
        fcc: 'FCC ID: 2AC7Z-ESPWROOM32',
        vendor: 'ESPRESSIF SYSTEMS',
      }),
    [],
  );
  useEffect(() => () => label.dispose(), [label]);
  return (
    <group>
      <MicroUsbPort z={usbZ} />
      {/* Modul kaleng perak di tengah-atas */}
      <mesh position={[0, PCB_HEIGHT + 0.4, -5.5]} castShadow>
        <boxGeometry args={[7, 0.8, 9]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Cetakan label di atas kaleng modul */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PCB_HEIGHT + 0.82, -5.5]}>
        <planeGeometry args={[5.6, 7.2]} />
        <meshStandardMaterial map={label} metalness={0.5} roughness={0.45} />
      </mesh>
      {/* Tab antena PCB menjulur dari ujung kaleng ke tepi board */}
      <AntennaTab z={-10.95} width={6.2} depth={2} />
      {/* Tombol EN / BOOT di tepi bawah modul */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, PCB_HEIGHT + 0.25, -0.2]} castShadow>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </mesh>
      ))}
      <PowerLed position={[2.4, PCB_HEIGHT + 0.13, usbZ + 0.4]} color="#ff2a2a" />
    </group>
  );
}

/** Ciri khas NodeMCU: modul perak berlabel + antena PCB di tepi board. */
function NodeMcuFeatures({ depth }: { depth: number }) {
  const usbZ = -depth / 2 + 1.05;
  const label = useMemo(
    () =>
      createModuleLabelTexture({
        title: 'ESP-12E',
        sub: 'MODEL: ESP8266MOD',
        fcc: 'FCC ID: 2ADUIESP-12E',
        vendor: 'AI-THINKER',
      }),
    [],
  );
  useEffect(() => () => label.dispose(), [label]);
  return (
    <group>
      <MicroUsbPort z={usbZ} />
      <mesh position={[0, PCB_HEIGHT + 0.4, -4.5]} castShadow>
        <boxGeometry args={[6.5, 0.8, 8]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Cetakan label di atas kaleng modul */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PCB_HEIGHT + 0.82, -4.5]}>
        <planeGeometry args={[5.9, 7.3]} />
        <meshStandardMaterial map={label} metalness={0.5} roughness={0.45} />
      </mesh>
      {/* Tab antena PCB menjulur dari ujung kaleng ke tepi board —
          menggantikan bidang tembaga datar di atas kaleng versi lama */}
      <AntennaTab z={-9.25} width={6} depth={1.6} />
      <PowerLed position={[2.4, PCB_HEIGHT + 0.13, usbZ + 0.4]} color="#ff2a2a" />
    </group>
  );
}

/** Ciri khas Pico: tanpa modul — chip RP2040 + kristal + LED hijau. */
function PicoFeatures({ depth }: { depth: number }) {
  const usbZ = -depth / 2 + 1.05;
  return (
    <group>
      <MicroUsbPort z={usbZ} />
      <mesh position={[0, PCB_HEIGHT + 0.35, -1]} castShadow>
        <boxGeometry args={[4, 0.7, 4]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>
      {/* Kristal perak di samping chip */}
      <mesh position={[3.1, PCB_HEIGHT + 0.25, -1]} castShadow>
        <boxGeometry args={[1.6, 0.5, 1.1]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
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
  const castRef = useRef<THREE.InstancedMesh>(null);
  const baseGeometry = useMemo(() => new THREE.BoxGeometry(0.55, 0.9, 0.55), []);
  const baseMaterial = useMemo(
    () => createMaterial3D('plastikHitam', { color: '#26262b' }),
    [],
  );
  const pinGeometry = useMemo(() => new THREE.BoxGeometry(0.2, 0.5, 0.2), []);
  const pinMaterial = useMemo(() => createMaterial3D('metalPin'), []);
  // Castellation Pico: setengah lubang berlapis di kedua tepi panjang,
  // satu per posisi pin — ciri khas Pico yang tidak boleh hilang.
  const castGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.3, 0.3, PCB_HEIGHT + 0.06, 16),
    [],
  );
  const castMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.7 }),
    [],
  );
  const isPico = definition.id === 'pico';

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
    const casts = castRef.current;
    if (casts && isPico) {
      definition.pins.forEach((pin, index) => {
        dummy.position.set(
          Math.sign(pin.local[0]) * (w / 2),
          PCB_HEIGHT / 2,
          pin.local[2],
        );
        dummy.updateMatrix();
        casts.setMatrixAt(index, dummy.matrix);
      });
      casts.instanceMatrix.needsUpdate = true;
    }
  }, [definition, isPico, w]);

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
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={definition.pcbColor} />
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
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
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

      {/* Castellation di kedua tepi panjang (khusus Pico) */}
      {isPico && (
        <instancedMesh
          ref={castRef}
          args={[castGeometry, castMaterial, definition.pins.length]}
        />
      )}

      {definition.id === 'esp32' && <Esp32Features depth={d} />}
      {definition.id === 'nodemcu' && <NodeMcuFeatures depth={d} />}
      {definition.id === 'pico' && <PicoFeatures depth={d} />}
    </group>
  );
}
