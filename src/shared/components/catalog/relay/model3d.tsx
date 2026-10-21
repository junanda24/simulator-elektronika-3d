import { useEffect, useMemo, useRef } from 'react';
import type { ComponentType } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { ComponentRenderProps } from '../../../types';
import { playClick } from '../../../utils/soundFx';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';
import { COLOR_TOKENS, MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/**
 * Material dari pustaka bersama `stage3d/materials3d.ts`
 * (SPESIFIKASI-GAYA-3D §2.2/§3–§4): kaki & sekrup = kelas metalPin,
 * badan relay & blok terminal = kelas absWarna, PCB = kelas pcb,
 * kapasitor & transistor penggerak = kelas plastikHitam. Biru Songle
 * memakai token fungsional COLOR_TOKENS.relayBlue (hue §4 — tidak
 * digeser); konstanta di bawah hanya warna benda asli setempat.
 */
const TERMINAL_BLUE = '#0f5fc0';
const PCB_GREEN = '#1ca64e';
const LABEL_INK = '#1b2a47';

/** Posisi kaki sesuai pin elektrik: kolom koil x=-1.5, kolom kontak x=+1.5. */
const LEG_POSITIONS: Array<[number, number]> = [
  [-1.5, -1],
  [-1.5, 0],
  [-1.5, 1],
  [1.5, -1],
  [1.5, 0],
  [1.5, 1],
];

/** Lima kaki pipih relay SRD sendiri: 2 koil di sisi kiri, 3 kontak di sisi kanan balok. */
const RELAY_PINS: Array<[number, number]> = [
  [-2.5, -0.85],
  [-2.5, 0.85],
  [0.7, -1.05],
  [0.7, 0],
  [0.7, 1.05],
];

/**
 * Geometri fitur visual yang WAJIB sejajar jangkar pin elektrik
 * (meta.ts): kolom kontak lokal x=+1,5 dengan z COM/NO/NC = −1/0/+1,
 * kolom kendali x=−1,5 di bawah balok koil. Blok terminal KF301 duduk
 * tepat di atas kolom kontak (muka dalamnya 0,1 dari bidang jangkar)
 * dan sekrup + lubang kabelnya berbagi z yang PERSIS sama dengan
 * jangkar COM/NO/NC — bukan pitch 1,27 lama yang meleset 0,27 dan
 * membuat kabel kontak mendarat di celah kosong di samping blok.
 * Konstanta diekspor agar tes keselarasan (relay-alignment.test.ts)
 * mengunci regresi ini.
 */
export const RELAY_TERMINAL_BLOCK = { centerX: 2.55, width: 1.9, depth: 3.8 };
export const RELAY_TERMINAL_SCREW_Z: readonly number[] = [-1, 0, 1];
export const RELAY_TERMINAL_HOLE_X = 3.51;
export const RELAY_COIL_BLOCK = { centerX: -1.05, width: 3.9 };
export const RELAY_LED = { x: 1.25, z: -1.5, radius: 0.28 };

/**
 * Plat label atas relay Songle SRD-05VDC-SL-C, digambar prosedural
 * (§2.5): merek, seri, rating kontak, dan diagram terminal sederhana
 * (koil + sakelar COM/NO/NC + baris 5 pin). Bidang 3,55 × 3,25 unit
 * → kanvas 1024 × 936; latar transparan di atas plat putih fisik.
 */
function createRelayLabel(): THREE.CanvasTexture {
  return createLabelTexture((ctx) => {
    ctx.fillStyle = LABEL_INK;
    ctx.strokeStyle = LABEL_INK;
    ctx.textAlign = 'left';

    // Merek + tanda sertifikasi
    ctx.font = '700 96px Arial, sans-serif';
    ctx.fillText('SONGLE', 48, 118);
    ctx.textAlign = 'right';
    ctx.font = '700 54px Arial, sans-serif';
    ctx.fillText('CE', 976, 112);
    ctx.textAlign = 'left';

    // Seri relay
    ctx.font = '700 104px Arial, sans-serif';
    ctx.fillText('SRD-05VDC-SL-C', 48, 248);

    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(48, 292);
    ctx.lineTo(976, 292);
    ctx.stroke();

    // Rating kontak — cetakan wajib pada relay asli
    ctx.font = '700 76px Arial, sans-serif';
    ctx.fillText('10A 250VAC', 48, 396);
    ctx.fillText('10A 30VDC', 48, 486);
    ctx.font = '600 54px Arial, sans-serif';
    ctx.fillText('COIL: 5VDC', 560, 396);
    ctx.fillText('SPDT  1 FORM C', 560, 486);

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(48, 530);
    ctx.lineTo(976, 530);
    ctx.stroke();

    // Diagram terminal: koil (kiri) + sakelar pindah (kanan)
    ctx.lineWidth = 9;
    ctx.strokeRect(90, 610, 210, 130); // lilitan koil
    ctx.beginPath();
    ctx.moveTo(120, 740);
    ctx.lineTo(120, 800);
    ctx.moveTo(270, 740);
    ctx.lineTo(270, 800);
    ctx.stroke();
    // Kontak: titik COM, lengan sakelar, titik NO & NC
    ctx.beginPath();
    ctx.arc(560, 700, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(560, 700);
    ctx.lineTo(790, 622); // lengan menuju NO
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(820, 615, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(820, 745, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 46px Arial, sans-serif';
    ctx.fillText('COM', 470, 790);
    ctx.fillText('NO', 838, 628);
    ctx.fillText('NC', 838, 762);
    ctx.fillText('COIL', 118, 585);

    // Baris 5 pin di tepi bawah diagram
    for (let i = 0; i < 5; i += 1) {
      const x = 130 + i * 190;
      ctx.beginPath();
      ctx.arc(x, 862, 21, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { width: 1024, height: 936 });
}

/**
 * Silkscreen + jejak PCB modul relay: legenda pin di tepi depan,
 * cincin lubang kaki, jejak tembaga samar menuju balok relay & blok
 * terminal, dan judul modul di tepi belakang. Bidang 7,6 × 4,6 unit
 * → kanvas 1024 × 620 (§2.5). Sisi atas kanvas menghadap -z.
 */
function createModuleSilkscreen(): THREE.CanvasTexture {
  return createLabelTexture((ctx) => {
    const toPx = (lx: number, lz: number): [number, number] => [
      (lx / 7.6 + 0.5) * 1024,
      (lz / 4.6 + 0.5) * 620,
    ];

    // Jejak tembaga samar: kolom koil → balok relay; kolom kontak →
    // blok terminal (lurus sejajar z jangkar menuju pusat blok).
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    LEG_POSITIONS.forEach(([x, z]) => {
      const [sx, sy] = toPx(x, z);
      const [ex, ey] =
        x > 0
          ? toPx(RELAY_TERMINAL_BLOCK.centerX, z)
          : toPx(RELAY_COIL_BLOCK.centerX, z * 0.55);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    });
    // Cincin lubang kaki.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    LEG_POSITIONS.forEach(([x, z]) => {
      const [cx, cy] = toPx(x, z);
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';

    // Legenda pin kendali di tepi depan — kolom kaki koil tertutup
    // balok relay, jadi label ditaruh sebagai legenda sejajar posisi
    // kolomnya (urutan VCC IN GND = z −1 → +1, belakang ke depan).
    // Kontak TIDAK lagi dilabeli di sini: label COM/NO/NC tercetak di
    // muka atas blok terminal di samping sekrupnya (createTerminalLabel).
    ctx.font = '600 32px "JetBrains Mono", monospace';
    const [c1x, c1y] = toPx(-1.5, 2.06);
    ctx.fillText('VCC IN GND', c1x, c1y);

    // Judul modul di tepi belakang.
    ctx.font = '700 36px "JetBrains Mono", monospace';
    const [tx, ty] = toPx(0, -2.04);
    ctx.fillText('RELAY MODULE 5V', tx, ty);
  }, { width: 1024, height: 620 });
}

/**
 * Cetakan label di muka atas blok terminal: COM / NO / NC di samping
 * kiri kepala sekrupnya masing-masing — z label sama persis dengan
 * z jangkar pin (RELAY_TERMINAL_SCREW_Z), sehingga sekrup yang
 * dilihat pengguna adalah kontak yang sama dengan yang disambung
 * kabel lewat strip breadboard. Bidang 1,7 × 3,3 unit → kanvas
 * 512 × 1024; sisi atas kanvas menghadap −z (konvensi label proyek).
 */
function createTerminalLabel(): THREE.CanvasTexture {
  return createLabelTexture((ctx) => {
    const toPx = (lx: number, lz: number): [number, number] => [
      (lx / 1.7 + 0.5) * 512,
      (lz / 3.3 + 0.5) * 1024,
    ];
    ctx.fillStyle = '#eef4fb';
    ctx.font = '700 62px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const labels: Array<[string, number]> = [
      ['COM', -1],
      ['NO', 0],
      ['NC', 1],
    ];
    for (const [text, z] of labels) {
      const [x, y] = toPx(-0.34, z);
      ctx.fillText(text, x, y + 21);
    }
  }, { width: 512, height: 1024 });
}

/** Kepala sekrup blok terminal KF301: silinder metal + slot lurus gelap. */
const TerminalScrew = ({ z, angle }: { z: number; angle: number }) => (
  <group position={[RELAY_TERMINAL_BLOCK.centerX, 2.53, z]}>
    <mesh castShadow>
      <cylinderGeometry args={[0.27, 0.27, 0.14, 20]} />
      <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
    </mesh>
    <mesh position={[0, 0.08, 0]} rotation={[0, angle, 0]}>
      <boxGeometry args={[0.36, 0.04, 0.08]} />
      <meshStandardMaterial color="#3a3f47" roughness={0.6} />
    </mesh>
  </group>
);

/**
 * Modul relay 5 V prosedural: pelat PCB hijau bersilkscreen, balok
 * relay biru Songle SRD dengan plat label BERCETAK (seri + rating +
 * diagram terminal) dan 5 kaki pipih, blok terminal KF301 biru dengan
 * kepala sekrup & lubang kabel, kapasitor dan transistor penggerak di
 * PCB, serta LED indikator merah yang menyala saat koil aktif.
 */
export const RelayRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const activeValue = instance.simState.branchCurrents['active'] ?? 0;
  const active = activeValue === 1;

  const relayLabel = useMemo(createRelayLabel, []);
  const silkscreen = useMemo(createModuleSilkscreen, []);
  const terminalLabel = useMemo(createTerminalLabel, []);

  // Bunyi "tak!" mekanis setiap kali koil berubah status.
  // Ref diinisialisasi dari nilai awal agar mount pertama tidak berbunyi.
  const prevActiveRef = useRef(activeValue);
  useEffect(() => {
    if (prevActiveRef.current !== activeValue) {
      prevActiveRef.current = activeValue;
      playClick(1200);
    }
  }, [activeValue]);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Enam kaki pendek menuju pin elektrik (jangkar pin tidak berubah) */}
      {LEG_POSITIONS.map(([x, z]) => (
        <mesh key={`leg-${x}-${z}`} position={[x, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Pelat PCB hijau membulat */}
      <RoundedBox args={[7.6, 0.45, 4.6]} radius={0.12} smoothness={4} position={[0, 0.78, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.pcb} color={PCB_GREEN} />
      </RoundedBox>
      {/* Silkscreen & jejak di muka atas PCB */}
      <mesh position={[0, 1.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.6, 4.6]} />
        <meshStandardMaterial map={silkscreen} transparent roughness={0.5} />
      </mesh>

      {/* Lima kaki pipih relay di celah bawah balok */}
      {RELAY_PINS.map(([x, z]) => (
        <mesh key={`rpin-${x}-${z}`} position={[x, 1.03, z]}>
          <boxGeometry args={[0.34, 0.22, 0.09]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Balok relay biru Songle — proporsi nyaris kubus seperti SRD asli */}
      <RoundedBox args={[RELAY_COIL_BLOCK.width, 3.3, 3.6]} radius={0.16} smoothness={4} position={[RELAY_COIL_BLOCK.centerX, 2.72, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={COLOR_TOKENS.relayBlue} />
      </RoundedBox>
      {/* Plat label putih di muka atas balok */}
      <RoundedBox args={[3.55, 0.07, 3.25]} radius={0.03} smoothness={4} position={[RELAY_COIL_BLOCK.centerX, 4.41, 0]}>
        <meshStandardMaterial color="#eef1f4" roughness={0.5} />
      </RoundedBox>
      {/* Cetakan label: merek, seri, rating, diagram terminal */}
      <mesh position={[RELAY_COIL_BLOCK.centerX, 4.448, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.55, 3.25]} />
        <meshStandardMaterial map={relayLabel} transparent roughness={0.5} />
      </mesh>

      {/* Blok terminal KF301 biru (COM/NO/NC) — duduk tepat di atas
          kolom jangkar kontak x=+1,5; sekrup & lubang kabel sejajar
          z jangkar pin (RELAY_TERMINAL_SCREW_Z) */}
      <RoundedBox args={[RELAY_TERMINAL_BLOCK.width, 1.5, RELAY_TERMINAL_BLOCK.depth]} radius={0.1} smoothness={4} position={[RELAY_TERMINAL_BLOCK.centerX, 1.76, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.absWarna} color={TERMINAL_BLUE} />
      </RoundedBox>
      {/* Cetakan label COM/NO/NC di muka atas blok, di samping sekrupnya */}
      <mesh position={[RELAY_TERMINAL_BLOCK.centerX, 2.515, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.7, 3.3]} />
        <meshStandardMaterial map={terminalLabel} transparent roughness={0.5} />
      </mesh>
      {/* Tiga kepala sekrup di muka atas blok terminal */}
      {RELAY_TERMINAL_SCREW_Z.map((z, i) => (
        <TerminalScrew key={`screw-${z}`} z={z} angle={[0.4, 1.2, -0.7][i]} />
      ))}
      {/* Tiga lubang masuk kabel di sisi luar (+x), sejajar z sekrupnya */}
      {RELAY_TERMINAL_SCREW_Z.map((z) => (
        <mesh key={`hole-${z}`} position={[RELAY_TERMINAL_HOLE_X, 1.6, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.3, 0.3, 0.1, 20]} />
          <meshStandardMaterial color="#0a0f16" roughness={0.9} />
        </mesh>
      ))}

      {/* Kapasitor elektrolit modul di sudut depan PCB (digeser ke
          sudut agar tidak bergesekan dengan balok relay yang kini
          berpusat di x=−1,05) */}
      <group position={[-3.3, 1.0, 1.9]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.8, 24]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} color="#2456c8" />
        </mesh>
        <mesh position={[0, 0.81, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.03, 24]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      </group>

      {/* Transistor penggerak koil di tepi depan PCB */}
      <RoundedBox args={[0.55, 0.26, 0.36]} radius={0.06} smoothness={4} position={[0.6, 1.14, 2.02]} castShadow>
        <meshPhysicalMaterial {...MATERIAL_PROPS.plastikHitam} />
      </RoundedBox>

      {/* LED indikator merah — menyala saat relay aktif. Duduk di celah
          antara balok relay dan blok terminal (RELAY_LED): celah itu
          menyempit karena blok terminal kini menimpa kolom kontak,
          jadi LED sedikit diperkecil agar tidak menabrak kedua blok. */}
      <mesh position={[RELAY_LED.x, 1.23, RELAY_LED.z]} castShadow>
        <cylinderGeometry args={[0.26, RELAY_LED.radius, 0.45, 16]} />
        <meshStandardMaterial
          color="#ff2a2a"
          roughness={0.3}
          emissive="#ff2a2a"
          emissiveIntensity={active ? 3.2 : 0.04}
        />
      </mesh>
      {active && (
        <pointLight position={[RELAY_LED.x, 2.1, RELAY_LED.z]} color="#ff2a2a" intensity={6} distance={5} decay={2} />
      )}
    </group>
  );
};
