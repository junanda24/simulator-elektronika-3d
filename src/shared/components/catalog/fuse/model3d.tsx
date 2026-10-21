import type { ComponentType } from 'react';
import * as THREE from 'three';
import type { ComponentRenderProps } from '../../../types';
import { MATERIAL_PROPS } from '../../../../features/stage3d/materials3d';

/** Sumbu tabung mendatar di ketinggian ini (sama seperti model lama). */
const TUBE_Y = 1.1;
/** Jari-jari lilitan koil filamen & kawatnya. */
const COIL_RADIUS = 0.16;
const WIRE_RADIUS = 0.035;

/**
 * Geometri filamen KOIL heliks (TubeGeometry di sepanjang CatmullRom
 * dari titik-titik helix) — sekering kaca asli berisi kawat melilit,
 * bukan batang lurus. Dibuat sekali di level modul & dipakai ulang
 * antar instance (§2.7).
 */
function createCoilGeometry(
  zFrom: number,
  zTo: number,
  turns: number,
): THREE.TubeGeometry {
  const segments = Math.max(32, Math.round(turns * 18));
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * COIL_RADIUS,
        TUBE_Y + Math.sin(angle) * COIL_RADIUS,
        zFrom + (zTo - zFrom) * t,
      ),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, segments * 2, WIRE_RADIUS, 6);
}

/** Koil utuh membentang hampir sepanjang tabung. */
const COIL_INTACT = createCoilGeometry(-1.3, 1.3, 8);
/** Sisa koil gosong setelah putus — dua potong dengan celah di tengah. */
const COIL_STUB_LEFT = createCoilGeometry(-1.3, -0.45, 3);
const COIL_STUB_RIGHT = createCoilGeometry(0.45, 1.3, 3);

/**
 * Sekering kaca 5×20 prosedural (SPESIFIKASI-GAYA-3D §5 Gelombang 2 +
 * Part A riset A10): tabung kaca kelas `kaca` pustaka — kini memantul
 * environment map — berisi filamen KOIL heliks tipis yang menyambung
 * dua cap logam berlapis nikel; tiap cap punya detail cincin bibir.
 * Saat instance rusak (putus), koil menjadi gelap gosong dan menyisakan
 * celah di tengah tabung, sama seperti perilaku model lama.
 */
export const FuseRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const damaged = instance.simState.isDamaged;

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki menuju pin elektrik (z = -1 dan +1) */}
      {[-1, 1].map((z) => (
        <mesh key={`leg-${z}`} position={[0, 0.1, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 12]} />
          <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} />
        </mesh>
      ))}

      {/* Tabung kaca bening — kelas kaca dari pustaka material */}
      <mesh position={[0, TUBE_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 3, 24]} />
        <meshPhysicalMaterial {...MATERIAL_PROPS.kaca} color="#dfe9ee" opacity={0.35} />
      </mesh>

      {/* Tutup logam kedua ujung + cincin bibir detail di tiap cap */}
      {[-1, 1].map((side) => (
        <group key={`cap-${side}`}>
          <mesh
            position={[0, TUBE_Y, side * 1.7]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.6, 0.6, 0.7, 24]} />
            <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
          </mesh>
          {[-0.26, 0.26].map((offset) => (
            <mesh
              key={`ring-${side}-${offset}`}
              position={[0, TUBE_Y, side * 1.7 + offset]}
            >
              <torusGeometry args={[0.6, 0.045, 8, 28]} />
              <meshPhysicalMaterial {...MATERIAL_PROPS.canAluminium} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Filamen koil di dalam tabung */}
      {damaged ? (
        <>
          {/* Dua sisa koil gelap gosong dengan celah putus di tengah */}
          <mesh geometry={COIL_STUB_LEFT}>
            <meshStandardMaterial color="#26221f" roughness={0.8} />
          </mesh>
          <mesh geometry={COIL_STUB_RIGHT}>
            <meshStandardMaterial color="#26221f" roughness={0.8} />
          </mesh>
          {/* Ujung leleh membulat di tepi celah */}
          {[-0.45, 0.45].map((z) => (
            <mesh key={`blob-${z}`} position={[0, TUBE_Y, z]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              <meshStandardMaterial color="#26221f" roughness={0.8} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh geometry={COIL_INTACT}>
            <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color="#b0b8c2" />
          </mesh>
          {/* Ekor lurus dari ujung koil masuk ke dalam cap */}
          {[-1, 1].map((side) => (
            <mesh
              key={`tail-${side}`}
              position={[0, TUBE_Y, side * 1.42]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[WIRE_RADIUS, WIRE_RADIUS, 0.3, 6]} />
              <meshPhysicalMaterial {...MATERIAL_PROPS.metalPin} color="#b0b8c2" />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};
