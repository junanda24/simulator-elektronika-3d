import { useState } from 'react';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { WIRE_COLORS } from '../features/wiring/wireColors';
import { isSoundEnabled, setSoundEnabled } from '../shared/utils/soundFx';

/**
 * Dock Bawah melayang (redesign Floating Studio HUD, SINTESIS §B/§G):
 * kapsul full-round h-12 yang terpusat pada rektangel bebas di bawah
 * kanvas — [7 swatch warna kabel] | [Undo/Redo] | [Putar] |
 * [Mode Tangan] [Mode Hapus] | [Suara]. Glass ringan panel/90 + blur; semua kontrol
 * area sentuh ≥40px dengan ikon SVG stroke bersama (grid 24).
 * Diimpor App dengan nama & komponen yang sama seperti bar lama.
 */

/**
 * Palet kabel = WIRE_COLORS kanonik dari features/wiring/wireColors.ts
 * (satu sumber kebenaran bersama store; perilaku radio — tepat satu
 * warna selalu aktif, tidak bisa dimatikan). Pemetaan shortcut angka
 * hidup di App.tsx (SHORTCUT_WIRE_COLORS) dengan hex yang sama persis.
 */

function Separator() {
  return <div className="h-6 w-px shrink-0 bg-border-subtle" aria-hidden />;
}

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'size-4',
  'aria-hidden': true,
} as const;

/** Satu set ikon SVG stroke bersama untuk seluruh dock (SINTESIS §A). */
function Icon({ name }: { name: 'undo' | 'redo' | 'rotate' | 'trash' | 'hand' | 'soundOn' | 'soundOff' }) {
  switch (name) {
    case 'hand':
      // Tangan terbuka (jalur stroke gaya Lucide "hand"): empat jari +
      // ibu jari — ikon baku untuk alat geser/pan di editor grafis.
      return (
        <svg {...iconProps}>
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...iconProps}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      );
    case 'redo':
      return (
        <svg {...iconProps}>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </svg>
      );
    case 'rotate':
      return (
        <svg {...iconProps}>
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...iconProps}>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      );
    case 'soundOn':
      return (
        <svg {...iconProps}>
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
        </svg>
      );
    case 'soundOff':
      return (
        <svg {...iconProps}>
          <path d="M11 5 6 9H2v6h4l5 4V5Z" />
          <path d="m16 9 5 6" />
          <path d="m21 9-5 6" />
        </svg>
      );
  }
}

export default function ToolbarBar() {
  const wireColor = useCircuitStore((s) => s.wireColor);
  const setWireColor = useCircuitStore((s) => s.setWireColor);
  const canUndo = useCircuitStore((s) => s.canUndo);
  const canRedo = useCircuitStore((s) => s.canRedo);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const placingType = useCircuitStore((s) => s.placingType);
  const rotatePlacement = useCircuitStore((s) => s.rotatePlacement);
  const toolMode = useCircuitStore((s) => s.toolMode);
  const setToolMode = useCircuitStore((s) => s.setToolMode);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  };

  const iconButton =
    'flex size-10 shrink-0 items-center justify-center rounded-full border border-[#5B6478]/60 text-zinc-200 transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#5B6478] hover:text-zinc-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#5B6478]/60 disabled:active:scale-100';

  return (
    <div className="pointer-events-auto mx-auto flex h-12 w-fit max-w-full items-center gap-2 overflow-x-auto rounded-full border border-border-subtle bg-panel/90 px-2.5 shadow-[0_8px_32px_rgb(0_0_0/0.45),0_2px_8px_rgb(0_0_0/0.4)] backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* ===== Grup: warna kabel aktif (7 warna semantik) ===== */}
      <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Warna kabel aktif">
        {WIRE_COLORS.map((c, i) => {
          const active = wireColor.toLowerCase() === c.hex.toLowerCase();
          return (
            <button
              key={c.hex}
              type="button"
              title={`Warna kabel ${c.name}, ${c.role} (tombol ${i + 1})`}
              aria-label={`Warna kabel ${c.name}, ${c.role}`}
              aria-pressed={active}
              onClick={() => setWireColor(c.hex)}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white/90 transition-transform duration-200 ease-[cubic-bezier(0.34,1.3,0.64,1)] [text-shadow:0_1px_2px_rgb(0_0_0/0.45)] ${
                  active ? 'scale-110 border-accent-primary' : 'border-white/15'
                }`}
                style={{ backgroundColor: c.hex }}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      <Separator />

      {/* ===== Grup: undo / redo ===== */}
      <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Urungkan dan ulangi">
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Urungkan (Ctrl+Z)"
          aria-label="Urungkan"
          className={iconButton}
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Ulangi (Ctrl+Shift+Z)"
          aria-label="Ulangi"
          className={iconButton}
        >
          <Icon name="redo" />
        </button>
      </div>

      <Separator />

      {/* ===== Putar komponen yang sedang dipasang ===== */}
      <button
        type="button"
        onClick={rotatePlacement}
        disabled={placingType === null}
        title="Putar komponen yang sedang dipasang (R)"
        aria-label="Putar komponen (R)"
        className={iconButton}
      >
        <Icon name="rotate" />
      </button>

      <Separator />

      {/* ===== Mode tangan (navigasi murni: geser & pilih) ===== */}
      <button
        type="button"
        onClick={() => setToolMode(toolMode === 'hand' ? 'build' : 'hand')}
        aria-pressed={toolMode === 'hand'}
        title="Mode tangan: seret kiri menggeser pandangan, seret kanan memutar, klik untuk memilih (H)"
        className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
          toolMode === 'hand'
            ? 'border-accent-primary/60 bg-accent-primary/20 font-semibold text-accent-primary'
            : 'border-[#5B6478]/60 text-zinc-200 hover:border-[#5B6478]'
        }`}
      >
        <Icon name="hand" />
        Mode Tangan
      </button>

      {/* ===== Mode hapus ===== */}
      <button
        type="button"
        onClick={() => setToolMode(toolMode === 'delete' ? 'build' : 'delete')}
        aria-pressed={toolMode === 'delete'}
        title="Mode hapus: klik komponen/kabel untuk menghapusnya (Esc untuk keluar)"
        className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
          toolMode === 'delete'
            ? 'border-accent-danger/60 bg-accent-danger/20 font-semibold text-red-200'
            : 'border-[#5B6478]/60 text-zinc-200 hover:border-[#5B6478]'
        }`}
      >
        <Icon name="trash" />
        Mode Hapus
      </button>

      <Separator />

      {/* ===== Suara ===== */}
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title={soundOn ? 'Matikan suara' : 'Hidupkan suara'}
        aria-label={soundOn ? 'Matikan suara' : 'Hidupkan suara'}
        className={`${iconButton} ${
          soundOn
            ? 'border-accent-primary/60 bg-accent-primary/10 text-accent-primary hover:border-accent-primary hover:text-accent-primary'
            : 'text-zinc-400'
        }`}
      >
        <Icon name={soundOn ? 'soundOn' : 'soundOff'} />
      </button>
    </div>
  );
}
