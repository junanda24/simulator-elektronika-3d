import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { Html } from '@react-three/drei';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
  type ThrottledCaller,
} from './throttledCommit';

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
  padding: '10px 12px',
  minWidth: 156,
  color: '#E5E7EB',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  // Standar keterbacaan indikator melayang (audit hover): label ≥ 12px di
  // ruang layar — tanpa distanceFactor agar panel (dan slidernya) tidak
  // menyusut mengikuti zoom.
  fontSize: 12,
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
  fontSize: 13,
  fontWeight: 600,
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

function samePosition(
  a?: [number, number, number],
  b?: [number, number, number],
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Panel gizmo melayang di ruang 3D (drei Html) untuk mengubah nilai
 * lingkungan sebuah sensor langsung di meja kerja: label + nilai
 * tabular + slider. Pembungkus menghentikan propagasi pointer agar
 * menyeret slider tidak ikut memutar kamera OrbitControls.
 *
 * KEPEMILIKAN NILAI (perbaikan flicker, audit 2026-10-21): slider ini
 * input terkontrol PENUH yang nilainya dulu hidup hanya di store —
 * setiap geseran menempuh putaran penuh interact → syncSim → worker →
 * snapshot → applySnapshot → objek instance baru → render ulang model,
 * dan panel Html drei (root React TERPISAH yang dirender ulang tanpa
 * dependensi pada setiap render induk) berkedip di bawah beban itu.
 * Sekarang nilai tampil dimiliki DRAFT LOKAL:
 * - geseran slider menulis draft seketika (tampilan tak pernah menunggu
 *   putaran store) dan commit ke store berjalan ter-throttle ±33 ms
 *   (leading + trailing; flush tepat saat gestur selesai agar nilai
 *   akhir tak pernah hilang) — simulasi tetap live selama gestur;
 * - gema commit sendiri dikenali lewat nilai commit terakhir dan tidak
 *   menimpa draft yang sudah lebih maju;
 * - perubahan EKSTERNAL (seret badan 3D, undo, starter lesson) tetap
 *   diadopsi: prop yang bukan gema commit sendiri menyelaraskan draft
 *   selama tidak ada gestur pointer yang aktif;
 * - komponen di-memo pada nilai tampil: snapshot yang tidak mengubah
 *   nilai tampil tidak me-render ulang panel sama sekali.
 */
const SensorGizmo3DImpl: ComponentType<SensorGizmo3DProps> = ({
  position,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}) => {
  // Callback terbaru selalu lewat ref: model pemanggil mengoper arrow
  // inline (identitas baru tiap render), dan memo di bawah sengaja
  // mengabaikan identitas onChange — tanpa ref ini memo akan memanggil
  // callback basi.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /** Nilai terakhir yang KITA commit ke store (domain slider). */
  const lastCommittedRef = useRef<number | null>(null);
  const commitRef = useRef<ThrottledCaller<[number]> | null>(null);
  if (commitRef.current === null) {
    commitRef.current = createThrottledCaller<[number]>((v) => {
      lastCommittedRef.current = v;
      onChangeRef.current(v);
    }, INTERACT_COMMIT_INTERVAL_MS);
  }

  const [draft, setDraft] = useState(value);
  const gesturingRef = useRef(false);

  // Adopsi perubahan eksternal: prop yang datang BUKAN gema commit
  // sendiri menyelaraskan draft — kecuali di tengah gestur pointer,
  // di mana draft adalah satu-satunya pemilik tampilan.
  useEffect(() => {
    if (gesturingRef.current) return;
    if (value === lastCommittedRef.current) return;
    setDraft(value);
  }, [value]);

  // Nilai menunggu tidak boleh bocor melewati unmount.
  useEffect(() => {
    const commit = commitRef.current;
    return () => commit?.cancel();
  }, []);

  const endGesture = useCallback(() => {
    if (!gesturingRef.current) return;
    gesturingRef.current = false;
    // Nilai akhir gestur diteruskan SEKARANG (bukan menunggu jendela
    // throttle). Gema-nya dikenali sebagai commit sendiri dan tidak
    // menimpa apa pun; adopsi eksternal aktif lagi setelah ini.
    commitRef.current?.flush();
  }, []);

  const handleSliderChange = (v: number) => {
    setDraft(v);
    commitRef.current?.call(v);
  };

  return (
    <Html center zIndexRange={[100, 0]} position={position ?? [0, 4.2, 0]}>
      <div style={PANEL_STYLE} onPointerDown={(e) => e.stopPropagation()}>
        <div style={HEADER_STYLE}>
          <span>{label}</span>
          <span style={VALUE_STYLE}>
            {formatValue(draft)}
            {unit}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step ?? (max - min) / 100}
          value={draft}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          onPointerDown={() => {
            gesturingRef.current = true;
          }}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onLostPointerCapture={endGesture}
          onBlur={endGesture}
          style={SLIDER_STYLE}
        />
      </div>
    </Html>
  );
};

/**
 * Memo dengan pembanding NILAI TAMPIL: prop `value` di pemanggil selalu
 * bilangan bulat tampilan (model mengoper Math.round(...) / persen),
 * jadi snapshot yang tidak mengubah nilai tampil tidak me-render ulang
 * panel. `onChange` sengaja tidak dibandingkan — gizmo selalu memanggil
 * callback terbaru lewat ref internal (lihat SensorGizmo3DImpl).
 * `position` dibandingkan per elemen karena pemanggil mengoper tuple
 * literal baru di setiap render.
 */
export const SensorGizmo3D: ComponentType<SensorGizmo3DProps> = memo(
  SensorGizmo3DImpl,
  (prev, next) =>
    prev.label === next.label &&
    prev.value === next.value &&
    prev.min === next.min &&
    prev.max === next.max &&
    prev.step === next.step &&
    prev.unit === next.unit &&
    samePosition(prev.position, next.position),
);
