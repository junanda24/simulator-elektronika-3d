import { useState } from 'react';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { isSoundEnabled, setSoundEnabled } from '../shared/utils/soundFx';

/**
 * Bar peralatan di bawah Top Toolbar — grup berlabel dengan pemisah
 * vertikal (pola toolbar pro, mode Operate): [Kabel] | [Undo/Redo] |
 * [Mode Hapus] | [Suara] | petunjuk pintasan. Semua tombol h-8 (32px),
 * radius & border konsisten STYLE_GUIDE.md.
 */

/** Palet warna kabel — sama dengan shortcut angka 1–6 di App. */
const WIRE_SWATCHES: Array<{ hex: string; label: string }> = [
  { hex: '#EF4444', label: 'Merah' },
  { hex: '#1F2937', label: 'Hitam' },
  { hex: '#3B82F6', label: 'Biru' },
  { hex: '#22C55E', label: 'Hijau' },
  { hex: '#EAB308', label: 'Kuning' },
  { hex: '#F97316', label: 'Oranye' },
];

function GroupLabel({ children }: { children: string }) {
  return (
    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
      {children}
    </span>
  );
}

function Separator() {
  return <div className="h-5 w-px shrink-0 bg-border-subtle" aria-hidden />;
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'size-3.5',
  'aria-hidden': true,
} as const;

export default function ToolbarBar() {
  const wireColor = useCircuitStore((s) => s.wireColor);
  const setWireColor = useCircuitStore((s) => s.setWireColor);
  const canUndo = useCircuitStore((s) => s.canUndo);
  const canRedo = useCircuitStore((s) => s.canRedo);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const deleteMode = useCircuitStore((s) => s.deleteMode);
  const setDeleteMode = useCircuitStore((s) => s.setDeleteMode);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  };

  const toolButton =
    'flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors';

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 overflow-x-auto border-b border-border-subtle bg-panel px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* ===== Grup: warna kabel aktif ===== */}
      <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Warna kabel aktif">
        <GroupLabel>Kabel</GroupLabel>
        <div className="flex items-center gap-1.5">
          {WIRE_SWATCHES.map((c, i) => {
            const active = wireColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                title={`${c.label} (tombol ${i + 1})`}
                aria-label={`Warna kabel ${c.label}`}
                aria-pressed={active}
                onClick={() => setWireColor(c.hex)}
                className={`flex size-[22px] items-center justify-center rounded-full border-2 text-[9px] font-bold text-white/90 transition-transform ${
                  active ? 'scale-110 border-accent-primary' : 'border-transparent'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* ===== Grup: undo / redo ===== */}
      <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Urungkan dan ulangi">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Urungkan (Ctrl+Z)"
          className={`${toolButton} border-border-subtle text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle`}
        >
          <svg {...iconProps}>
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
          Undo
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Ulangi (Ctrl+Shift+Z)"
          className={`${toolButton} border-border-subtle text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle`}
        >
          <svg {...iconProps}>
            <path d="m15 14 5-5-5-5" />
            <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
          </svg>
          Redo
        </button>
      </div>

      <Separator />

      {/* ===== Grup: mode hapus ===== */}
      <button
        type="button"
        onClick={() => setDeleteMode(!deleteMode)}
        aria-pressed={deleteMode}
        title="Mode hapus: klik komponen/kabel untuk menghapusnya (Esc untuk keluar)"
        className={`${toolButton} ${
          deleteMode
            ? 'border-accent-danger bg-accent-danger/20 font-semibold text-accent-danger'
            : 'border-border-subtle text-zinc-200 hover:border-zinc-500'
        }`}
      >
        <svg {...iconProps}>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
        Mode Hapus
      </button>

      <Separator />

      {/* ===== Grup: suara ===== */}
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title="Suara mekanis & elektrik (Web Audio)"
        className={`${toolButton} ${
          soundOn
            ? 'border-accent-primary/60 bg-accent-primary/10 text-accent-primary'
            : 'border-border-subtle text-zinc-400 hover:border-zinc-500'
        }`}
      >
        <svg {...iconProps}>
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          {soundOn ? (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
            </>
          ) : (
            <>
              <path d="m16 9 5 6" />
              <path d="m21 9-5 6" />
            </>
          )}
        </svg>
        Suara: {soundOn ? 'Nyala' : 'Mati'}
      </button>

      <p className="ml-auto hidden shrink-0 text-[11px] text-zinc-500 xl:block">
        R putar · Spasi jalan/jeda · Del hapus · 1–6 warna · Ctrl+Z undo
      </p>
    </div>
  );
}
