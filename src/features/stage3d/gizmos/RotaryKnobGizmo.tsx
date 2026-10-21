import { memo, type ComponentType, type CSSProperties } from 'react';
import { Html } from '@react-three/drei';

export interface RotaryKnobGizmoProps {
  /** Posisi lokal di dalam grup komponen (default melayang di atas knob). */
  position?: [number, number, number];
  /** Posisi putaran 0–100 (%). */
  percent: number;
  /** Resistansi aktif saat ini (ohm). */
  ohms: number;
}

const PANEL_STYLE: CSSProperties = {
  background: '#12151C',
  border: '1px solid #282E3D',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#E5E7EB',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  textAlign: 'center',
  lineHeight: 1.35,
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
  userSelect: 'none',
  pointerEvents: 'auto',
  whiteSpace: 'nowrap',
};

const PERCENT_STYLE: CSSProperties = {
  display: 'block',
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  fontSize: 16,
  fontWeight: 600,
  color: '#00E5FF',
};

const OHMS_STYLE: CSSProperties = {
  display: 'block',
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  // Standar keterbacaan indikator melayang (audit hover): ≥ 12px, ruang
  // layar (tanpa distanceFactor) agar tidak menyusut mengikuti zoom.
  fontSize: 12,
  color: '#E5E7EB',
};

/** Format resistansi: ≥ 1000 Ω ditampilkan sebagai kΩ dengan 1 desimal. */
export function formatOhms(ohms: number): string {
  if (!Number.isFinite(ohms)) return '0 Ω';
  return ohms >= 1000 ? `${(ohms / 1000).toFixed(1)} kΩ` : `${Math.round(ohms)} Ω`;
}

function samePosition(
  a?: [number, number, number],
  b?: [number, number, number],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

const RotaryKnobGizmoImpl: ComponentType<RotaryKnobGizmoProps> = ({
  position,
  percent,
  ohms,
}) => (
  <Html center zIndexRange={[100, 0]} position={position ?? [0, 4.2, 0]}>
    <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
      <span style={PERCENT_STYLE}>{Math.round(percent)}%</span>
      <span style={OHMS_STYLE}>{formatOhms(ohms)}</span>
    </div>
  </Html>
);

/**
 * Panel baca mungil melayang di atas knob putar (potensiometer):
 * menampilkan persentase putaran dan resistansi aktif. Tanpa slider —
 * nilai diubah dengan menyeret knob 3D-nya langsung.
 *
 * Di-memo pada TEKS tampil (persen bulat + string ohm terformat):
 * panel Html drei dirender ulang pada setiap render induk, jadi tanpa
 * memo ini snapshot simulasi yang tidak mengubah angka tampil tetap
 * memicu render ulang root Html terpisah — sumber kedip yang sama
 * dengan gizmo slider (audit flicker 2026-10-21). `position`
 * dibandingkan per elemen (pemanggil mengoper tuple literal).
 */
export const RotaryKnobGizmo: ComponentType<RotaryKnobGizmoProps> = memo(
  RotaryKnobGizmoImpl,
  (prev, next) =>
    Math.round(prev.percent) === Math.round(next.percent) &&
    formatOhms(prev.ohms) === formatOhms(next.ohms) &&
    samePosition(prev.position, next.position),
);
