import { useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { ComponentRenderProps } from '../../../types';
import { moistureOf } from './electrical';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
} from '../../../../features/stage3d/gizmos/throttledCommit';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3/§4): papan & garpu = kelas pcb warna
 * biru modul, badan chip & rumah header = kelas plastikHitam, pin &
 * elektroda = kelas metalPin (emas via override warna), trimpot =
 * kelas absWarna. Emas elektroda/pin, kuningan sekrup, dan merah
 * insulasi kabel memakai token COLOR_TOKENS (goldPlated, goldTrace,
 * brassScrew, cableRed).
 */
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
} from '../../../../features/stage3d/materials3d';

/** Posisi kaki header sesuai pin elektrik: VCC (-1), AO (0), GND (+1) pada sumbu Z. */
const LEG_Z = [-1, 0, 1] as const;

/** Jarak seret vertikal (px) untuk rentang kelembaban penuh 0 → 1. */
const DRAG_PIXELS_FULL_RANGE = 120;

/**
 * Silkscreen putih permukaan modul (prosedural, pola sama seperti
 * UnoBoard): nama modul "FC-28", label pin VCC/AO/GND di tepi header,
 * label LED PWR/OUT, dan kotak garis bantu di sekitar chip & trimpot —
 * persis cetakan modul komparator asli. Teks memakai istilah persis
 * benda aslinya (UX-writing: terminologi nyata, tanpa label karangan).
 */
function createModuleSilkscreen(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 622;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = 'rgba(248,250,252,0.85)';
    ctx.lineWidth = 3;
    // Pemetaan dunia→kanvas untuk bidang atas papan 2,8 × 3,4
    // (kanvas atas ↔ -z, kanvas kiri ↔ -x setelah rotasi bidang -π/2).
    const u = (x: number) => ((x / 2.8 + 0.5) * canvas.width) | 0;
    const v = (z: number) => ((0.5 + z / 3.4) * canvas.height) | 0;
    // Kotak garis bantu mengitari chip LM393 & lingkaran trimpot.
    ctx.strokeRect(u(-0.2), v(-1.3), u(1.3) - u(-0.2), v(-0.2) - v(-1.3));
    ctx.beginPath();
    ctx.arc(u(-0.65), v(0.75), 87, 0, Math.PI * 2);
    ctx.stroke();
    // Nama modul di tepi papan yang kosong.
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FC-28', 40, 585);
    // Label LED di samping masing-masing LED.
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('PWR', u(0.62), v(-1.42));
    ctx.fillText('OUT', u(0.62), v(1.08));
    // Label pin header, satu per pin, dibaca memanjang papan.
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    const pinLabels: Array<[string, number]> = [
      ['VCC', -1],
      ['AO', 0],
      ['GND', 1],
    ];
    for (const [text, z] of pinLabels) {
      ctx.save();
      ctx.translate(u(1.22), v(z));
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(text, 0, 12);
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Cetakan atas chip LM393: nama tipe + titik penanda pin 1. */
function createChipPrint(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 174;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d4d4d8';
    ctx.font = 'bold 62px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LM393', 128, 108);
    // Titik pin 1 di sudut.
    ctx.beginPath();
    ctx.arc(34, 34, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Geometri satu gigi garpu probe: pelat pipih memanjang dengan ujung
 * lancip (outline diextrude setebal 0,12) — siluet PCB FC-28 asli,
 * bukan lempengan logam tebal. Sumbu bentuk: x = lebar gigi (→ sumbu Z
 * dunia setelah rotasi), y = tinggi (0 di ujung lancip, 2,4 di pangkal).
 */
function createProngGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 2.4);
  shape.lineTo(0.62, 2.4);
  shape.lineTo(0.62, 0.55);
  shape.lineTo(0, 0);
  shape.lineTo(-0.62, 0.55);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: false,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-0.06, 0, 0);
  return geometry;
}

/**
 * Sensor kelembaban tanah gaya FC-28 (SPESIFIKASI-GAYA-3D §5 Gelombang 1):
 * dua bagian terpisah seperti benda aslinya —
 * (1) modul komparator 30×15 di atas breadboard: papan biru bersilkscreen
 *     "FC-28", chip LM393 bercetak + titik pin 1, trimpot biru bersekrup
 *     kuningan, LED PWR merah & LED OUT amber (menyala saat tanah basah),
 *     3 pin header emas tepat di titik pin elektrik;
 * (2) garpu probe PCB pipih berlapis emas di bawah, tersambung dua kabel
 *     pendek ke modul. Blok "tanah" rekaan model lama DIHAPUS total.
 * Interaksi tidak berubah: seret papan ke atas/bawah mengubah kelembaban
 * (commit ter-throttle pola gizmos/throttledCommit; flush saat lepas).
 */
