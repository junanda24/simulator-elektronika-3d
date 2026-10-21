import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../store/circuitStore';
import type { TerminalRef } from '../netlist';
import { railHoleId, terminalHoleId } from '../../../shared/boards/breadboard';

/**
 * Keluarga MODE ALAT (ToolMode) — dikunci di level store:
 * - 'build'  : semua aksi merakit aktif (bawaan).
 * - 'hand'   : navigasi murni — gerbang store mematikan pasang, kabel,
 *              dan SEMUA interact gizmo; seleksi tetap hidup; masuk
 *              mode ini membatalkan gestur merakit yang menggantung.
 * - 'delete' : Mode Hapus lama — di level store ia TIDAK menggerbang
 *              aksi merakit apa pun (penghapusannya adalah efek seleksi
 *              di App, persis perilaku boolean deleteMode dulu).
 */

const hole = (holeId: string): TerminalRef => ({ kind: 'hole', holeId });

function resetStore() {
  useCircuitStore.setState({
    instances: [],
    pinHoles: {},
    wires: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    toolMode: 'build',
    placingType: null,
    pendingFrom: null,
    placementRotation: 0,
    wireCursorPos: null,
    isDragging3D: false,
    selectedInstanceId: null,
    selectedWireId: null,
    autopsy: null,
  });
}

beforeEach(resetStore);

describe('toolMode — transisi dasar', () => {
  it('bawaan adalah build', () => {
    expect(useCircuitStore.getState().toolMode).toBe('build');
  });

  it('setToolMode berpindah antar anggota keluarga dan kembali ke build', () => {
    const s = useCircuitStore.getState();
    s.setToolMode('delete');
    expect(useCircuitStore.getState().toolMode).toBe('delete');
    s.setToolMode('hand');
    expect(useCircuitStore.getState().toolMode).toBe('hand');
    useCircuitStore.getState().setToolMode('build');
    expect(useCircuitStore.getState().toolMode).toBe('build');
  });

  it('masuk hand membatalkan gestur merakit yang menggantung', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('led-5mm');
    s.rotatePlacement();
    s.clickTerminal(hole(terminalHoleId('L', 10, 0)));
    s.setWireCursorPos([1, 2, 3]);
    s.setDragging3D(true);
    const mid = useCircuitStore.getState();
    expect(mid.placingType).toBe('led-5mm');
    expect(mid.pendingFrom).not.toBeNull();
    expect(mid.isDragging3D).toBe(true);

    useCircuitStore.getState().setToolMode('hand');
    const st = useCircuitStore.getState();
    expect(st.placingType).toBeNull();
    expect(st.pendingFrom).toBeNull();
    expect(st.wireCursorPos).toBeNull();
    expect(st.placementRotation).toBe(0);
    // Kunci drag 3D dilepas agar OrbitControls tidak tertahan mati.
    expect(st.isDragging3D).toBe(false);
  });
});

describe('toolMode hand — gerbang aksi merakit', () => {
  beforeEach(() => {
    useCircuitStore.getState().setToolMode('hand');
  });

  it('setPlacing(non-null) diabaikan; setPlacing(null) tetap boleh', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('led-5mm');
    expect(useCircuitStore.getState().placingType).toBeNull();
    s.setPlacing(null);
    expect(useCircuitStore.getState().placingType).toBeNull();
  });

  it('placeAt menolak dan tidak menaruh komponen', () => {
    const ok = useCircuitStore.getState().placeAt(terminalHoleId('L', 10, 2));
    expect(ok).toBe(false);
    expect(useCircuitStore.getState().instances).toHaveLength(0);
  });

  it('clickTerminal tidak memulai maupun menyambung kabel', () => {
    const s = useCircuitStore.getState();
    s.clickTerminal(hole(terminalHoleId('L', 10, 0)));
    expect(useCircuitStore.getState().pendingFrom).toBeNull();
    useCircuitStore.getState().clickTerminal(hole(railHoleId('R-', 4)));
    const st = useCircuitStore.getState();
    expect(st.pendingFrom).toBeNull();
    expect(st.wires).toHaveLength(0);
  });

  it('interact (semua gizmo) mati total', () => {
    useCircuitStore.getState().setToolMode('build');
    const s = useCircuitStore.getState();
    s.setPlacing('resistor');
    s.placeAt(terminalHoleId('L', 24, 2));
    const id = useCircuitStore.getState().instances[0].id;
    useCircuitStore.getState().setToolMode('hand');
    useCircuitStore.getState().interact(id, { alpha: 0.75 });
    expect(useCircuitStore.getState().instances[0].interactiveState).toEqual({});
  });

  it('setDragging3D(true) tidak merebut kamera; seleksi tetap hidup', () => {
    const s = useCircuitStore.getState();
    s.setDragging3D(true);
    expect(useCircuitStore.getState().isDragging3D).toBe(false);
    s.setDragging3D(false);
    expect(useCircuitStore.getState().isDragging3D).toBe(false);

    // Klik item di mode hand = seleksi saja — jalur seleksi tidak digerbang.
    s.selectInstance('inst-x');
    expect(useCircuitStore.getState().selectedInstanceId).toBe('inst-x');
    useCircuitStore.getState().selectInstance(null);
    expect(useCircuitStore.getState().selectedInstanceId).toBeNull();
    expect(useCircuitStore.getState().selectedWireId).toBeNull();
  });
});

describe('toolMode delete — paritas perilaku lama', () => {
  it('mode delete TIDAK menggerbang aksi merakit di level store', () => {
    const s = useCircuitStore.getState();
    s.setToolMode('delete');
    // Boolean deleteMode lama tidak pernah memblokir pasang/kabel —
    // penghapusan murni efek seleksi di App. Paritas itu dikunci di sini.
    s.setPlacing('led-5mm');
    expect(useCircuitStore.getState().placingType).toBe('led-5mm');
    expect(useCircuitStore.getState().placeAt(terminalHoleId('L', 10, 2))).toBe(true);
    useCircuitStore.getState().clickTerminal(hole(terminalHoleId('L', 20, 0)));
    useCircuitStore.getState().clickTerminal(hole(railHoleId('R-', 4)));
    expect(useCircuitStore.getState().wires).toHaveLength(1);
  });
});

describe('toolMode build — regresi jalur normal', () => {
  it('pasang, kabel, dan interact berjalan seperti biasa', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('led-5mm');
    expect(s.placeAt(terminalHoleId('L', 10, 2))).toBe(true);
    const id = useCircuitStore.getState().instances[0].id;
    useCircuitStore.getState().interact(id, { value: 1 });
    expect(useCircuitStore.getState().instances[0].interactiveState).toEqual({ value: 1 });
    useCircuitStore.getState().clickTerminal(hole(terminalHoleId('L', 20, 0)));
    useCircuitStore.getState().clickTerminal(hole(railHoleId('R-', 4)));
    expect(useCircuitStore.getState().wires).toHaveLength(1);
  });
});
