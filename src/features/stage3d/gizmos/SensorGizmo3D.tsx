import type { ComponentType, CSSProperties } from 'react';
import { Html } from '@react-three/drei';

export interface SensorGizmo3DProps {
  /** Posisi lokal di dalam grup komponen (default melayang di atas komponen). */
  position?: [number, number, number];
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}

const PANEL_STYLE: CSSProperties = {
  background: '#12151C',
  border: '1px solid #282E3D',
  borderRadius: 8,
  padding: '8px 10px',
  minWidth: 132,
  color: '#E5E7EB',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: 11,
  lineHeight: 1.3,
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
  userSelect: 'none',
  pointerEvents: 'auto',
};

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 10,
  marginBottom: 6,
  whiteSpace: 'nowrap',
};

const VALUE_STYLE: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  color: '#00E5FF',
  fontSize: 12,
};

const SLIDER_STYLE: CSSProperties = {
  width: '100%',
  margin: 0,
  accentColor: '#00E5FF',
  cursor: 'pointer',
};

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Panel gizmo melayang di ruang 3D (drei Html) untuk mengubah nilai
 * lingkungan sebuah sensor langsung di meja kerja: label + nilai
 * tabular + slider. Pembungkus menghentikan propagasi pointer agar
 * menyeret slider tidak ikut memutar kamera OrbitControls.
 */
export const SensorGizmo3D: ComponentType<SensorGizmo3DProps> = ({
  position,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}) => (
  <Html center distanceFactor={12} position={position ?? [0, 4.2, 0]}>
    <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
      <div style={HEADER_STYLE}>
        <span>{label}</span>
        <span style={VALUE_STYLE}>
          {formatValue(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? (max - min) / 100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={SLIDER_STYLE}
      />
    </div>
  </Html>
);
