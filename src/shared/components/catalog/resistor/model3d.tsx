import { useEffect, useMemo, type ComponentType } from 'react';
import * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import {
  COLOR_TOKENS,
  createMaterial3D,
  getMaterial3D,
} from '../../../../features/stage3d/materials3d';
import { createLabelTexture } from '../../../../features/stage3d/labelTexture';

/**
 * Resistor karbon prosedural (Gelombang 2 gaya 3D — SPESIFIKASI §5):
 * badan KAPSUL dari profil lathe (silinder + ujung membulat setengah
 * bola + gembung barrel halus di tengah, acuan asli Ø2,3 × 6,3 mm),
 * 4 gelang warna sebagai TEKSTUR badan (§2.5 — bukan torus terpisah)
 * dihitung dari props.resistance, kaki aksial menekuk kontinu via
 * TubeGeometry pada CatmullRomCurve3 (§2.4) turun tepat di pin
 * elektrik (x = ±2). Warna gelang & badan dari COLOR_TOKENS (fungsional,
 * hue terkunci §4); perhitungan kode warna sama seperti sebelumnya.
 */
function bandColors(resistance: number): [string, string, string, string] {
  const value = Math.max(1, Math.round(resistance));
  let exponent = Math.floor(Math.log10(value));
  let scaled = Math.round(value / 10 ** (exponent - 1));
  if (scaled >= 100) {
    scaled = 10;
    exponent += 1;
  }
  const digit1 = Math.floor(scaled / 10);
  const digit2 = scaled % 10;
  const multiplier = Math.min(9, Math.max(0, exponent - 1));
  const bands = COLOR_TOKENS.resistorBands;
  return [bands[digit1], bands[digit2], bands[multiplier], COLOR_TOKENS.resistorGold];
}

/** Dimensi badan (unit = pitch 2,54 mm): panjang 2,6, jari-jari 0,5. */
const BODY_LENGTH = 2.6;
const BODY_RADIUS = 0.5;
const BODY_Y = 0.5;
/** Pusat gelang di sumbu badan (x): 3 gelang bacaan berdekatan, emas terpisah. */
const BAND_X = [-0.88, -0.55, -0.22, 0.88] as const;
const BAND_WIDTH = 0.26;

/**
 * Profil lathe badan kapsul: titik dari ujung −Y ke +Y (v tekstur
 * mengikuti indeks titik). Ujung = tutup setengah bola berjari-jari
 * BODY_RADIUS; zona lurus memakai gembung barrel +6% di tengah.
 */
function capsuleProfile(): THREE.Vector2[] {
  const half = BODY_LENGTH / 2;
  const cap = BODY_RADIUS; // zona tutup di kedua ujung
  const straight = half - cap;
  const steps = 48;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const y = -half + (i / steps) * BODY_LENGTH;
    const ay = Math.abs(y);
    let r: number;
    if (ay <= straight) {
      r = BODY_RADIUS * (1 + 0.06 * Math.cos((Math.PI * y) / (2 * straight)));
    } else {
      const d = ay - straight;
      r = Math.sqrt(Math.max(0, BODY_RADIUS * BODY_RADIUS - d * d));
    }
    points.push(new THREE.Vector2(Math.max(0.0001, r), y));
  }
  return points;
}

/**
 * Tekstur gelang: latar krem badan + 4 garis melintang penuh.
 * Pemetaan lathe (three): v = indeks titik profil (0 di −Y, 1 di +Y);
 * mesh diputar Rz +90° sehingga +Y lathe → −X dunia dan, dengan flipY
 * kanvas, baris kanvas y = ((x + L/2) / L) · H untuk gelang di dunia x.
 */
function createBandTexture(bands: [string, string, string, string]): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      bands.forEach((color, index) => {
        const centerY = ((BAND_X[index] + BODY_LENGTH / 2) / BODY_LENGTH) * height;
        const bandH = (BAND_WIDTH / BODY_LENGTH) * height;
        ctx.fillStyle = color;
        ctx.fillRect(0, centerY - bandH / 2, width, bandH);
      });
    },
    { width: 1024, height: 512, background: COLOR_TOKENS.resistorBody },
  );
}

/** Kurva kaki aksial satu sisi: keluar dari ujung badan lalu menekuk turun ke pin. */
function leadCurve(side: 1 | -1): THREE.CatmullRomCurve3 {
  const pts: Array<[number, number, number]> = [
    [side * 1.15, BODY_Y, 0],
    [side * 1.75, BODY_Y, 0],
    [side * 1.94, 0.46, 0],
    [side * 2.0, 0.3, 0],
    [side * 2.0, -0.1, 0],
    [side * 2.0, -0.55, 0],
  ];
  return new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
}

export const ResistorRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const resistance =
    typeof instance.props.resistance === 'number' ? instance.props.resistance : 220;

  const body = useMemo(() => {
    const texture = createBandTexture(bandColors(resistance));
    const material = createMaterial3D('keramik', { color: '#ffffff' });
    material.map = texture;
    material.needsUpdate = true;
    const geometry = new THREE.LatheGeometry(capsuleProfile(), 28);
    return { texture, material, geometry };
  }, [resistance]);
  useEffect(
    () => () => {
      body.texture.dispose();
      body.material.dispose();
      body.geometry.dispose();
    },
    [body],
  );

  const leads = useMemo(
    () =>
      ([1, -1] as const).map(
        (side) => new THREE.TubeGeometry(leadCurve(side), 24, 0.09, 16, false),
      ),
    [],
  );
  useEffect(
    () => () => {
      leads.forEach((geometry) => geometry.dispose());
    },
    [leads],
  );

  const leadMaterial = getMaterial3D('metalPin');

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki aksial tekuk kontinu (tube) — turun tepat di pin elektrik ±2 */}
      {leads.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={leadMaterial} castShadow />
      ))}

      {/* Badan kapsul lathe + tekstur gelang */}
      <mesh
        geometry={body.geometry}
        material={body.material}
        position={[0, BODY_Y, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      />
    </group>
  );
};
