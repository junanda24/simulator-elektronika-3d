import { useEffect, useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  MATERIAL_PROPS,
  createMaterial3D,
  getMaterial3D,
} from '../../../../features/stage3d/materials3d';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';

/**
 * Kapasitor elektrolit prosedural (Gelombang 2 gaya 3D — SPESIFIKASI §5):
 * proporsi ramping-tinggi khas can untuk pitch kaki 5,08 mm (Ø6,2 × 11 mm
 * ≈ r 1,22 × tinggi 4,3 unit), selubung hitam BERCETAK menyatu via
 * tekstur (§2.5): nilai µF + tegangan dari props, stripe minus tercetak
 * di sisi kaki minus (+Z), pengulangan nilai kecil + "105°C" seperti
 * cetakan asli. Tutup atas aluminium sedikit masuk dengan skor vent
 * digambar sebagai LEKUKAN (garis gelap + sorot geser di tekstur tutup),
 * cincin crimp gelap di dekat tutup, bung karet di pangkal, kaki plus
 * lebih panjang dari minus. Rusak = badan menghitam, cetakan hilang
 * (paritas perilaku lama).
 */
const BODY_RADIUS = 1.22;
const BODY_BOTTOM = 0.9;
const BODY_HEIGHT = 4.3;
const BODY_TOP = BODY_BOTTOM + BODY_HEIGHT;
const BODY_CENTER_Y = BODY_BOTTOM + BODY_HEIGHT / 2;

function formatCapacitance(capacitance: number): string {
  return Number.isInteger(capacitance)
    ? String(capacitance)
    : String(Math.round(capacitance * 10) / 10);
}

/**
 * Tekstur selubung. Pemetaan silinder (three): u = 0 di sisi +Z (kaki
 * minus) dan bertambah mengelilingi badan; v kanvas atas = puncak
 * tabung. Stripe minus digambar membelah tepi kiri/kanan kanvas agar
 * menyambung tepat di +Z; teks utama di u = 0,5 (sisi kaki plus, −Z),
 * berjalan vertikal searah sumbu seperti cetakan asli.
 */
