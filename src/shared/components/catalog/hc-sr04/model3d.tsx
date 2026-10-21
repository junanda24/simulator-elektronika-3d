import { useMemo, type ComponentType, type CSSProperties } from 'react';
import * as THREE from 'three';
import { Html, RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';
import { useCircuitStore } from '../../../../features/wiring/store/circuitStore';
import { SensorGizmo3D } from '../../../../features/stage3d/gizmos/SensorGizmo3D';
import {
  DIST_MAX_CM,
  DIST_MIN_CM,
  distanceCmOf,
  noObstacleOf,
} from './electrical';

/**
 * HC-SR04 prosedural 1:1 (bab khusus riset §11.1; satuan proyek
 * 1 unit = 2,54 mm): PCB biru klasik 45 × 20 mm (17,72 × 7,87 unit,
 * tebal 1,6 mm) terbaring di atas breadboard, dua transduser TCT40-16
 * Ø16 mm (r 3,15) berdiri di muka board dengan muka jaring logam,
 * kristal perak di antara keduanya, header 4 pin lurus di tepi bawah.
 *
 * Jangkar elektrik (meta.ts) adalah deretan pin di x=0: VCC (−1,5),
 * TRIG (−0,5), ECHO (+0,5), GND (+1,5) pada sumbu Z — kaki header pada
 * model digambar PERSIS di koordinat itu, turun dari muka bawah PCB.
 * Sablon muka mengikuti board asli: "HC-SR04" + label pin di tepi
 * header dengan urutan fisik "Vcc Trig Echo Gnd".
 */

/** Biru PCB HC-SR04 klasik (warna benda asli setempat, bukan token fungsional). */
const PCB_BLUE = '#1e4f9c';
/** Tinta sablon putih board asli. */
const SILK_WHITE = '#f2f5f9';

/** Pusat PCB pada sumbu kedalaman: pin header (x=0) menempel di tepi +X board. */
const PCB_CENTER_X = -3.2;
/** Muka atas PCB (pusat y 0,85 + tebal 0,63/2). */
const PCB_TOP_Y = 1.17;
/** Pusat kedua tabung transduser pada sumbu panjang (jarak pusat ±9,5 mm). */
const TUBE_Z = 3.74;
/** Jari-jari tabung Ø16 mm. */
const TUBE_R = 3.15;

/** Posisi kaki header sesuai pin elektrik: VCC, TRIG, ECHO, GND. */
const LEG_Z = [-1.5, -0.5, 0.5, 1.5] as const;
const PIN_LABELS = ['Vcc', 'Trig', 'Echo', 'Gnd'] as const;

/**
 * Sablon muka PCB: judul modul besar, label pin di tepi header
 * (urutan fisik Vcc Trig Echo Gnd sejajar kaki di z −1,5…+1,5), dan
 * jejak samar. Bidang plane 7,87 × 17,72 unit → kanvas 512 × 1152.
 * Pemetaan mengikuti pola PIR: x kanvas = sumbu x lokal, y = sumbu z.
 */
function createHcSr04Silkscreen(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      const toPx = (lx: number, lz: number): [number, number] => [
        (lx / 7.87 + 0.5) * width,
        (lz / 17.72 + 0.5) * height,
      ];
      ctx.fillStyle = SILK_WHITE;
      ctx.strokeStyle = SILK_WHITE;
      ctx.textAlign = 'center';

      // Judul modul — cetakan wajib board asli.
      const [titleX, titleY] = toPx(PCB_CENTER_X, -6.4);
      ctx.font = '700 92px Arial, sans-serif';
      ctx.save();
      ctx.translate(titleX, titleY);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('HC-SR04', 0, 30);
      ctx.restore();

      // Label pin di tepi header: teks berjalan sejajar tepi, satu
      // label per kaki pada z pin-nya masing-masing.
      ctx.font = '600 44px Arial, sans-serif';
      LEG_Z.forEach((z, i) => {
        const [lx, ly] = toPx(0.55, z);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(PIN_LABELS[i], 0, 14);
        ctx.restore();
      });

      // Cincin solder di sekeliling tiap kaki header.
      ctx.strokeStyle = 'rgba(242,245,249,0.6)';
      ctx.lineWidth = 3;
      LEG_Z.forEach((z) => {
        const [cx, cy] = toPx(0, z);
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Jejak samar dari header menuju tengah board.
      ctx.strokeStyle = 'rgba(242,245,249,0.12)';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      LEG_Z.forEach((z) => {
        const [sx, sy] = toPx(0, z);
        const [ex, ey] = toPx(-2.4, z * 0.55);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
    },
    { width: 512, height: 1152 },
  );
}

/**
 * Tekstur muka jaring transduser: anyaman logam (garis silang rapat)
 * di atas cakram perak, dengan cakram tengah lebih gelap — pola muka
 * TCT40 asli sebagaimana terlihat di foto referensi riset.
 */
function createTransducerMeshTexture(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      ctx.fillStyle = '#c3c8cf';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(84,90,99,0.65)';
      ctx.lineWidth = 2;
      const step = 11;
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // Cakram tengah di balik jaring.
      const cx = width / 2;
      const cy = height / 2;
      ctx.fillStyle = 'rgba(70,76,84,0.85)';
      ctx.beginPath();
      ctx.arc(cx, cy, width * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(50,55,62,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, width * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    },
    { width: 256, height: 256 },
  );
}

const TOGGLE_PANEL_STYLE: CSSProperties = {
  background: '#12151C',
  border: '1px solid #282E3D',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#E5E7EB',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 12,
  lineHeight: 1.3,
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
  userSelect: 'none',
  pointerEvents: 'auto',
  whiteSpace: 'nowrap',
};

const TOGGLE_BUTTON_STYLE: CSSProperties = {
  background: 'transparent',
  border: '1px solid #3A4A63',
  borderRadius: 999,
  color: '#E5E7EB',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 12,
  padding: '3px 10px',
  cursor: 'pointer',
};

/** Satu tabung transduser: kaleng aluminium + bibir + muka jaring. */
const Transducer: ComponentType<{ z: number; meshTexture: THREE.CanvasTexture }> = ({
  z,
  meshTexture,
}) => (
  <group position={[PCB_CENTER_X, 0, z]}>
    {/* Ring pangkal tabung di muka PCB */}
    <mesh position={[0, PCB_TOP_Y + 0.12, 0]} castShadow>
      <cylinderGeometry args={[TUBE_R + 0.16, TUBE_R + 0.22, 0.28, 40]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={COLOR_TOKENS.karetGelap} />
    </mesh>
    {/* Kaleng aluminium Ø16 mm, tinggi ±10,4 mm di atas PCB */}
    <mesh position={[0, PCB_TOP_Y + 2.18, 0]} castShadow>
      <cylinderGeometry args={[TUBE_R, TUBE_R, 4.1, 40]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
    </mesh>
    {/* Bibir gulung di mulut tabung */}
    <mesh position={[0, PCB_TOP_Y + 4.28, 0]} castShadow>
      <cylinderGeometry args={[TUBE_R + 0.07, TUBE_R + 0.07, 0.22, 40]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
    </mesh>
    {/* Muka jaring logam */}
    <mesh position={[0, PCB_TOP_Y + 4.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[TUBE_R - 0.12, 40]} />
      <meshStandardMaterial map={meshTexture} roughness={0.55} metalness={0.4} />
    </mesh>
  </group>
);

export const HcSr04Render3D: ComponentType<ComponentRenderProps> = ({ instance, onInteract }) => {
  const selected = useCircuitStore((s) => s.selectedInstanceId === instance.id);
  const distanceCm = distanceCmOf(instance);
  const noObstacle = noObstacleOf(instance);
  const silkscreen = useMemo(createHcSr04Silkscreen, []);
  const meshTexture = useMemo(createTransducerMeshTexture, []);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Empat kaki header lurus menuju pin elektrik (x=0, z per meta) */}
      {LEG_Z.map((z) => (
        <mesh key={`leg-${z}`} position={[0, -0.18, z]} castShadow>
          <boxGeometry args={[0.22, 1.5, 0.22]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}
      {/* Blok plastik pangkal header di bawah tepi PCB */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.55, 0.4, 4.35]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </mesh>

      {/* PCB biru 45 × 20 mm */}
      <RoundedBox
        args={[7.87, 0.63, 17.72]}
        radius={0.12}
        smoothness={4}
        position={[PCB_CENTER_X, 0.85, 0]}
        castShadow
      >
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={PCB_BLUE} />
      </RoundedBox>
      {/* Sablon muka: HC-SR04 + label pin Vcc Trig Echo Gnd */}
      <mesh position={[PCB_CENTER_X, PCB_TOP_Y + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.87, 17.72]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} />
      </mesh>

      {/* Dua transduser Ø16 mm: pemancar & penerima (identik visual) */}
      <Transducer z={-TUBE_Z} meshTexture={meshTexture} />
      <Transducer z={TUBE_Z} meshTexture={meshTexture} />

      {/* Kristal perak 40 kHz di antara kedua tabung */}
      <mesh position={[PCB_CENTER_X, PCB_TOP_Y + 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.48, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
      </mesh>

      {/* Komponen kecil di muka board: IC pemroses + dua kapasitor SMD */}
      <RoundedBox args={[1.5, 0.22, 0.9]} radius={0.05} smoothness={4} position={[-5.9, PCB_TOP_Y + 0.11, -5.6]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </RoundedBox>
      {[-6.1, 6.1].map((z) => (
        <mesh key={`cap-${z}`} position={[-1.1, PCB_TOP_Y + 0.3, z]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.6, 18]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color={COLOR_TOKENS.karetGelap} />
        </mesh>
      ))}

      {/* Panel gizmo saat modul terpilih: slider jarak + toggle tanpa rintangan */}
      {selected && (
        <SensorGizmo3D
          position={[PCB_CENTER_X, 8.6, 0]}
          label="Jarak rintangan"
          value={Math.round(distanceCm)}
          min={DIST_MIN_CM}
          max={DIST_MAX_CM}
          step={1}
          unit=" cm"
          onChange={(v) => onInteract({ distanceCm: v, noObstacle: false })}
        />
      )}
      {selected && (
        <Html center zIndexRange={[100, 0]} position={[PCB_CENTER_X, 10.9, 0]}>
          <div style={TOGGLE_PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={TOGGLE_BUTTON_STYLE}
              onClick={() => onInteract({ noObstacle: !noObstacle })}
            >
              Tanpa rintangan: {noObstacle ? 'AKTIF' : 'mati'}
            </button>
          </div>
        </Html>
      )}
    </group>
  );
};
