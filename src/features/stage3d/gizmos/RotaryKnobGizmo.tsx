import type { ComponentType, CSSProperties } from 'react';
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
  fontSize: 15,
  color: '#00E5FF',
};

const OHMS_STYLE: CSSProperties = {
  display: 'block',
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  fontSize: 11,
  color: '#E5E7EB',
};

/** Format resistansi: ≥ 1000 Ω ditampilkan sebagai kΩ dengan 1 desimal. */
export function formatOhms(ohms: number): string {
  if (!Number.isFinite(ohms)) return '0 Ω';
  return ohms >= 1000 ? `${(ohms / 1000).toFixed(1)} kΩ` : `${Math.round(ohms)} Ω`;
}

/**
 * Panel baca mungil melayang di atas knob putar (potensiometer):
 * menampilkan persentase putaran dan resistansi aktif. Tanpa slider —
 * nilai diubah dengan menyeret knob 3D-nya langsung.
 */
export const RotaryKnobGizmo: ComponentType<RotaryKnobGizmoProps> = ({
  position,
  percent,
  ohms,
}) => (
  <Html center distanceFactor={12} zIndexRange={[100, 0]} position={position ?? [0, 4.2, 0]}>
    <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
      <span style={PERCENT_STYLE}>{Math.round(percent)}%</span>
      <span style={OHMS_STYLE}>{formatOhms(ohms)}</span>
    </div>
  </Html>
);