function createSleeveTexture(capacitance: number, voltageRating: number): THREE.CanvasTexture {
  const value = `${formatCapacitance(capacitance)}µF`;
  const rating = `${voltageRating}V`;
  const print = COLOR_TOKENS.metalPin;
  return createLabelTexture(
    (ctx, width, height) => {
      // — Stripe minus tercetak (menyatu, bukan pelat melayang) —
      const stripeHalf = 78;
      ctx.fillStyle = print;
      ctx.fillRect(0, 0, stripeHalf, height);
      ctx.fillRect(width - stripeHalf, 0, stripeHalf, height);
      ctx.fillStyle = COLOR_TOKENS.plastikHitam;
      ctx.font = '700 84px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = 92; y < height; y += 168) {
        ctx.fillText('−', 0, y);
        ctx.fillText('−', width, y);
      }

      // — Cetakan nilai utama (vertikal, sisi plus) —
      ctx.fillStyle = print;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 150px Arial, Helvetica, sans-serif';
      ctx.fillText(value, 0, -72);
      ctx.font = '700 118px Arial, Helvetica, sans-serif';
      ctx.fillText(rating, 0, 78);
      ctx.restore();

      // — Pengulangan kecil nilai + suhu di dua sisi lain —
      ctx.globalAlpha = 0.8;
      ctx.font = '700 76px Arial, Helvetica, sans-serif';
      [0.25, 0.75].forEach((u) => {
        ctx.save();
        ctx.translate(u * width, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${value}  ${rating}  105°C`, 0, 0);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    },
    { width: 1024, height: 1024, background: COLOR_TOKENS.plastikHitam },
  );
}

/**
 * Tekstur tutup atas: aluminium dengan skor vent silang sebagai
 * lekukan — garis gelap inti + garis terang bergeser 3 px meniru
 * dinding alur yang menangkap cahaya (tanpa geometri menonjol).
 */
function createTopTexture(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const arm = width * 0.31;
      const drawScore = (color: string, dx: number, dy: number) => {
        ctx.fillStyle = color;
        ctx.fillRect(cx - arm + dx, cy - 13 + dy, arm * 2, 26);
        ctx.fillRect(cx - 13 + dx, cy - arm + dy, 26, arm * 2);
      };
      drawScore('#e6eaee', 3, 3); // sorot tepi alur
      drawScore('#878d95', 0, 0); // inti alur gelap
      // Ring tepi tutup sedikit lebih gelap
      ctx.strokeStyle = '#9aa0a8';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, width * 0.47, 0, Math.PI * 2);
      ctx.stroke();
    },
    { width: 512, height: 512, background: COLOR_TOKENS.canAluminium },
  );
}

export const CapacitorRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;
  const capacitance =
    typeof instance.props.capacitance === 'number' ? instance.props.capacitance : 100;
  const voltageRating =
    typeof instance.props.voltageRating === 'number' ? instance.props.voltageRating : 25;

  const sleeve = useMemo(() => {
    if (damaged) {
      return {
        texture: null as THREE.CanvasTexture | null,
        material: createMaterial3D('absWarna', { color: '#151312', clearcoat: 0.2 }),
      };
    }
    const texture = createSleeveTexture(capacitance, voltageRating);
    const material = createMaterial3D('absWarna', { color: '#ffffff' });
    material.map = texture;
    material.needsUpdate = true;
    return { texture, material };
  }, [damaged, capacitance, voltageRating]);
  useEffect(
    () => () => {
      sleeve.texture?.dispose();
      sleeve.material.dispose();
    },
    [sleeve],
  );

  const top = useMemo(() => {
    if (damaged) return { texture: null as THREE.CanvasTexture | null, material: null };
    const texture = createTopTexture();
    const material = createMaterial3D('canAluminium', { color: '#ffffff' });
    material.map = texture;
    material.needsUpdate = true;
    return { texture, material };
  }, [damaged]);
  useEffect(
    () => () => {
      top.texture?.dispose();
      top.material?.dispose();
    },
    [top],
  );

  const bungMaterial = getMaterial3D('karet');
  const crimpMaterial = getMaterial3D('canAluminium', { color: '#878d95', roughness: 0.5 });

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki plus (+) — lebih panjang, sisi lokal -Z (posisi = pin elektrik) */}
      <mesh position={[0, 0.1, -1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2.2, 16]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>
      {/* Kaki minus (-) — lebih pendek, sisi lokal +Z (posisi = pin elektrik) */}
      <mesh position={[0, 0, 1]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 2, 16]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
      </mesh>

      {/* Bung karet pangkal (segel bawah can asli, menutup dasar selubung) */}
      <mesh position={[0, BODY_BOTTOM + 0.02, 0]} material={bungMaterial}>
        <cylinderGeometry args={[1.16, 1.2, 0.16, 32]} />
      </mesh>

      {/* Selubung tabung bercetak */}
      <mesh position={[0, BODY_CENTER_Y, 0]} castShadow>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, BODY_HEIGHT, 32, 1, true]} />
        <primitive object={sleeve.material} attach="material" />
      </mesh>

      {/* Cincin crimp (lekukan penjepit tutup) di dekat puncak */}
      <mesh position={[0, BODY_TOP - 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} material={crimpMaterial}>
        <torusGeometry args={[BODY_RADIUS - 0.005, 0.022, 10, 48]} />
      </mesh>

      {/* Leher tutup aluminium (dinding saja) di bawah bibir can */}
      <mesh position={[0, BODY_TOP - 0.09, 0]}>
        <cylinderGeometry args={[1.14, 1.14, 0.14, 32, 1, true]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
      </mesh>
      {/* Bibir can menggulung di puncak */}
      <mesh position={[0, BODY_TOP + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.16, 0.055, 12, 48]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
      </mesh>
      {/* Cakram tutup sedikit masuk + skor vent lekukan (tekstur) */}
      {damaged ? (
        <mesh position={[0, BODY_TOP - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.14, 32]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} color="#8f959d" />
        </mesh>
      ) : (
        <mesh position={[0, BODY_TOP - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.14, 32]} />
          <primitive object={top.material!} attach="material" />
        </mesh>
      )}
    </group>
  );
};
