import { useMemo, type ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';
import {
  getTo92FaceTexture,
  getTo92Geometries,
  TO92_BODY_DAMAGED,
  TO92_BODY_MATERIAL,
  TO92_LEAD_MATERIAL,
  TRANSISTOR_TO92,
} from '../../to92';

/**
 * Transistor TO-92 prosedural (Gelombang 1 gaya 3D): badan SATU geometri
 * extrude berprofil "D" — muka datar menghadap −X dengan cetakan "2N2222",
 * punggung setengah lingkaran, rok tipis di pangkal; tiga kaki pipih
 * menyempit 1,27 mm di badan lalu melebar ke pitch pin E (−1), B (0),
 * C (+1). Rusak = badan menghitam legam.
 * Geometri & tekstur dipakai bersama antar-instance (dispose={null}).
 */
export const TransistorRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;
  const geo = useMemo(() => getTo92Geometries(TRANSISTOR_TO92), []);
  const faceTexture = useMemo(
    () =>
      getTo92FaceTexture('to92-2n2222', [
        { text: '2N', px: 185 },
        { text: '2222', px: 185 },
      ]),
    [],
  );
  const bodyMaterial = damaged ? TO92_BODY_DAMAGED : TO92_BODY_MATERIAL;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki pipih menuju pin elektrik E-B-C */}
      {geo.leads.map((lead, i) => (
        <mesh key={`lead-${i}`} geometry={lead} dispose={null} castShadow>
          <meshStandardMaterial {...TO92_LEAD_MATERIAL} />
        </mesh>
      ))}

      {/* Rok pangkal + badan TO-92 satu bahasa bentuk */}
      <mesh geometry={geo.flange} dispose={null} castShadow>
        <meshPhysicalMaterial {...bodyMaterial} />
      </mesh>
      <mesh geometry={geo.body} dispose={null} castShadow>
        <meshPhysicalMaterial {...bodyMaterial} />
      </mesh>

      {/* Cetakan tipe di muka datar (−X) */}
      <mesh position={[geo.face.x, geo.face.centerY, 0]} rotation={[0, -Math.PI / 2, 0]} dispose={null}>
        <planeGeometry args={[geo.face.width, geo.face.height]} />
        <meshStandardMaterial
          map={faceTexture}
          transparent
          roughness={0.55}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
};
