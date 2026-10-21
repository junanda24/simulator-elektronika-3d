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
import { CATALOG, CATEGORY_LABEL_ID, describeDefaultProps } from './catalogData';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { getComponentPlugin } from '../shared/components/registry';
import { BREADBOARD_ORIGIN, holeLabel } from '../shared/boards/breadboard';
import { isSoundEnabled, playClick, setSoundEnabled } from '../shared/utils/soundFx';
import {
  boardPinById,
  BOARD_DEFINITIONS,
  getBoardDefinition,
} from '../shared/boards/definitions';
import { terminalLabel, type TerminalRef } from '../features/wiring/netlist';

/** Palet warna kabel untuk shortcut angka 1–6 & swatch bar peralatan. */
const SHORTCUT_WIRE_COLORS: Array<{ hex: string; label: string }> = [
  { hex: '#EF4444', label: 'Merah' },
  { hex: '#1F2937', label: 'Hitam' },
  { hex: '#3B82F6', label: 'Biru' },
  { hex: '#22C55E', label: 'Hijau' },
  { hex: '#EAB308', label: 'Kuning' },
  { hex: '#F97316', label: 'Oranye' },
];

const WIRE_COLORS: Array<{ hex: string; label: string }> = [
  { hex: '#ef4444', label: 'Merah (5V)' },
  { hex: '#f97316', label: 'Oranye (3V3)' },
  { hex: '#2a2e37', label: 'Hitam (GND)' },
  { hex: '#3b82f6', label: 'Biru (sinyal)' },
  { hex: '#22c55e', label: 'Hijau (sinyal)' },
  { hex: '#eab308', label: 'Kuning (analog)' },
  { hex: '#a855f7', label: 'Ungu (PWM)' },
];

function terminalDisplay(ref: TerminalRef, boardId: string): string {
  if (ref.kind === 'hole') return holeLabel(ref.holeId);
  const board = getBoardDefinition(boardId);
  return `${board.name} ${boardPinById(board, ref.pinId)?.label ?? ref.pinId}`;
}

/**
 * Shell aplikasi — tata letak STYLE_GUIDE.md §5:
 * Top Toolbar 48px, Left Dock 260px (katalog + panel seleksi), viewport 3D.
 * Semua state rangkaian hidup di useCircuitStore (Zustand).
 */
