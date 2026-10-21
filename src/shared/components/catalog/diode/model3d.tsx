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
 * Dioda 1N4007 prosedural (Gelombang 2 gaya 3D — SPESIFIKASI §5):
 * proporsi DO-41 asli 5,2 × Ø2,7 mm (di sini panjang 1,9 unit agar
 * tekukan kaki tetap muat di rentang pin ±1), badan epoksi gelap
 * plastikHitam dengan teks "1N4007" tercetak perak melingkar di badan
 * via tekstur (§2.5), gelang perak fisik di ujung katoda (+Z), kaki
 * aksial menekuk kontinu via TubeGeometry/CatmullRomCurve3 (§2.4)
 * turun tepat di pin elektrik (z = ±1). Rusak = badan gosong gelap,
 * cetakan & gelang hilang tertelan warna hangus (paritas perilaku lama).
 */
const BODY_LENGTH = 1.9;
const BODY_RADIUS = 0.53;
const BODY_Y = 0.9;

/**
 * Tekstur badan: latar epoksi gelap + "1N4007" perak dua salinan
 * mengelilingi badan, huruf berjalan searah sumbu (putar −90° di
 * kanvas; sumbu silinder = vertikal kanvas). Warna cetak memakai token
 * metalPin (perak cetak), latar = token plastikHitam.
 */
function createDiodeBodyTexture(): THREE.CanvasTexture {
  return createLabelTexture(
    (ctx, width, height) => {
      ctx.fillStyle = COLOR_TOKENS.metalPin;
      ctx.font = '700 128px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      [0.25, 0.75].forEach((u) => {
        ctx.save();
        ctx.translate(u * width, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('1N4007', 0, 0);
        ctx.restore();
      });
    },
    { width: 1024, height: 512, background: COLOR_TOKENS.plastikHitam },
  );
}

/** Kurva kaki aksial satu sisi: keluar ujung badan, menekuk turun ke pin z = ±1. */
function leadCurve(side: 1 | -1): THREE.CatmullRomCurve3 {
  const pts: Array<[number, number, number]> = [
    [0, BODY_Y, side * 0.75],
    [0, BODY_Y, side * 0.93],
    [0, 0.865, side * 1.0],
    [0, 0.68, side * 1.0],
    [0, 0.1, side * 1.0],
    [0, -0.8, side * 1.0],
  ];
  return new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
}

export const DiodeRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  const body = useMemo(() => {
    if (damaged) {
      return {
        texture: null as THREE.CanvasTexture | null,
        material: createMaterial3D('plastikHitam', {
          color: '#0a0a0a',
          roughness: 0.6,
          clearcoat: 0,
        }),
      };
    }
    const texture = createDiodeBodyTexture();
    const material = createMaterial3D('plastikHitam', { color: '#ffffff' });
    material.map = texture;
    material.needsUpdate = true;
    return { texture, material };
  }, [damaged]);
  useEffect(
    () => () => {
      body.texture?.dispose();
      body.material.dispose();
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
      {/* Kaki aksial tekuk kontinu (tube) — turun tepat di pin elektrik ±1 */}
      {leads.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={leadMaterial} castShadow />
      ))}

      {/* Badan epoksi DO-41 mendatar sepanjang Z */}
      <mesh position={[0, BODY_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, BODY_LENGTH, 28]} />
        <primitive object={body.material} attach="material" />
      </mesh>

      {/* Gelang perak penanda katoda (+Z) */}
      {!damaged && (
        <mesh position={[0, BODY_Y, 0.72]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.545, 0.545, 0.24, 28]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      )}
    </group>
  );
};
