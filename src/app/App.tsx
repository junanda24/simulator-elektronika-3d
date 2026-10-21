import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Workbench, { CAMERA_HOME, TARGET_HOME } from '../features/stage3d/Workbench';
import AutopsyCard from './AutopsyCard';
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
import { useUiSettings } from './uiSettings';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { getComponentPlugin } from '../shared/components/registry';
import { BREADBOARD_ORIGIN, holeLabel } from '../shared/boards/breadboard';
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

type MenuId = 'demo' | 'proyek' | 'cam3d' | 'camAtas';

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
          className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all ${
            checked ? 'left-[18px] bg-accent-primary' : 'left-[3px] bg-zinc-400'
          }`}
        />
      </button>
    </div>
  );
}

export default function App() {
  const running = useCircuitStore((s) => s.running);
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
  const removeInstance = useCircuitStore((s) => s.removeInstance);
  const replaceInstance = useCircuitStore((s) => s.replaceInstance);
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
  const boardDef = getBoardDefinition(boardId);
  const breadboardCenter: [number, number, number] = [
    BREADBOARD_ORIGIN[0],
    0,
    BREADBOARD_ORIGIN[2],
  ];
  const tableCenter: [number, number, number] = [
    (boardDef.origin[0] + BREADBOARD_ORIGIN[0]) / 2,
    0,
    (boardDef.origin[2] + BREADBOARD_ORIGIN[2]) / 2,
  ];
  const boardCenter: [number, number, number] = [boardDef.origin[0], 1, boardDef.origin[2]];
  const applyCameraPreset = (
    preset:
      | 'perspektif'
      | 'depan'
      | 'dekat'
      | 'board-miring'
      | 'board-atas'
      | 'bb-miring'
      | 'bb-atas',
  ) => {
    setActivePreset(preset);
    if (preset === 'perspektif') {
      setCameraView(
        [TARGET_HOME.x, TARGET_HOME.y, TARGET_HOME.z],
        [CAMERA_HOME.x, CAMERA_HOME.y, CAMERA_HOME.z],
      );
    } else if (preset === 'depan') {
      setCameraView(tableCenter, [tableCenter[0], 14, 58]);
    } else if (preset === 'board-miring') {
      // Sudut 3/4 dekat ke board mikrokontroler aktif.
      setCameraView(boardCenter, [boardCenter[0] + 14, 13, boardCenter[2] + 18]);
    } else if (preset === 'board-atas') {
      // Tegak lurus di atas board; offset z 0.01 menghindari gimbal lock.
      setCameraView(boardCenter, [boardCenter[0], 55, boardCenter[2] + 0.01]);
    } else if (preset === 'bb-miring') {
      // Sudut 3/4 dekat ke breadboard — enak untuk merangkai kabel.
      setCameraView(breadboardCenter, [
        breadboardCenter[0] + 13,
        17,
        breadboardCenter[2] + 21,
      ]);
    } else if (preset === 'bb-atas') {
      // Tepat tegak lurus di atas breadboard; offset z 0.01 menghindari gimbal lock.
      setCameraView(breadboardCenter, [breadboardCenter[0], 80, breadboardCenter[2] + 0.01]);
    } else {
      const target = selectedInstance
        ? ([...selectedInstance.position] as [number, number, number])
        : breadboardCenter;
      setCameraView(target, [target[0] + 6, target[1] + 5, target[2] + 7]);
    }
  };

  const statusText = anyDamaged
    ? 'Ada komponen rusak'
    : sketchError
      ? 'Sketch berhenti — ada error'
      : running
        ? 'Simulasi berjalan'
        : 'Simulasi berhenti';

  const capsuleShadow =
    'shadow-[0_8px_32px_rgb(0_0_0/0.45),0_2px_8px_rgb(0_0_0/0.4)]';
  const menuItemClass =
    'flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium text-zinc-200 transition-colors hover:bg-panel-elevated active:scale-[0.98]';
  const popoverClass = `hud-pop pointer-events-auto absolute z-[25] rounded-2xl border border-border-subtle bg-panel ${capsuleShadow}`;

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
              className="h-8 rounded-lg border border-border-interactive bg-panel-elevated px-2 text-[13px] font-medium text-zinc-100 outline-none focus:border-accent-primary"
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
              aria-label={running ? 'Berhenti' : 'Jalankan'}
              className={`flex h-8 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors duration-200 active:scale-[0.97] ${
                running
                  ? 'bg-accent-warning text-[#2a1a00] hover:bg-amber-400'
                  : 'bg-accent-run text-[#032117] hover:bg-emerald-400'
              }`}
            >
              <span className="relative inline-block size-3.5 shrink-0" aria-hidden="true">
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
              <span className="truncate whitespace-nowrap">{statusText}</span>
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

        {/* Kapsul kamera (kanan bawah) */}
        <div
          className={`hud-enter-up hud-glass pointer-events-auto absolute bottom-3 right-3 z-10 flex h-11 items-center gap-1 rounded-full border border-border-subtle px-1.5 ${capsuleShadow}`}
          style={{ animationDelay: '240ms' }}
          role="group"
          aria-label="Preset kamera"
        >
          <button
            type="button"
            aria-pressed={activePreset === 'perspektif'}
            title="Tampilan perspektif (seperti Reset Kamera)"
            onClick={() => applyCameraPreset('perspektif')}
            className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${
              activePreset === 'perspektif'
                ? 'border-accent-primary text-accent-primary'
                : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
            }`}
          >
            3D
          </button>
          <button
            type="button"
            aria-label="Preset 3D lainnya"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'cam3d'}
            title="Preset 3D lainnya"
            onClick={() => setMenu(openMenu === 'cam3d' ? null : 'cam3d')}
            className="grid size-8 place-items-center rounded-full text-zinc-300 transition-colors hover:text-accent-primary active:scale-[0.97]"
          >
            <ShellIcon name="chevron" className="size-4" />
          </button>
          <span className="h-5 w-px bg-border-subtle" aria-hidden="true" />
          <button
            type="button"
            aria-pressed={activePreset === 'bb-atas'}
            title="Lihat breadboard dari atas"
            onClick={() => applyCameraPreset('bb-atas')}
            className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${
              activePreset === 'bb-atas'
                ? 'border-accent-primary text-accent-primary'
                : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
            }`}
          >
            Atas
          </button>
          <button
            type="button"
            aria-label="Preset atas lainnya"
            aria-haspopup="menu"
            aria-expanded={openMenu === 'camAtas'}
            title="Preset atas lainnya"
            onClick={() => setMenu(openMenu === 'camAtas' ? null : 'camAtas')}
            className="grid size-8 place-items-center rounded-full text-zinc-300 transition-colors hover:text-accent-primary active:scale-[0.97]"
          >
            <ShellIcon name="chevron" className="size-4" />
          </button>
          <span className="h-5 w-px bg-border-subtle" aria-hidden="true" />
          <button
            type="button"
            aria-pressed={activePreset === 'dekat'}
            title="Fokus dekat ke komponen terpilih (atau tampil depan bila tidak ada pilihan)"
            onClick={() =>
              applyCameraPreset(selectedInstance ? 'dekat' : 'depan')
            }
            className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors active:scale-[0.97] ${
              activePreset === 'dekat'
                ? 'border-accent-primary text-accent-primary'
                : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
            }`}
          >
            Fokus
          </button>
        </div>

        {/* Tumpukan tengah-atas: pill mode → inspector → autopsy */}
        <div className="absolute left-[276px] right-[392px] top-[68px] z-10 flex justify-center max-[1279px]:left-[248px]">
          <div className="flex w-full max-w-[400px] flex-col items-center gap-2">
            {placingType && (
              <div className="hud-pop pointer-events-none rounded-full border border-accent-primary/50 bg-panel/90 px-3.5 py-2 text-xs font-medium text-accent-primary backdrop-blur-md">
                Mode pasang: klik lubang breadboard untuk menaruh{' '}
                {getComponentPlugin(placingType)?.name ?? placingType} (Esc untuk batal)
              </div>
            )}
            {deleteMode && (
              <div className="hud-pop pointer-events-none rounded-full border border-accent-danger/60 bg-panel/90 px-3.5 py-2 text-xs font-semibold text-red-200 backdrop-blur-md">
                Mode Hapus aktif — klik komponen atau kabel untuk menghapus (Esc keluar)
              </div>
            )}

            {/* Popover inspector komponen (isi sama seperti panel seleksi lama) */}
            {selectedInstance && (
              <div
                className={`hud-pop pointer-events-auto w-full rounded-2xl border border-border-subtle bg-panel/95 p-3 ${capsuleShadow}`}
              >
                <h3 className="text-[13px] font-semibold text-zinc-100">
                  {getComponentPlugin(selectedInstance.type)?.name ?? selectedInstance.type}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Status:{' '}
                  {selectedInstance.simState.isDamaged ? (
                    <span className="font-semibold text-accent-danger">Rusak</span>
                  ) : (
                    <span className="text-accent-run">Normal</span>
                  )}
                </p>
                {Object.entries(selectedInstance.simState.branchCurrents).map(([key, amps]) => (
                  <p key={key} className="mt-0.5 font-mono text-[11px] text-zinc-400">
                    Arus {key}: {(amps * 1000).toFixed(1)} mA
                  </p>
                ))}
                <div className="mt-2.5 flex gap-2">
                  {selectedInstance.simState.isDamaged && (
                    <button
                      type="button"
                      onClick={() => replaceInstance(selectedInstance.id)}
                      className="h-7 flex-1 rounded-lg bg-accent-run text-xs font-semibold text-[#032117] transition-transform active:scale-[0.97]"
                    >
                      Ganti Komponen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeInstance(selectedInstance.id)}
                    className="h-7 flex-1 rounded-lg border border-border-interactive text-xs font-medium text-zinc-200 transition-colors hover:border-accent-danger hover:text-red-200 active:scale-[0.97]"
                  >
                    Hapus Komponen
                  </button>
                </div>
              </div>
            )}

            {/* Popover inspector kabel */}
            {selectedWire && (
              <div
                className={`hud-pop pointer-events-auto w-full rounded-2xl border border-border-subtle bg-panel/95 p-3 ${capsuleShadow}`}
              >
                <h3 className="text-[13px] font-semibold text-zinc-100">Kabel Terpilih</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {terminalLabel(selectedWire.a, getBoardDefinition(boardId))} →{' '}
                  {terminalLabel(selectedWire.b, getBoardDefinition(boardId))}
                </p>
                <button
                  type="button"
                  onClick={() => removeWire(selectedWire.id)}
                  className="mt-2.5 h-7 w-full rounded-lg border border-border-interactive text-xs font-medium text-zinc-200 transition-colors hover:border-accent-danger hover:text-red-200 active:scale-[0.97]"
                >
                  Hapus Kabel
                </button>
              </div>
            )}

            {/* AutopsyCard memposisikan dirinya absolute — slot menetralkannya
                via CSS (.hud-autopsy-slot > section) agar mengalir dalam stack. */}
            {autopsy && (
              <div className="hud-autopsy-slot pointer-events-auto relative z-40 w-full">
                <AutopsyCard />
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
        {openMenu === 'demo' && (
          <div className={`${popoverClass} hud-pop-origin-tl left-3 top-[60px] w-52 p-1.5`} role="menu">
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
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
              className={`${menuItemClass} text-red-200 hover:bg-accent-danger/10`}
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
        {openMenu === 'proyek' && (
          <div className={`${popoverClass} hud-pop-origin-tr right-3 top-[60px] w-44 p-1.5`} role="menu">
            <button
              type="button"
              role="menuitem"
              className={menuItemClass}
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
              className={menuItemClass}
              onClick={() => {
                setMenu(null);
                importRef.current?.click();
              }}
            >
              Impor
            </button>
          </div>
        )}

        {/* Menu preset 3D lainnya */}
        {openMenu === 'cam3d' && (
          <div className={`${popoverClass} hud-pop-origin-br bottom-[60px] right-3 w-56 p-1.5`} role="menu">
            {(
              [
                { id: 'depan', label: 'Depan' },
                { id: 'board-miring', label: 'Board Miring' },
                { id: 'bb-miring', label: 'Breadboard Miring' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                aria-current={activePreset === p.id || undefined}
                className={`${menuItemClass} ${activePreset === p.id ? 'text-accent-primary' : ''}`}
                onClick={() => {
                  applyCameraPreset(p.id);
                  setMenu(null);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Menu preset atas lainnya */}
        {openMenu === 'camAtas' && (
          <div className={`${popoverClass} hud-pop-origin-br bottom-[60px] right-3 w-56 p-1.5`} role="menu">
            <button
              type="button"
              role="menuitem"
              aria-current={activePreset === 'board-atas' || undefined}
              className={`${menuItemClass} ${activePreset === 'board-atas' ? 'text-accent-primary' : ''}`}
              onClick={() => {
                applyCameraPreset('board-atas');
                setMenu(null);
              }}
            >
              Board Atas
            </button>
          </div>
        )}

        {/* Popover bantuan "?" — satu rumah untuk semua referensi (§E) */}
        {helpOpen && (
          <div
            className={`${popoverClass} hud-pop-origin-tr right-3 top-[60px] w-[350px] max-w-[calc(100vw-24px)] p-4`}
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
                    ['Preset', '3D · Atas · Fokus, menu ▾ untuk varian per area'],
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
          {shareNote && (
            <div
              role="status"
              className={`hud-pop rounded-full border border-border-subtle bg-panel px-4 py-2 text-center text-xs text-zinc-200 ${capsuleShadow}`}
            >
              {shareNote}
            </div>
          )}
          {pendingFrom && (
            <div className="hud-pop rounded-full border border-accent-warning/50 bg-panel/90 px-3.5 py-2 text-xs font-medium text-accent-warning backdrop-blur-md">
              Kabel dari {terminalDisplay(pendingFrom, boardId)} — klik terminal tujuan.
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

      {/* Probe multimeter mengikuti kursor — TETAP anak langsung root */}
      {hover && (
        <div
          className="pointer-events-none fixed z-30 rounded-md border border-border-subtle bg-panel-elevated/95 px-2.5 py-1.5 font-mono text-[11px] text-zinc-200 shadow-lg"
          style={{ left: hover.clientX + 14, top: hover.clientY + 14 }}
        >
          <span className="text-accent-primary">{terminalDisplay(hover.ref, boardId)}</span>
          {hoverNet && <span className="text-zinc-500"> · net {hoverNet}</span>}
          {hoverVolts !== undefined && (
            <span className={hoverVoltsClass}> · {hoverVolts.toFixed(2)} V</span>
          )}
          {hoverAmpsMa !== undefined && (
            <span className="text-zinc-400"> · ≈ {hoverAmpsMa.toFixed(1)} mA</span>
          )}
          {pendingFrom && <span className="text-accent-warning"> · klik tujuan kabel</span>}
        </div>
      )}
    </div>
  );
}
