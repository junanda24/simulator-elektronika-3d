import type { ComponentType } from 'react';
import type { ComponentRenderProps } from '../../../types';

/** Kode warna resistor standar: indeks = digit 0-9. */
const DIGIT_COLORS = [
  '#000000', // 0 hitam
  '#7a3b1e', // 1 coklat
  '#d42a1e', // 2 merah
  '#e07b24', // 3 oranye
  '#f2c618', // 4 kuning
  '#2e9e4f', // 5 hijau
  '#2456c8', // 6 biru
  '#7a3fa0', // 7 ungu
  '#8a8f98', // 8 abu
  '#f2f2f2', // 9 putih
] as const;

const GOLD = '#c9a227';
const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/**
 * Empat gelang warna dari nilai resistansi:
 * [digit1, digit2, pengali (pangkat 10), toleransi emas].
 * Contoh 220 ohm -> merah, merah, coklat, emas.
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
  return [DIGIT_COLORS[digit1], DIGIT_COLORS[digit2], DIGIT_COLORS[multiplier], GOLD];
}

const BAND_X = [-0.78, -0.32, 0.14, 0.8] as const;

/**
 * Resistor aksial prosedural: badan silinder krem horizontal,
 * 4 gelang warna dihitung dari props.resistance, dua kaki aksial
 * metalik yang menekuk turun menancap ke breadboard.
 */
export const ResistorRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const resistance =
    typeof instance.props.resistance === 'number' ? instance.props.resistance : 220;
  const bands = bandColors(resistance);

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Kaki aksial horizontal — ujungnya tepat di atas pin elektrik (±2) */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`lead-${side}`}
          position={[side * 1.6, 0.55, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}
      {/* Tekukan kaki turun ke lubang breadboard (posisi = pin elektrik ±2) */}
      {([-1, 1] as const).map((side) => (
        <mesh key={`drop-${side}`} position={[side * 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.1, 8]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
      ))}

      {/* Badan krem */}
      <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 2.4, 20]} />
        <meshStandardMaterial color="#d8b98a" roughness={0.5} />
      </mesh>

      {/* Gelang warna */}
      {bands.map((color, index) => (
        <mesh
          key={`band-${index}`}
          position={[BAND_X[index], 0.55, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.565, 0.565, 0.24, 20]} />
          <meshStandardMaterial color={color} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
};