export const SoilMoistureRender3D: ComponentType<ComponentRenderProps> = ({
  instance,
  onInteract,
}) => {
  const moisture = moistureOf(instance);
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const setDragging3D = useCircuitStore((s) => s.setDragging3D);

  const silkscreen = useMemo(createModuleSilkscreen, []);
  const chipPrint = useMemo(createChipPrint, []);
  const prongGeometry = useMemo(createProngGeometry, []);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDragging3D?.(true);
    const startY = e.clientY;
    const startMoisture = moisture;
    // Commit ter-throttle ±33 ms (pola bersama gizmos/throttledCommit) —
    // pointermove mentah membanjiri solver & membuat gizmo berkedip
    // (audit flicker 2026-10-21); nilai akhir di-flush saat lepas.
    const commit = createThrottledCaller<[Record<string, unknown>]>(
      (patch) => onInteract(patch),
      INTERACT_COMMIT_INTERVAL_MS,
    );
    const onMove = (ev: PointerEvent) => {
      const next = Math.min(
        1,
        Math.max(0, startMoisture + (ev.clientY - startY) / DRAG_PIXELS_FULL_RANGE),
      );
      commit.call({ moisture: next });
    };
    const onUp = () => {
      commit.flush();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragging3D?.(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga pin header emas menuju titik pin elektrik (bidang y=0) */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.48, z]} castShadow>
          <boxGeometry args={[0.18, 0.95, 0.18]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldPlated} roughness={0.35} />
        </mesh>
      ))}
      {/* Rumah plastik hitam header tepat di bawah papan */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <boxGeometry args={[0.5, 0.2, 2.9]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>

      {/* Papan modul komparator biru */}
      <RoundedBox
        args={[2.8, 0.28, 3.4]}
        radius={0.09}
        smoothness={4}
        position={[0, 1.09, 0]}
        castShadow
        onPointerDown={handlePointerDown}
      >
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color="#2470e0" />
      </RoundedBox>
      {/* Silkscreen putih di permukaan atas papan */}
      <mesh position={[0, 1.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 3.4]} />
        <meshStandardMaterial
          map={silkscreen}
          transparent
          roughness={0.5}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Chip LM393 (SOIC-8): badan hitam bertepi bevel, 8 kaki pipih,
          cetakan nama + titik pin 1 di permukaan atas */}
      <group position={[0.55, 0, -0.75]}>
        <RoundedBox args={[1.25, 0.32, 0.85]} radius={0.06} smoothness={4} position={[0, 1.39, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
        </RoundedBox>
        {([-0.45, -0.15, 0.15, 0.45] as const).map((dx) =>
          ([-1, 1] as const).map((side) => (
            <mesh key={`chipleg-${dx}-${side}`} position={[dx, 1.27, side * 0.52]} castShadow>
              <boxGeometry args={[0.18, 0.07, 0.3]} />
              <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldPlated} roughness={0.35} />
            </mesh>
          )),
        )}
        <mesh position={[0, 1.555, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.25, 0.85]} />
          <meshStandardMaterial map={chipPrint} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      </group>

      {/* Trimpot biru bersekrup kuningan beralur */}
      <group position={[-0.65, 0, 0.75]}>
        <RoundedBox args={[0.95, 0.5, 0.95]} radius={0.06} smoothness={4} position={[0, 1.48, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color="#2470e0" />
        </RoundedBox>
        <mesh position={[0, 1.75, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.09, 20]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.brassScrew} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[0.42, 0.03, 0.1]} />
          <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} roughness={0.6} />
        </mesh>
      </group>

      {/* Dua komponen pasif kecil (resistor 0805) pengisi papan */}
      {([
        { x: 0.1, z: -1.32 },
        { x: 1.12, z: -0.05 },
      ] as const).map(({ x, z }) => (
        <mesh key={`passive-${x}-${z}`} position={[x, 1.3, z]} castShadow>
          <boxGeometry args={[0.42, 0.14, 0.24]} />
          <meshStandardMaterial color={COLOR_TOKENS.keramikKrem} roughness={0.55} />
        </mesh>
      ))}

      {/* LED PWR merah (selalu menyala) & LED OUT amber (menyala saat basah) */}
      <group position={[1.08, 0, -1.25]}>
        <mesh position={[0, 1.36, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.9} />
        </mesh>
      </group>
      <group position={[1.08, 0, 1.25]}>
        <mesh position={[0, 1.36, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.17, 0.26, 16]} />
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={moisture > 0.5 ? 0.9 : 0.12}
          />
        </mesh>
      </group>

      {/* Dua kabel pendek penghubung modul ↔ garpu probe (merah & hitam) */}
      {([
        { x: -0.45, color: COLOR_TOKENS.cableRed },
        { x: 0.45, color: COLOR_TOKENS.karetGelap },
      ] as const).map(({ x, color }) => (
        <mesh key={`wire-${x}`} position={[x, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.95, 8]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      ))}

      {/* Palang pangkal garpu (PCB biru) + dua lubang pemasangan */}
      <RoundedBox args={[1.9, 0.25, 1.5]} radius={0.07} smoothness={4} position={[0, -0.15, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color="#2470e0" />
      </RoundedBox>
      {([-0.6, 0.6] as const).map((x) => (
        <mesh key={`hole-${x}`} position={[x, -0.15, 0.45]}>
          <cylinderGeometry args={[0.13, 0.13, 0.27, 16]} />
          <meshStandardMaterial color={COLOR_TOKENS.plastikHitam} roughness={0.9} />
        </mesh>
      ))}

      {/* Dua gigi garpu: pelat PCB biru pipih berujung lancip, dilapisi
          elektroda emas di kedua muka bagian bawah + garis jalur tengah */}
      {([-0.6, 0.6] as const).map((x) => (
        <group key={`prong-${x}`} position={[x, 0, 0]}>
          <mesh geometry={prongGeometry} position={[0, -2.62, 0]} castShadow>
            <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color="#2470e0" />
          </mesh>
          {([-1, 1] as const).map((face) => (
            <group key={`gold-${face}`}>
              <mesh position={[face * 0.075, -1.35, 0]} castShadow>
                <boxGeometry args={[0.03, 1.35, 1.02]} />
                <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldPlated} roughness={0.35} />
              </mesh>
              <mesh position={[face * 0.078, -1.35, 0]}>
                <boxGeometry args={[0.032, 1.35, 0.09]} />
                <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color={COLOR_TOKENS.goldTrace} roughness={0.45} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Panel gizmo kelembapan saat sensor terpilih */}
      {selected && (
        <SensorGizmo3D
          position={[0, 3.2, 0]}
          label="Kelembapan"
          value={Math.round(moisture * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => onInteract({ moisture: v / 100 })}
        />
      )}
    </group>
  );
};
