import { useMemo } from 'react';
import * as THREE from 'three';
import { createLabelTexture } from '../labelTexture';

/**
 * Halo cahaya prosedural untuk elemen yang menyala (gelombang "efek
 * hidup"): sprite additive bertekstur gradasi radial yang memberi kesan
 * cahaya bocor ke udara di sekitar lampu — sesuatu yang tidak bisa
 * diberikan emissive saja (emissive hanya mewarnai permukaan sendiri,
 * tidak menumpahkan cahaya ke ruang di sekitarnya).
 *
 * - Tekstur dibuat SEKALI (singleton malas) via jalur kanvas resmi
 *   labelTexture (§2.5): putih penuh di pusat → transparan di tepi.
 *   Warna datang dari material sprite, bukan tekstur.
 * - depthWrite MATI (halo tidak boleh menutupi geometri di belakangnya)
 *   dan depthTest HIDUP (komponen di depan lampu tetap mengoklusi halo,
 *   sesuai aturan gelombang).
 * - Warna material sprite dinaikkan ke wilayah HDR sebanding drive
 *   (pengali > 1) agar pusat halo ikut tertangkap Bloom; opacity &
 *   skala juga sebanding drive. Drive ~0 → tidak dirender sama sekali.
 */

let haloTexture: THREE.CanvasTexture | null = null;

function getHaloTexture(): THREE.CanvasTexture {
  if (!haloTexture) {
    haloTexture = createLabelTexture(
      (ctx, width, height) => {
        const gradient = ctx.createRadialGradient(
          width / 2, height / 2, 0,
          width / 2, height / 2, width / 2,
        );
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.22, 'rgba(255,255,255,0.55)');
        gradient.addColorStop(0.55, 'rgba(255,255,255,0.16)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      },
      { width: 256, height: 256 },
    );
  }
  return haloTexture;
}

export interface GlowHaloProps {
  /** Warna cahaya (hex/token) — hue fungsional pemanggil, tidak digeser. */
  color: string;
  /** Kekuatan nyala ternormalisasi 0..1 (0 = mati, tidak dirender). */
  drive: number;
  /** Posisi lokal pusat halo (bawaan asal grup pemanggil). */
  position?: [number, number, number];
  /** Diameter halo (satuan dunia) pada drive penuh. */
  diameter?: number;
}

export function GlowHalo({ color, drive, position = [0, 0, 0], diameter = 6.4 }: GlowHaloProps) {
  const texture = getHaloTexture();
  const hdrColor = useMemo(
    () => new THREE.Color(color).multiplyScalar(0.85 + 1.9 * drive),
    [color, drive],
  );
  if (drive <= 0.02) return null;
  const scale = diameter * (0.72 + 0.38 * drive);
  return (
    <sprite position={position} scale={[scale, scale, 1]}>
      <spriteMaterial
        map={texture}
        color={hdrColor}
        transparent
        opacity={0.16 + 0.62 * drive}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest
      />
    </sprite>
  );
}