export default function App() {
  const running = useCircuitStore((s) => s.running);
  const setRunning = useCircuitStore((s) => s.setRunning);
  const boardId = useCircuitStore((s) => s.boardId);
  const setBoard = useCircuitStore((s) => s.setBoard);
  const instances = useCircuitStore((s) => s.instances);
  const wires = useCircuitStore((s) => s.wires);
  const placingType = useCircuitStore((s) => s.placingType);
  const setPlacing = useCircuitStore((s) => s.setPlacing);
  const pendingFrom = useCircuitStore((s) => s.pendingFrom);
  const wireColor = useCircuitStore((s) => s.wireColor);
  const setWireColor = useCircuitStore((s) => s.setWireColor);
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
  const canUndo = useCircuitStore((s) => s.canUndo);
  const canRedo = useCircuitStore((s) => s.canRedo);
  const undo = useCircuitStore((s) => s.undo);
  const redo = useCircuitStore((s) => s.redo);
  const deleteMode = useCircuitStore((s) => s.deleteMode);
  const setDeleteMode = useCircuitStore((s) => s.setDeleteMode);
  const setCameraView = useCircuitStore((s) => s.setCameraView);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const importRef = useRef<HTMLInputElement>(null);
  const voltages = useCircuitStore((s) => s.voltages);
  const netNameOf = useCircuitStore((s) => s.netNameOf);

  const [resetSignal, setResetSignal] = useState(0);
  const mounted = useRef(false);

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
        case ' ':
          e.preventDefault();
          state.setRunning(!state.running);
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
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

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
  };

  return (
    <div className="flex h-full flex-col bg-panel">
      {/* ===== Top Toolbar (48px) ===== */}
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border-subtle bg-panel px-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-bold tracking-tight text-zinc-100">
            Simulator Elektronika 3D
          </h1>
          <span className="hidden text-xs text-zinc-500 lg:inline">Meja Kerja ESD Virtual</span>
        </div>

        <div className="mx-2 h-6 w-px bg-border-subtle" />

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Board
          <select
            className="h-8 rounded-md border border-border-subtle bg-panel-elevated px-2 text-[13px] font-medium text-zinc-100 outline-none focus:border-accent-primary"
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRunning(!running)}
            className={`h-8 rounded-md px-4 text-[13px] font-semibold transition-colors ${
              running
                ? 'bg-accent-warning text-[#2a1a00] hover:bg-amber-400'
                : 'bg-accent-run text-[#032117] hover:bg-emerald-400'
            }`}
          >
            {running ? 'Jeda' : 'Jalankan'}
          </button>
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className="h-8 rounded-md border border-border-subtle bg-panel-elevated px-3 text-[13px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
          >
            Reset Kamera
          </button>
          <button
            type="button"
            onClick={loadDemo}
            className="h-8 rounded-md border border-border-subtle bg-panel-elevated px-3 text-[13px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
          >
            Muat Demo
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="h-8 rounded-md border border-border-subtle bg-panel-elevated px-3 text-[13px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
          >
            Bersihkan
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
          <span
            className={`inline-block size-2 rounded-full ${
              anyDamaged ? 'bg-accent-danger' : running ? 'bg-accent-run' : 'bg-zinc-500'
            }`}
          />
          {anyDamaged
            ? 'Ada komponen rusak'
            : running
              ? 'Simulasi berjalan'
              : 'Simulasi berhenti'}
        </div>
      </header>

      {/* ===== Bar Peralatan: warna kabel, undo/redo, mode hapus, suara ===== */}
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border-subtle bg-panel px-4">
        <div className="flex items-center gap-1.5" role="group" aria-label="Warna kabel aktif">
          {SHORTCUT_WIRE_COLORS.map((c, i) => (
            <button
              key={c.hex}
              type="button"
              title={`${c.label} (tombol ${i + 1})`}
              aria-label={`Warna kabel ${c.label}`}
              onClick={() => setWireColor(c.hex)}
              className={`flex size-6 items-center justify-center rounded-full border-2 text-[9px] font-bold text-white/90 transition-transform ${
                wireColor.toLowerCase() === c.hex.toLowerCase()
                  ? 'scale-110 border-accent-primary'
                  : 'border-transparent'
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-border-subtle" />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Urungkan (Ctrl+Z)"
            className="h-7 rounded-md border border-border-subtle px-2.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Ulangi (Ctrl+Shift+Z)"
            className="h-7 rounded-md border border-border-subtle px-2.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle"
          >
            Redo
          </button>
          <button
            type="button"
            onClick={() => setDeleteMode(!deleteMode)}
            aria-pressed={deleteMode}
            title="Mode hapus: klik komponen/kabel untuk menghapusnya (Esc untuk keluar)"
            className={`h-7 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              deleteMode
                ? 'border-accent-danger bg-accent-danger/20 text-accent-danger'
                : 'border-border-subtle text-zinc-200 hover:border-zinc-500'
            }`}
          >
            Mode Hapus
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title="Suara mekanis & elektrik (Web Audio)"
            className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
              soundOn
                ? 'border-accent-primary/60 bg-accent-primary/10 text-accent-primary'
                : 'border-border-subtle text-zinc-400 hover:border-zinc-500'
            }`}
          >
            Suara: {soundOn ? 'Nyala' : 'Mati'}
          </button>
        </div>

        <p className="ml-auto hidden text-[11px] text-zinc-500 xl:block">
          R putar · Spasi jalan · Del hapus · 1–6 warna
        </p>
      </div>

      {/* ===== Badan: Left Dock + Viewport ===== */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-border-subtle bg-panel">
          <div className="border-b border-border-subtle px-4 py-3">
            <h2 className="text-[13px] font-semibold text-zinc-100">Katalog Komponen</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Klik Pasang, lalu klik lubang breadboard.
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {CATALOG.map((meta) => (
              <article
                key={meta.type}
                className={`rounded-lg border bg-panel-elevated p-3 ${
                  placingType === meta.type ? 'border-accent-primary' : 'border-border-subtle'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-zinc-100">{meta.name}</h3>
                  <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-accent-primary">
                    {CATEGORY_LABEL_ID[meta.category]}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{meta.descriptionId}</p>
                <p className="mt-2 font-mono text-[11px] text-zinc-500">
                  {describeDefaultProps(meta)}
                </p>
                <button
                  type="button"
                  onClick={() => setPlacing(placingType === meta.type ? null : meta.type)}
                  className={`mt-2.5 h-7 w-full rounded-md text-xs font-semibold transition-colors ${
                    placingType === meta.type
                      ? 'bg-accent-warning text-[#2a1a00]'
                      : 'bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25'
                  }`}
                >
                  {placingType === meta.type ? 'Klik lubang breadboard…' : 'Pasang'}
                </button>
              </article>
            ))}

            {/* Warna kabel aktif */}
            <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3">
              <h3 className="text-[13px] font-semibold text-zinc-100">Warna Kabel</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WIRE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => setWireColor(c.hex)}
                    className={`size-6 rounded-full border-2 transition-transform ${
                      wireColor === c.hex ? 'scale-110 border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                {pendingFrom
                  ? `Kabel dari ${terminalDisplay(pendingFrom, boardId)} — klik terminal tujuan.`
                  : 'Klik pin board atau lubang breadboard untuk mulai menarik kabel.'}
              </p>
            </div>

            {/* Proyek: bagikan / ekspor / impor */}
            <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3">
              <h3 className="text-[13px] font-semibold text-zinc-100">Proyek</h3>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={handleShare}
                  className="h-7 flex-1 rounded-md bg-accent-primary/15 text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/25"
                >
                  Bagikan
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="h-7 flex-1 rounded-md border border-border-subtle text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
                >
                  Ekspor
                </button>
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                  className="h-7 flex-1 rounded-md border border-border-subtle text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
                >
                  Impor
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".rangkai,application/json"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
              {shareNote && (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{shareNote}</p>
              )}
            </div>

            {/* Panel seleksi komponen */}
            {selectedInstance && (
              <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3">
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
                  <p key={key} className="mt-0.5 font-mono text-[11px] text-zinc-500">
                    Arus {key}: {(amps * 1000).toFixed(1)} mA
                  </p>
                ))}
                <div className="mt-2.5 flex gap-2">
                  {selectedInstance.simState.isDamaged && (
                    <button
                      type="button"
                      onClick={() => replaceInstance(selectedInstance.id)}
                      className="h-7 flex-1 rounded-md bg-accent-run text-xs font-semibold text-[#032117]"
                    >
                      Ganti Komponen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeInstance(selectedInstance.id)}
                    className="h-7 flex-1 rounded-md border border-border-subtle text-xs font-medium text-zinc-200"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            )}

            {/* Panel seleksi kabel */}
            {selectedWire && (
              <div className="rounded-lg border border-border-subtle bg-panel-elevated p-3">
                <h3 className="text-[13px] font-semibold text-zinc-100">Kabel Terpilih</h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {terminalLabel(selectedWire.a, getBoardDefinition(boardId))} →{' '}
                  {terminalLabel(selectedWire.b, getBoardDefinition(boardId))}
                </p>
                <button
                  type="button"
                  onClick={() => removeWire(selectedWire.id)}
                  className="mt-2.5 h-7 w-full rounded-md border border-border-subtle text-xs font-medium text-zinc-200"
                >
                  Hapus Kabel
                </button>
              </div>
            )}
          </div>
          <p className="border-t border-border-subtle px-4 py-3 text-[11px] leading-relaxed text-zinc-600">
            Pasang komponen dari katalog, tarik kabel antar terminal, lalu tekan
            Jalankan. Coba cabut kabel resistor dari jalur LED, sambungkan anoda
            langsung ke rail 5V, dan jalankan lagi untuk melihat akibatnya. Delete
            menghapus pilihan, Esc membatalkan.
          </p>
        </aside>

        <main
          className={`relative min-w-0 flex-1 ${deleteMode ? 'cursor-crosshair' : ''}`}
        >
          <Workbench resetSignal={resetSignal} />
          {/* Preset sudut kamera — dibedakan per area: Umum, Board, Breadboard */}
          <div className="absolute left-3 top-3 z-10 flex w-[172px] flex-col gap-2.5 rounded-md border border-border-subtle bg-panel/70 p-2 backdrop-blur-md">
            {(
              [
                {
                  title: 'Umum',
                  items: [
                    { id: 'perspektif', label: 'Perspektif' },
                    { id: 'depan', label: 'Depan' },
                    { id: 'dekat', label: 'Dekat' },
                  ],
                },
                {
                  title: 'Board',
                  items: [
                    { id: 'board-miring', label: 'Miring' },
                    { id: 'board-atas', label: 'Atas' },
                  ],
                },
                {
                  title: 'Breadboard',
                  items: [
                    { id: 'bb-miring', label: 'Miring' },
                    { id: 'bb-atas', label: 'Atas' },
                  ],
                },
              ] as const
            ).map((group) => (
              <div key={group.title} className="flex flex-col gap-1">
                <span className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {group.title}
                </span>
                <div className="flex gap-1.5">
                  {group.items.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyCameraPreset(p.id)}
                      className="h-7 flex-1 rounded-md border border-border-subtle bg-panel/85 px-2 text-[11px] font-medium text-zinc-200 transition-colors hover:border-accent-primary hover:text-accent-primary"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border-subtle bg-panel/85 px-3 py-2 text-[11px] text-zinc-400 backdrop-blur-md">
            Kontrol kamera: seret untuk memutar, roda tetikus untuk memperbesar,
            seret kanan untuk menggeser.
          </div>
          {placingType && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-accent-primary/50 bg-panel/90 px-3 py-2 text-xs font-medium text-accent-primary backdrop-blur-md">
              Mode pasang: klik lubang breadboard untuk menaruh{' '}
              {getComponentPlugin(placingType)?.name ?? placingType} (Esc untuk batal)
            </div>
          )}
          <AutopsyCard />
        </main>
        <RightDock />
      </div>

      {/* Probe multimeter mengikuti kursor */}
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
