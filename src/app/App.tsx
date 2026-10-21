import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Workbench from '../features/stage3d/Workbench';
import { getCameraPreset, type CameraPresetId } from './cameraPresets';
import AutopsyCard from './AutopsyCard';
import InspectorPopover from './InspectorPopover';
import RightDock from './RightDock';
import { initSim } from '../features/simulation/worker/bridge';
import {
  projectFromFileJson,
  projectFromHash,
  projectToFileJson,
  projectToHash,
  toSharedProject,
} from '../features/share/projectShare';
import CatalogPanel from './CatalogPanel';
import ToolbarBar from './ToolbarBar';
import { useExitPresence } from './useExitPresence';
import { useUiSettings } from './uiSettings';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { getComponentPlugin } from '../shared/components/registry';
import { holeLabel } from '../shared/boards/breadboard';
import { playClick } from '../shared/utils/soundFx';
import {
  boardPinById,
  BOARD_DEFINITIONS,
  getBoardDefinition,
} from '../shared/boards/definitions';
import { terminalLabel, type TerminalRef } from '../features/wiring/netlist';

/**
 * Palet warna kabel untuk shortcut angka 1–7 & swatch dock bawah.
 * Urutan + hex 1–6 dipertahankan persis (memori otot); Ungu #7 = PWM (§G).
 */
const SHORTCUT_WIRE_COLORS: Array<{ hex: string; label: string }> = [
  { hex: '#EF4444', label: 'Merah' },
  { hex: '#1F2937', label: 'Hitam' },
  { hex: '#3B82F6', label: 'Biru' },
  { hex: '#22C55E', label: 'Hijau' },
  { hex: '#EAB308', label: 'Kuning' },
  { hex: '#F97316', label: 'Oranye' },
  { hex: '#A855F7', label: 'Ungu' },
];

function terminalDisplay(ref: TerminalRef, boardId: string): string {
  if (ref.kind === 'hole') return holeLabel(ref.holeId);
  const board = getBoardDefinition(boardId);
  return `${board.name} ${boardPinById(board, ref.pinId)?.label ?? ref.pinId}`;
}

/** Ikon SVG stroke kecil untuk shell HUD (grid 24, stroke 2, round caps). */
function ShellIcon({
  name,
  className = 'size-4',
}: {
  name: 'play' | 'stop' | 'share' | 'chevron' | 'chip';
  className?: string;
}) {
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    );
  }
  if (name === 'stop') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
      </svg>
    );
  }
  if (name === 'share') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 15V3" />
        <path d="m7 8 5-5 5 5" />
        <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      </svg>
    );
  }
  if (name === 'chevron') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" />
    </svg>
  );
}

type MenuId = 'demo' | 'proyek';

/**
 * Shell aplikasi — Floating Studio HUD (SINTESIS-FINAL):
 * kanvas 3D full-bleed z-0; semua panel melayang di lapisan overlay
 * (pointer-events-none, tiap panel pointer-events-auto). Skala z:
 * 0 kanvas · 10 pelampung panggung · 20 panel · 25 popover · 30 probe ·
 * 40 autopsy · 50 toast. Semua state rangkaian hidup di useCircuitStore.
 */
/** Baris setelan on/off untuk popover bantuan: tombol role="switch". */
function SettingsSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-zinc-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked
            ? 'border-accent-primary/60 bg-accent-primary/25'
            : 'border-border-interactive bg-panel-elevated'
        }`}
      >
        <span
          className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all duration-200 ease-[cubic-bezier(0.34,1.3,0.64,1)] ${
            checked ? 'left-[18px] bg-accent-primary' : 'left-[3px] bg-zinc-400'
          }`}
        />
      </button>
    </div>
  );
}

/** Ikon putar untuk status "Memproses…" — putarannya dimatikan oleh
 *  aturan prefers-reduced-motion global di index.css; teksnya tetap tampil. */
function SpinnerIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export default function App() {
  const running = useCircuitStore((s) => s.running);
  const simBusy = useCircuitStore((s) => s.simBusy);
  const sketchError = useCircuitStore((s) => s.sketchError);
  const setRunning = useCircuitStore((s) => s.setRunning);
  const boardId = useCircuitStore((s) => s.boardId);
  const setBoard = useCircuitStore((s) => s.setBoard);
  const instances = useCircuitStore((s) => s.instances);
  const wires = useCircuitStore((s) => s.wires);
  const placingType = useCircuitStore((s) => s.placingType);
  const pendingFrom = useCircuitStore((s) => s.pendingFrom);
  const selectedInstanceId = useCircuitStore((s) => s.selectedInstanceId);
  const selectedWireId = useCircuitStore((s) => s.selectedWireId);
  const removeWire = useCircuitStore((s) => s.removeWire);
  const loadDemo = useCircuitStore((s) => s.loadDemo);
  const clearAll = useCircuitStore((s) => s.clearAll);
  const hover = useCircuitStore((s) => s.hover);
  const loadShared = useCircuitStore((s) => s.loadShared);
  const pinHoles = useCircuitStore((s) => s.pinHoles);
  const deleteMode = useCircuitStore((s) => s.deleteMode);
  const setCameraView = useCircuitStore((s) => s.setCameraView);
  const autopsy = useCircuitStore((s) => s.autopsy);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const voltages = useCircuitStore((s) => s.voltages);
  const netNameOf = useCircuitStore((s) => s.netNameOf);
  const turntable = useUiSettings((s) => s.turntable);
  const setTurntable = useUiSettings((s) => s.setTurntable);
  const showBadges = useUiSettings((s) => s.showBadges);
  const setShowBadges = useUiSettings((s) => s.setShowBadges);

  // Reset Kamera lama kini = tombol [3D] kapsul kamera (preset Perspektif
  // lewat cameraView). resetSignal dipertahankan untuk prop Workbench.
  const [resetSignal] = useState(0);
  const mounted = useRef(false);

  // --- Popover shell (menu Demo/Proyek/kamera + panel "?") ---
  const [helpOpen, setHelpOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const helpOpenRef = useRef(false);
  const openMenuRef = useRef<MenuId | null>(null);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const setHelp = (v: boolean) => {
    helpOpenRef.current = v;
    setHelpOpen(v);
    if (v) {
      openMenuRef.current = null;
      setOpenMenu(null);
    }
  };
  const setMenu = (v: MenuId | null) => {
    openMenuRef.current = v;
    setOpenMenu(v);
    if (v) {
      helpOpenRef.current = false;
      setHelpOpen(false);
    }
  };
  const closePopovers = () => {
    helpOpenRef.current = false;
    setHelpOpen(false);
    openMenuRef.current = null;
    setOpenMenu(null);
  };

  // --- Presence animasi keluar (useExitPresence) ---
  // Elemen kondisional HUD tidak lagi lenyap mendadak: node ditahan
  // 150–170ms dengan kelas .hud-exit/.hud-exit-slide sementara state
  // sumbernya sudah mati. Konten dinamis dirender dari nilai terakhir
  // (ref) selama exit agar tidak berkedip kosong.
  const demoMenuP = useExitPresence(openMenu === 'demo', 150);
  const proyekMenuP = useExitPresence(openMenu === 'proyek', 150);
  const helpP = useExitPresence(helpOpen, 150);
  const autopsyP = useExitPresence(autopsy !== null, 170);
  const busyP = useExitPresence(simBusy, 160);
  const placingP = useExitPresence(placingType !== null, 160);
  const lastPlacingRef = useRef(placingType);
  useEffect(() => {
    if (placingType) lastPlacingRef.current = placingType;
  }, [placingType]);
  const deleteP = useExitPresence(deleteMode, 160);
  const toastP = useExitPresence(shareNote !== null, 160);
  const lastNoteRef = useRef(shareNote);
  useEffect(() => {
    if (shareNote) lastNoteRef.current = shareNote;
  }, [shareNote]);
  const pendingP = useExitPresence(pendingFrom !== null, 160);
  const lastPendingRef = useRef(pendingFrom);
  useEffect(() => {
    if (pendingFrom) lastPendingRef.current = pendingFrom;
  }, [pendingFrom]);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    initSim((snapshot) => useCircuitStore.getState().applySnapshot(snapshot));
    const shared = projectFromHash(window.location.hash);
    if (shared) {
      loadShared(shared);
      setShareNote('Proyek dimuat dari tautan bersama.');
    } else {
      loadDemo();
    }
  }, [loadDemo, loadShared]);

  // Toast shareNote hilang sendiri setelah 6 detik.
  useEffect(() => {
    if (!shareNote) return;
    const t = setTimeout(() => setShareNote(null), 6000);
    return () => clearTimeout(t);
  }, [shareNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // PENJAGA FOKUS: jangan pernah menelan ketikan user — semua shortcut
      // dimatikan saat fokus di input/textarea/select/contenteditable atau
      // di dalam editor sketch CodeMirror (.cm-editor). Ini juga mencegah
      // Delete/Backspace saat mengetik menghapus komponen terpilih.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable ||
          target.closest('.cm-editor')
        ) {
          return;
        }
      }
      const state = useCircuitStore.getState();

      // Kombinasi undo/redo adalah satu-satunya shortcut ber-modifier.
      if (e.ctrlKey || e.metaKey) {
        if (e.altKey) return;
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) state.redo();
          else state.undo();
        } else if (key === 'y') {
          e.preventDefault();
          state.redo();
        }
        return;
      }
      if (e.altKey || e.repeat) return;

      // Esc menutup popover shell lebih dulu sebelum membatalkan mode.
      if (e.key === 'Escape') {
        if (helpOpenRef.current) {
          setHelp(false);
          helpBtnRef.current?.focus();
          return;
        }
        if (openMenuRef.current) {
          setMenu(null);
          return;
        }
      }

      switch (e.key) {
        case 'Escape':
          state.cancelPending();
          if (state.deleteMode) state.setDeleteMode(false);
          break;
        case 'Delete':
        case 'Backspace':
          if (state.selectedWireId) state.removeWire(state.selectedWireId);
          else if (state.selectedInstanceId) state.removeInstance(state.selectedInstanceId);
          break;
        case 'r':
        case 'R':
          if (state.placingType) state.rotatePlacement();
          break;
        case ' ': {
          // I-3: bila Space ditekan saat fokus di elemen interaktif
          // (tombol/tautan), itu aktivasi bawaan elemen tersebut —
          // jangan dirampas untuk men-toggle Run.
          if (target?.closest('button, a, [role="button"]')) break;
          e.preventDefault();
          // Tombol yang baru diklik (mis. "Jalankan") masih memegang fokus,
          // dan Space akan memicu klik tombol itu pada keyup → Run menyala
          // lalu mati sendiri. Lepaskan fokus tombol lebih dulu.
          // (e.repeat sudah disaring di atas switch.)
          const active = document.activeElement;
          if (active instanceof HTMLButtonElement) active.blur();
          // Selaras dengan kunci tombol Jalankan: selama proses sesi
          // berjalan (simBusy) dan simulasi belum jalan, Space tidak
          // boleh menumpuk eksekusi start baru. Berhenti (running)
          // tetap selalu boleh.
          if (!state.running && state.simBusy) break;
          state.setRunning(!state.running);
          break;
        }
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
          state.setWireColor(SHORTCUT_WIRE_COLORS[Number(e.key) - 1].hex);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mode Hapus: seleksi berikutnya (komponen/kabel) langsung dihapus.
  // Klik kosong tidak memilih apa pun → tidak menghapus apa pun.
  useEffect(() => {
    if (!deleteMode) return;
    const state = useCircuitStore.getState();
    if (state.selectedWireId) {
      state.removeWire(state.selectedWireId);
      playClick(300);
    } else if (state.selectedInstanceId) {
      state.removeInstance(state.selectedInstanceId);
      playClick(300);
    }
  }, [deleteMode, selectedInstanceId, selectedWireId]);

  const currentProject = () =>
    toSharedProject({
      boardId,
      instances,
      pinHoles: useCircuitStore.getState().pinHoles,
      wires,
      sketchCode: useCircuitStore.getState().sketchCode,
    });

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}${projectToHash(currentProject())}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote('Tautan proyek tersalin. Bagikan ke siapa pun untuk membuka rangkaian yang sama.');
    } catch {
      window.location.hash = projectToHash(currentProject());
      setShareNote('Tautan ada di address bar browser — salin dari sana.');
    }
  };

  const handleExport = () => {
    const blob = new Blob([projectToFileJson(currentProject())], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'proyek-simulator.rangkai';
    anchor.click();
    URL.revokeObjectURL(url);
    setShareNote('Berkas .rangkai terunduh.');
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const project = projectFromFileJson(await file.text());
    if (project) {
      loadShared(project);
      setShareNote('Proyek dari berkas berhasil dimuat.');
    } else {
      setShareNote('Berkas itu bukan proyek .rangkai yang valid.');
    }
  };

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) ?? null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) ?? null;
  const wireP = useExitPresence(selectedWire !== null, 150);
  const lastWireRef = useRef(selectedWire);
  useEffect(() => {
    if (selectedWire) lastWireRef.current = selectedWire;
  }, [selectedWire]);
  const shownWire = selectedWire ?? lastWireRef.current;
  const anyDamaged = instances.some((i) => i.simState.isDamaged);
  const hoverNet = hover ? netNameOf(hover.ref) : null;
  const hoverVolts = hoverNet !== null ? voltages[hoverNet] : undefined;

  // --- Probe multimeter: status tegangan vs tegangan logika board aktif ---
  const logicVolts = getBoardDefinition(boardId).profile.logicVolts;
  const hoverVoltsClass =
    hoverVolts === undefined
      ? ''
      : hoverVolts > logicVolts + 0.5
        ? 'font-semibold text-accent-danger'
        : hoverVolts > logicVolts
          ? 'text-accent-warning'
          : 'text-accent-run';
  // Arus hanya ditampilkan bila lubang yang di-hover adalah pin komponen
  // DAN komponen itu punya tepat satu cabang arus (tidak menebak multi-cabang).
  let hoverAmpsMa: number | undefined;
  const hoverRef = hover?.ref;
  if (hoverRef?.kind === 'hole') {
    const owner = instances.find((i) =>
      Object.values(pinHoles[i.id] ?? {}).includes(hoverRef.holeId),
    );
    if (owner) {
      const currents = Object.values(owner.simState.branchCurrents);
      if (currents.length === 1) hoverAmpsMa = currents[0] * 1000;
    }
  }

  // --- Preset kamera (CameraRig mengeksekusi lewat cameraView) ---
  // Empat tombol langsung tanpa dropdown: Perspektif / Atas / Dekat /
  // Fokus. Definisi posisi & target yang murni ada di cameraPresets.ts
  // (dites unit); kompensasi inset proyeksi diterapkan CameraRig saat
  // eksekusi, bukan di sini.
  const applyCameraPreset = (preset: CameraPresetId) => {
    const view = getCameraPreset(preset, {
      boardOrigin: getBoardDefinition(boardId).origin,
      selectedPosition: selectedInstance
        ? ([...selectedInstance.position] as [number, number, number])
        : null,
    });
    if (!view) return;
    setActivePreset(preset);
    setCameraView(view.target, view.position);
  };

  const statusText = anyDamaged
    ? 'Ada komponen rusak'
    : sketchError
      ? 'Sketch berhenti — ada error'
      : running
        ? 'Simulasi berjalan'
        : 'Simulasi berhenti';

  // Kunci eksekusi start selama proses sesi berjalan: simBusy menyala dan
  // simulasi belum jalan → start baru (tombol Jalankan, Space, Jalankan
  // Ulang) ditahan sampai snapshot tiba agar perintah tidak menumpuk di
  // worker. Bila SUDAH running, tombol yang sama berfungsi sebagai
  // Berhenti dan TIDAK PERNAH dikunci — setRunning(false) memadamkan
  // simBusy seketika dari sisi UI, jadi Berhenti selalu jadi jalan keluar.
  const startLocked = simBusy && !running;

  const capsuleShadow =
    'shadow-[0_8px_32px_rgb(0_0_0/0.45),0_2px_8px_rgb(0_0_0/0.4)]';
  const menuItemClass =
    'flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium text-zinc-200 transition-colors hover:bg-panel-elevated active:scale-[0.98]';
  const popoverClass = `hud-pop absolute z-[25] rounded-2xl border border-border-subtle bg-panel ${capsuleShadow}`;
  // Kelas presence popover: hidup = pointer aktif; exit = .hud-exit +
  // pointer mati agar klik meneruskan seketika (animasi tak menahan aksi).
  const popoverPresence = (p: { exiting: boolean }) =>
    p.exiting ? 'hud-exit pointer-events-none' : 'pointer-events-auto';

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-panel">
      {/* ===== Kanvas 3D full-bleed (z-0, stacking context mengurung drei Html) ===== */}
      <div className={`absolute inset-0 z-0 ${deleteMode ? 'cursor-trash' : ''}`}>
        <Workbench resetSignal={resetSignal} />
      </div>

      {/* ===== Lapisan overlay: semua panel melayang ===== */}
      <div className="pointer-events-none absolute inset-0">
        {/* Kapsul kiri: identitas + board + menu Demo */}
        <div
          className={`hud-enter hud-glass pointer-events-auto absolute left-3 top-3 z-20 flex h-11 items-center gap-3 rounded-full border border-border-subtle px-3 ${capsuleShadow}`}
        >
          <span
            className="flex items-center gap-2.5"
            title="Simulator Elektronika 3D — Meja Praktikum Virtual"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-workbench-mat text-accent-primary">
              <ShellIcon name="chip" className="size-4" />
            </span>
            <span className="hidden whitespace-nowrap text-[15px] font-bold tracking-tight text-zinc-100 min-[1440px]:inline">
              Simulator Elektronika 3D
            </span>
            <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-zinc-100 min-[1440px]:hidden">
              Sim3D
            </span>
          </span>

          <span className="h-6 w-px shrink-0 bg-border-subtle" aria-hidden="true" />

          <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
            Board
            <select
              aria-label="Pilih board"
              disabled={simBusy}
              title={simBusy ? 'Tunggu proses selesai' : undefined}
              className="h-8 rounded-lg border border-border-interactive bg-panel-elevated px-2 text-[13px] font-medium text-zinc-100 outline-none focus:border-accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              value={boardId}
              onChange={(e) => setBoard(e.target.value)}
            >
              {Object.values(BOARD_DEFINITIONS).map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'demo'}
            onClick={() => setMenu(openMenu === 'demo' ? null : 'demo')}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border-interactive px-2.5 text-[13px] font-medium text-zinc-200 transition-colors hover:border-accent-primary hover:text-accent-primary active:scale-[0.97]"
          >
            Demo
            <ShellIcon name="chevron" className="size-3.5" />
          </button>
        </div>

        {/* Kapsul tengah: kontrol Run tunggal + status (terpusat pada rektangel bebas) */}
        <div className="absolute left-[276px] right-[392px] top-3 z-20 flex justify-center max-[1279px]:left-[248px]">
          <div
            className={`hud-enter hud-glass pointer-events-auto flex h-11 items-center gap-3 rounded-full border border-border-subtle py-1.5 pl-1.5 pr-4 ${capsuleShadow}`}
            style={{ animationDelay: '40ms' }}
          >
            <button
              type="button"
              onClick={() => setRunning(!running)}
              disabled={startLocked}
              aria-label={startLocked ? 'Memproses…' : running ? 'Berhenti' : 'Jalankan'}
              className={`flex h-8 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${
                startLocked
                  ? 'bg-panel-elevated text-zinc-300'
                  : running
                    ? 'bg-accent-warning text-[#2a1a00] hover:bg-amber-400'
                    : 'bg-accent-run text-[#032117] hover:bg-emerald-400'
              }`}
            >
              {startLocked ? (
                <>
                  <SpinnerIcon className="size-3.5 shrink-0 animate-spin text-accent-primary" />
                  Memproses…
                </>
              ) : (
                <>
                  <span
                    key={running ? 'berhenti' : 'jalankan'}
                    className="hud-micro-pop relative inline-block size-3.5 shrink-0"
                    aria-hidden="true"
                  >
                    <span
                      className={`absolute inset-0 transition-opacity duration-150 ${running ? 'opacity-0' : 'opacity-100'}`}
                    >
                      <ShellIcon name="play" className="size-3.5" />
                    </span>
                    <span
                      className={`absolute inset-0 transition-opacity duration-150 ${running ? 'opacity-100' : 'opacity-0'}`}
                    >
                      <ShellIcon name="stop" className="size-3.5" />
                    </span>
                  </span>
                  {running ? 'Berhenti' : 'Jalankan'}
                </>
              )}
            </button>
            <div
              role="status"
              aria-live="polite"
              className="flex min-w-0 items-center gap-2 text-xs text-zinc-300"
            >
              <span
                className={`inline-block size-2 shrink-0 rounded-full ${
                  anyDamaged || sketchError
                    ? 'bg-accent-danger'
                    : running
                      ? 'hud-pulse bg-accent-run'
                      : 'bg-zinc-500'
                }`}
              />
              <span key={statusText} className="hud-fade-in truncate whitespace-nowrap">
                {statusText}
              </span>
            </div>
          </div>
        </div>

        {/* Kapsul kanan: Bagikan + menu Proyek + bantuan */}
        <div
          className={`hud-enter hud-glass pointer-events-auto absolute right-3 top-3 z-20 flex h-11 items-center gap-2 rounded-full border border-border-subtle px-2 ${capsuleShadow}`}
          style={{ animationDelay: '80ms' }}
        >
          <button
            type="button"
            onClick={handleShare}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/15 active:scale-[0.97]"
          >
            <ShellIcon name="share" className="size-4" />
            Bagikan
          </button>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'proyek'}
            onClick={() => setMenu(openMenu === 'proyek' ? null : 'proyek')}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border-interactive px-2.5 text-[13px] font-medium text-zinc-200 transition-colors hover:border-accent-primary hover:text-accent-primary active:scale-[0.97]"
          >
            Proyek
            <ShellIcon name="chevron" className="size-3.5" />
          </button>
          <button
            ref={helpBtnRef}
            type="button"
            aria-label="Bantuan dan pintasan keyboard"
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            title="Bantuan dan pintasan keyboard"
            onClick={() => setHelp(!helpOpen)}
            className={`grid size-8 shrink-0 place-items-center rounded-full border text-[15px] font-bold transition-colors active:scale-[0.97] ${
              helpOpen
                ? 'border-accent-primary text-accent-primary'
                : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
            }`}
          >
            ?
          </button>
        </div>

        {/* Panel katalog (konten: CatalogPanel) */}
        <div
          className="hud-enter pointer-events-auto absolute bottom-[76px] left-3 top-[68px] z-20 flex w-[264px] max-[1279px]:w-[224px]"
          style={{ animationDelay: '120ms' }}
        >
          <CatalogPanel />
        </div>

        {/* Dock kanan: editor/serial/panduan (konten: RightDock) */}
        <div
          className="hud-enter pointer-events-auto absolute bottom-[76px] right-3 top-[68px] z-20 flex w-[380px]"
          style={{ animationDelay: '160ms' }}
        >
          <RightDock />
        </div>

        {/* Dock bawah (konten: ToolbarBar) */}
        <div className="absolute bottom-3 left-[288px] right-[404px] z-20 flex justify-center max-[1279px]:left-[248px]">
          <div className="hud-enter-up pointer-events-auto max-w-full" style={{ animationDelay: '200ms' }}>
            <ToolbarBar />
          </div>
        </div>

        {/* Kapsul kamera (kanan bawah): empat tombol langsung, TANPA dropdown.
            Fokus hanya tampil bila ada komponen terpilih. */}
        <div
          className={`hud-enter-up hud-glass pointer-events-auto absolute bottom-3 right-3 z-10 flex h-11 items-center gap-1 rounded-full border border-border-subtle px-1.5 ${capsuleShadow}`}
          style={{ animationDelay: '240ms' }}
          role="group"
          aria-label="Preset kamera"
        >
          {(
            [
              { id: 'perspektif', label: 'Perspektif', title: 'Tampilan perspektif meja kerja' },
              { id: 'atas', label: 'Atas', title: 'Lihat meja kerja tegak dari atas' },
              { id: 'dekat', label: 'Dekat', title: 'Bidikan dekat ke pusat area kerja' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={activePreset === p.id}
              title={p.title}
              onClick={() => applyCameraPreset(p.id)}
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${
                activePreset === p.id
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
          {selectedInstance && (
            <button
              type="button"
              aria-pressed={activePreset === 'fokus'}
              title="Fokus dekat ke komponen terpilih"
              onClick={() => applyCameraPreset('fokus')}
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${
                activePreset === 'fokus'
                  ? 'border-accent-primary text-accent-primary'
                  : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
              }`}
            >
              Fokus
            </button>
          )}
        </div>

        {/* Tumpukan tengah-atas: pill proses/mode → inspector → autopsy */}
        <div className="absolute left-[276px] right-[392px] top-[68px] z-10 flex justify-center max-[1279px]:left-[248px]">
          <div className="flex w-full max-w-[400px] flex-col items-center gap-2">
            {/* Indikator proses sesi (simBusy): worker sedang memproses
                perintah berat (transpile + solve) di belakang layar —
                tanpa pill ini UI tampak diam/hang padahal sedang bekerja. */}
            {busyP.mounted && (
              <div
                role="status"
                aria-live="polite"
                className={`pointer-events-none flex items-center gap-2 rounded-full border border-border-subtle bg-panel px-3.5 py-2 text-xs font-medium text-zinc-200 ${capsuleShadow} ${
                  busyP.exiting ? 'hud-exit' : 'hud-pop'
                }`}
              >
                <SpinnerIcon className="size-3.5 shrink-0 animate-spin text-accent-primary" />
                Memproses…
              </div>
            )}
            {placingP.mounted && (
              <div
                className={`pointer-events-none rounded-full border border-accent-primary/50 bg-panel/90 px-3.5 py-2 text-xs font-medium text-accent-primary backdrop-blur-md ${
                  placingP.exiting ? 'hud-exit' : 'hud-pop'
                }`}
              >
                Mode pasang: klik lubang breadboard untuk menaruh{' '}
                {getComponentPlugin(lastPlacingRef.current ?? '')?.name ??
                  lastPlacingRef.current}{' '}
                (Esc untuk batal)
              </div>
            )}
            {deleteP.mounted && (
              <div
                className={`pointer-events-none rounded-full border border-accent-danger/60 bg-panel/90 px-3.5 py-2 text-xs font-semibold text-red-200 backdrop-blur-md ${
                  deleteP.exiting ? 'hud-exit' : 'hud-pop'
                }`}
              >
                Mode Hapus aktif — klik komponen atau kabel untuk menghapus (Esc keluar)
              </div>
            )}

            {/* Popover inspector komponen — komponen terpisah dengan
                langganan store presisi tampil; render ulang App tidak
                mengecat ulangnya (lihat InspectorPopover.tsx). */}
            <InspectorPopover />

            {/* Popover inspector kabel (presence: keluar .hud-exit dari
                data kabel terakhir; selama exit pointer-events mati) */}
            {wireP.mounted && shownWire && (
              <div
                className={`w-full rounded-2xl border border-border-subtle bg-panel/95 p-3 ${capsuleShadow} ${
                  wireP.exiting ? 'hud-exit pointer-events-none' : 'hud-pop pointer-events-auto'
                }`}
              >
                <h3 className="text-[13px] font-semibold text-zinc-100">Kabel Terpilih</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {terminalLabel(shownWire.a, getBoardDefinition(boardId))} →{' '}
                  {terminalLabel(shownWire.b, getBoardDefinition(boardId))}
                </p>
                <button
                  type="button"
                  onClick={() => removeWire(shownWire.id)}
                  className="mt-2.5 h-7 w-full rounded-lg border border-border-interactive text-xs font-medium text-zinc-200 transition-colors hover:border-accent-danger hover:text-red-200 active:scale-[0.97]"
                >
                  Hapus Kabel
                </button>
              </div>
            )}

            {/* AutopsyCard memposisikan dirinya absolute — slot menetralkannya
                via CSS (.hud-autopsy-slot > section) agar mengalir dalam stack.
                Slot ditahan presence App selama exit kartu berjalan. */}
            {autopsyP.mounted && (
              <div className="hud-autopsy-slot pointer-events-auto relative z-40 w-full">
                <AutopsyCard exiting={autopsyP.exiting} />
              </div>
            )}
          </div>
        </div>

        {/* Backdrop penutup popover (klik di mana saja menutup menu/bantuan) */}
        {(openMenu || helpOpen) && (
          <div
            className="pointer-events-auto absolute inset-0 z-[24]"
            aria-hidden="true"
            onClick={closePopovers}
          />
        )}

        {/* Menu Demo */}
        {demoMenuP.mounted && (
          <div
            className={`${popoverClass} ${popoverPresence(demoMenuP)} hud-pop-origin-tl left-3 top-[60px] w-52 p-1.5`}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} hud-menu-item`}
              onClick={() => {
                loadDemo();
                setMenu(null);
              }}
            >
              Muat Contoh
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} hud-menu-item text-red-200 hover:bg-accent-danger/10`}
              style={{ animationDelay: '35ms' }}
              onClick={() => {
                clearAll();
                setMenu(null);
              }}
            >
              Bersihkan Meja
            </button>
          </div>
        )}

        {/* Menu Proyek */}
        {proyekMenuP.mounted && (
          <div
            className={`${popoverClass} ${popoverPresence(proyekMenuP)} hud-pop-origin-tr right-3 top-[60px] w-44 p-1.5`}
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} hud-menu-item`}
              onClick={() => {
                handleExport();
                setMenu(null);
              }}
            >
              Ekspor
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${menuItemClass} hud-menu-item`}
              style={{ animationDelay: '35ms' }}
              onClick={() => {
                setMenu(null);
                importRef.current?.click();
              }}
            >
              Impor
            </button>
          </div>
        )}

        {/* Popover bantuan "?" — satu rumah untuk semua referensi (§E) */}
        {helpP.mounted && (
          <div
            className={`${popoverClass} ${popoverPresence(helpP)} hud-pop-origin-tr right-3 top-[60px] w-[350px] max-w-[calc(100vw-24px)] p-4`}
            role="dialog"
            aria-label="Bantuan dan pintasan keyboard"
          >
            <h2 className="text-sm font-bold text-zinc-100">Bantuan &amp; Pintasan</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">
              Meja Praktikum Virtual — pasang komponen dari katalog, tarik kabel
              antar terminal, lalu tekan Jalankan.
            </p>
            {(
              [
                {
                  title: 'Menjalankan simulasi',
                  rows: [
                    ['Spasi', 'Jalankan / Berhenti'],
                    ['Titik status', 'Hijau berjalan · abu berhenti · merah error/rusak'],
                  ],
                },
                {
                  title: 'Merakit rangkaian',
                  rows: [
                    ['R', 'Putar komponen saat memasang'],
                    ['1–7', 'Pilih warna kabel'],
                    ['Delete', 'Hapus pilihan'],
                    ['Esc', 'Batalkan / keluar mode'],
                  ],
                },
                {
                  title: 'Mengedit',
                  rows: [
                    ['Ctrl+Z', 'Urungkan'],
                    ['Ctrl+Shift+Z', 'Ulangi'],
                    ['Ctrl+Y', 'Ulangi'],
                  ],
                },
                {
                  title: 'Kamera',
                  rows: [
                    ['Seret', 'Memutar'],
                    ['Roda tetikus', 'Memperbesar'],
                    ['Seret kanan', 'Menggeser'],
                    ['Preset', 'Perspektif · Atas · Dekat · Fokus (tombol langsung, kanan bawah)'],
                  ],
                },
              ] as const
            ).map((group) => (
              <div key={group.title} className="mt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  {group.title}
                </h3>
                <dl className="mt-1.5 space-y-1">
                  {group.rows.map(([key, desc]) => (
                    <div key={key} className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0">
                        <kbd className="rounded-md border border-border-interactive bg-panel-elevated px-1.5 py-0.5 font-mono text-[11px] text-zinc-100">
                          {key}
                        </kbd>
                      </dt>
                      <dd className="text-right text-xs text-zinc-300">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            {/* Bagian Tampilan — setelan tampilan (store useUiSettings) */}
            <div className="mt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Tampilan
              </h3>
              <div className="mt-1.5 space-y-2">
                <SettingsSwitch
                  label="Putar otomatis saat idle"
                  checked={turntable}
                  onChange={setTurntable}
                />
                <SettingsSwitch
                  label="Label nilai komponen"
                  checked={showBadges}
                  onChange={setShowBadges}
                />
              </div>
            </div>
          </div>
        )}

        {/* Toast shareNote + pill petunjuk kabel, terpusat di atas dock bawah */}
        <div className="absolute bottom-[68px] left-[288px] right-[404px] z-50 flex flex-col items-center gap-2 max-[1279px]:left-[248px]">
          {toastP.mounted && (
            <div
              role="status"
              className={`rounded-full border border-border-subtle bg-panel px-4 py-2 text-center text-xs text-zinc-200 ${capsuleShadow} ${
                toastP.exiting ? 'hud-exit-slide' : 'hud-content-enter'
              }`}
            >
              {lastNoteRef.current}
            </div>
          )}
          {pendingP.mounted && lastPendingRef.current && (
            <div
              className={`rounded-full border border-accent-warning/50 bg-panel/90 px-3.5 py-2 text-xs font-medium text-accent-warning backdrop-blur-md ${
                pendingP.exiting ? 'hud-exit-slide' : 'hud-content-enter'
              }`}
            >
              Kabel dari {terminalDisplay(lastPendingRef.current, boardId)} — klik terminal tujuan.
            </div>
          )}
        </div>
      </div>

      {/* Input impor tersembunyi (tetap di App; dipicu dari menu Proyek) */}
      <input
        ref={importRef}
        type="file"
        accept=".rangkai,application/json"
        className="hidden"
        onChange={handleImport}
      />

      {/* Probe multimeter mengikuti kursor — TETAP anak langsung root.
          Satu sistem pill dengan LiveBadge: rounded-full, bg-panel/95,
          13px semibold tabular, desimal koma id-ID, teks sekunder minimal
          zinc-400 (lantai kontras). Posisi: offset tetap dari kursor,
          membalik ke sisi lain kursor dekat tepi kanan/bawah viewport
          agar tidak pernah terpotong keluar layar. */}
      {hover && (
        <div
          className="pointer-events-none fixed z-30 whitespace-nowrap rounded-full border border-border-subtle bg-panel/95 px-3 py-1.5 font-mono text-[13px] font-semibold tabular-nums text-zinc-100 shadow-lg"
          style={{
            left: hover.clientX,
            top: hover.clientY,
            transform: `translate(${
              hover.clientX > window.innerWidth - 300
                ? 'calc(-100% - 14px)'
                : '14px'
            }, ${
              hover.clientY > window.innerHeight - 80
                ? 'calc(-100% - 14px)'
                : '16px'
            })`,
          }}
        >
          <span className="text-accent-primary">{terminalDisplay(hover.ref, boardId)}</span>
          {hoverNet && (
            <span className="font-medium text-zinc-400"> · net {hoverNet}</span>
          )}
          {hoverVolts !== undefined && (
            <span className={hoverVoltsClass}>
              {' '}
              · {hoverVolts.toFixed(2).replace('.', ',')} V
            </span>
          )}
          {hoverAmpsMa !== undefined && (
            <span className="font-medium text-zinc-400">
              {' '}
              · ≈ {hoverAmpsMa.toFixed(1).replace('.', ',')} mA
            </span>
          )}
          {pendingFrom && <span className="text-accent-warning"> · klik tujuan kabel</span>}
        </div>
      )}
    </div>
  );
}
