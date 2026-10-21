import { useRef, type ComponentType } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import type { ComponentRenderProps } from '../../../types';

const METAL = { color: '#cfd4dc', metalness: 0.9, roughness: 0.3 } as const;

/** Warna kabel standar SG90 sesuai urutan pin: GND, VCC, SIG. */
const WIRE_COLORS = ['#7c4a21', '#d43a2f', '#f59e0b'];

/**
 * Motor servo SG90 prosedural: badan kotak biru khas dengan kuping
 * pemasangan, hub di atas, dan tanduk (lengan) putih yang berputar pada
 * sumbu Y mengikuti branchCurrents.angle (0–180°, default 90° = netral).
 * Tiga kaki pendek berwarna mengikuti urutan kabel SG90.
 */
export const ServoRender3D: ComponentType<ComponentRenderProps> = ({ instance }) => {
  const angle = instance.simState.branchCurrents['angle'];
  const angleDeg = typeof angle === 'number' && Number.isFinite(angle) ? angle : 90;
  const hornRotationY = ((angleDeg - 90) * Math.PI) / 180;

  // Gerak mekanis halus: sudut tanduk diinterpolasi eksponensial menuju
  // target dari simulasi (bukan melompat instan), seperti servo asli.
  const hornRef = useRef<Group>(null);
  const targetAngleRef = useRef(angleDeg);
  targetAngleRef.current = angleDeg;
  const currentAngleRef = useRef(angleDeg);

  useFrame((_state, delta) => {
    const next = MathUtils.lerp(
      currentAngleRef.current,
      targetAngleRef.current,
      1 - Math.exp(-10 * delta),
    );
    currentAngleRef.current = next;
    if (hornRef.current) {
      hornRef.current.rotation.y = ((next - 90) * Math.PI) / 180;
    }
  });

  return (
    <group position={instance.position} rotation={[0, instance.rotation, 0]}>
      {/* Tiga kaki/kabel pendek menuju pin elektrik (z = -1, 0, +1) */}
      {WIRE_COLORS.map((color, i) => (
        <mesh key={`leg-${i}`} position={[0, 0.1, i - 1]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}

      {/* Badan kotak biru SG90 */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[3, 2.2, 3.6]} />
        <meshStandardMaterial color="#2f6fd0" roughness={0.45} />
      </mesh>

      {/* Kuping pemasangan di sisi atas badan */}
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[4.6, 0.35, 3.6]} />
        <meshStandardMaterial color="#2f6fd0" roughness={0.45} />
      </mesh>

      {/* Sekrup kecil di empat sudut kuping pemasangan */}
      {([-1.95, 1.95] as const).map((sx) =>
        ([-1.25, 1.25] as const).map((sz) => (
          <group key={`screw-${sx}-${sz}`} position={[sx, 2.66, sz]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.14, 0.14, 0.08, 12]} />
              <meshStandardMaterial {...METAL} />
            </mesh>
            <mesh position={[0, 0.045, 0]} rotation={[0, (sx > 0 ? 0.5 : 1.1), 0]}>
              <boxGeometry args={[0.2, 0.025, 0.045]} />
              <meshStandardMaterial color="#3a3d45" roughness={0.6} />
            </mesh>
          </group>
        )),
      )}

      {/* Leher poros */}
      <mesh position={[0, 2.95, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.9, 0.35, 20]} />
        <meshStandardMaterial color="#245aa8" roughness={0.5} />
      </mesh>

      {/* Tanduk/lengan servo — berputar halus mengikuti sudut simulasi */}
      <group ref={hornRef} position={[0, 3.15, 0]} rotation={[0, hornRotationY, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.35, 20]} />
          <meshStandardMaterial {...METAL} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[3.6, 0.22, 0.75]} />
          <meshStandardMaterial color="#f2f3f5" roughness={0.4} />
        </mesh>
        {/* Ujung lengan berlubang khas tanduk servo */}
        <mesh position={[1.55, 0.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
          <meshStandardMaterial color="#23262d" roughness={0.6} />
        </mesh>
        <mesh position={[-1.55, 0.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.26, 12]} />
          <meshStandardMaterial color="#23262d" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};
