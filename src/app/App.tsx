import { useEffect, useRef, useState } from 'react';
import Workbench from '../features/stage3d/Workbench';
import AutopsyCard from './AutopsyCard';
import RightDock from './RightDock';
import { initSim } from '../features/simulation/worker/bridge';
import { CATALOG, CATEGORY_LABEL_ID, describeDefaultProps } from './catalogData';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { getComponentPlugin } from '../shared/components/registry';
import { holeLabel } from '../shared/boards/breadboard';
import {
  boardPinById,
  BOARD_DEFINITIONS,
  getBoardDefinition,
} from '../shared/boards/definitions';
import { terminalLabel, type TerminalRef } from '../features/wiring/netlist';

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
  const cancelPending = useCircuitStore((s) => s.cancelPending);
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
  const voltages = useCircuitStore((s) => s.voltages);
  const netNameOf = useCircuitStore((s) => s.netNameOf);

  const [resetSignal, setResetSignal] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    initSim((snapshot) => useCircuitStore.getState().applySnapshot(snapshot));
    loadDemo();
  }, [loadDemo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPending();
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useCircuitStore.getState();
        if (state.selectedWireId) state.removeWire(state.selectedWireId);
        else if (state.selectedInstanceId) state.removeInstance(state.selectedInstanceId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelPending]);

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) ?? null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) ?? null;
  const anyDamaged = instances.some((i) => i.simState.isDamaged);
  const hoverNet = hover ? netNameOf(hover.ref) : null;
  const hoverVolts = hoverNet !== null ? voltages[hoverNet] : undefined;

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

        <main className="relative min-w-0 flex-1">
          <Workbench resetSignal={resetSignal} />
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
          {hoverVolts !== undefined && (
            <span className="text-zinc-400"> · {hoverVolts.toFixed(2)} V</span>
          )}
          {pendingFrom && <span className="text-accent-warning"> · klik tujuan kabel</span>}
        </div>
      )}
    </div>
  );
}
