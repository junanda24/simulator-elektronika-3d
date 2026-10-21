import { beforeEach, describe, expect, it } from 'vitest';
import { computePlacement } from '../placement';
import { useCircuitStore } from '../store/circuitStore';
import type { TerminalRef } from '../netlist';
import { railHoleId, terminalHoleId } from '../../../shared/boards/breadboard';

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

describe('computePlacement — rotasi footprint (Batch 6)', () => {
  it('resistor rotasi 90°: himpunan lubang berbeda dari rotasi 0° dan valid', () => {
    const anchor = terminalHoleId('L', 24, 4);
    const p0 = computePlacement('resistor', anchor, new Set(), 0);
    const p90 = computePlacement('resistor', anchor, new Set(), 90);
    expect(p0).not.toBeNull();
    expect(p90).not.toBeNull();
    // Rotasi 0°: B empat baris di atas A. Rotasi 90°: (0,-4) → (-4,0) — B empat kolom di kiri A.
    expect(p0?.pinHoles.B).toBe(terminalHoleId('L', 20, 4));
    expect(p90?.pinHoles.B).toBe(terminalHoleId('L', 24, 0));
    // Radian render = bawaan resistor (π/2) + rotasi pengguna (π/2) = π.
    expect(p90?.instance.rotation).toBeCloseTo(Math.PI);
  });

  it('LED rotasi 180°: katoda dua baris di ATAS anoda', () => {
    const p = computePlacement('led-5mm', terminalHoleId('L', 10, 2), new Set(), 180);
    expect(p?.pinHoles.ANODE).toBe(terminalHoleId('L', 10, 2));
    expect(p?.pinHoles.CATHODE).toBe(terminalHoleId('L', 8, 2));
    expect(p?.instance.rotation).toBeCloseTo(Math.PI);
  });

  it('rotasi yang mendorong footprint keluar papan → tidak valid', () => {
    // Resistor kolom 0 rotasi 90°: B jatuh 4 kolom di kiri papan.
    expect(computePlacement('resistor', terminalHoleId('L', 24, 0), new Set(), 90)).toBeNull();
    // LED baris 1 rotasi 180°: katoda jatuh di baris -1.
    expect(computePlacement('led-5mm', terminalHoleId('L', 1, 2), new Set(), 180)).toBeNull();
  });

  it('rotasi ke lubang yang sudah terisi → tidak valid', () => {
    const occupied = new Set([terminalHoleId('L', 24, 0)]);
    expect(computePlacement('resistor', terminalHoleId('L', 24, 4), occupied, 90)).toBeNull();
  });

  it('relay rotasi 90°: rumus generik berlaku untuk kasus multi-kolom', () => {
    const p = computePlacement('relay', terminalHoleId('L', 20, 1), new Set(), 90);
    expect(p).not.toBeNull();
    expect(p?.pinHoles.VCC).toBe(terminalHoleId('L', 20, 1));
    // COM offset (dCol 3, dRow 0) → rotasi 90° → (0, -3): baris 17, kolom tetap.
    expect(p?.pinHoles.COM).toBe(terminalHoleId('L', 17, 1));
    // IN offset (0, 1) → (1, 0): kolom 2, baris tetap.
    expect(p?.pinHoles.IN).toBe(terminalHoleId('L', 20, 2));
  });
});

describe('circuitStore — state transien Batch 6', () => {
  it('rotatePlacement berputar 0→90→180→270→0 dan reset saat cancelPending', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('resistor');
    s.rotatePlacement();
    expect(useCircuitStore.getState().placementRotation).toBe(90);
    useCircuitStore.getState().rotatePlacement();
    useCircuitStore.getState().rotatePlacement();
    expect(useCircuitStore.getState().placementRotation).toBe(270);
    useCircuitStore.getState().rotatePlacement();
    expect(useCircuitStore.getState().placementRotation).toBe(0);
    useCircuitStore.getState().rotatePlacement();
    useCircuitStore.getState().cancelPending();
    const st = useCircuitStore.getState();
    expect(st.placementRotation).toBe(0);
    expect(st.placingType).toBeNull();
  });

  it('setPlacing(null) mereset rotasi ke 0', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('led-5mm');
    s.rotatePlacement();
    expect(useCircuitStore.getState().placementRotation).toBe(90);
    useCircuitStore.getState().setPlacing(null);
    expect(useCircuitStore.getState().placementRotation).toBe(0);
  });

  it('placeAt meneruskan rotasi ke computePlacement', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('led-5mm');
    s.rotatePlacement();
    useCircuitStore.getState().rotatePlacement();
    const ok = useCircuitStore.getState().placeAt(terminalHoleId('L', 10, 2));
    expect(ok).toBe(true);
    const st = useCircuitStore.getState();
    expect(st.instances).toHaveLength(1);
    expect(st.pinHoles[st.instances[0].id].CATHODE).toBe(terminalHoleId('L', 8, 2));
    expect(st.instances[0].rotation).toBeCloseTo(Math.PI);
  });

  it('setDragging3D & setWireCursorPos bekerja; cancelPending membersihkan wireCursorPos', () => {
    const s = useCircuitStore.getState();
    s.setDragging3D(true);
    expect(useCircuitStore.getState().isDragging3D).toBe(true);
    s.setDragging3D(false);
    expect(useCircuitStore.getState().isDragging3D).toBe(false);
    s.setWireCursorPos([1, 2, 3]);
    expect(useCircuitStore.getState().wireCursorPos).toEqual([1, 2, 3]);
    s.cancelPending();
    expect(useCircuitStore.getState().wireCursorPos).toBeNull();
  });

  it('kabel selesai disambung di clickTerminal → wireCursorPos dibersihkan', () => {
    const s = useCircuitStore.getState();
    s.clickTerminal(hole(terminalHoleId('L', 10, 0)));
    s.setWireCursorPos([5, 5, 5]);
    useCircuitStore.getState().clickTerminal(hole(railHoleId('R-', 4)));
    const st = useCircuitStore.getState();
    expect(st.wires).toHaveLength(1);
    expect(st.pendingFrom).toBeNull();
    expect(st.wireCursorPos).toBeNull();
  });
});

describe('circuitStore — undo/redo', () => {
  it('placeAt → undo → redo, canUndo/canRedo konsisten di tiap langkah', () => {
    const s = useCircuitStore.getState();
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
    s.setPlacing('resistor');
    expect(useCircuitStore.getState().placeAt(terminalHoleId('L', 24, 2))).toBe(true);
    let st = useCircuitStore.getState();
    expect(st.instances).toHaveLength(1);
    expect(st.canUndo).toBe(true);
    expect(st.canRedo).toBe(false);

    st.undo();
    st = useCircuitStore.getState();
    expect(st.instances).toHaveLength(0);
    expect(st.pinHoles).toEqual({});
    expect(st.canUndo).toBe(false);
    expect(st.canRedo).toBe(true);

    st.redo();
    st = useCircuitStore.getState();
    expect(st.instances).toHaveLength(1);
    expect(st.canUndo).toBe(true);
    expect(st.canRedo).toBe(false);
  });

  it('tambah kabel (dua clickTerminal) → undo menghilangkan kabel', () => {
    const s = useCircuitStore.getState();
    s.clickTerminal(hole(terminalHoleId('L', 10, 0)));
    useCircuitStore.getState().clickTerminal(hole(terminalHoleId('L', 12, 0)));
    expect(useCircuitStore.getState().wires).toHaveLength(1);
    expect(useCircuitStore.getState().canUndo).toBe(true);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().wires).toHaveLength(0);
  });

  it('klik terminal yang sama dua kali (batal) tidak menambah histori', () => {
    const s = useCircuitStore.getState();
    s.clickTerminal(hole(terminalHoleId('L', 10, 0)));
    useCircuitStore.getState().clickTerminal(hole(terminalHoleId('L', 10, 0)));
    const st = useCircuitStore.getState();
    expect(st.wires).toHaveLength(0);
    expect(st.canUndo).toBe(false);
    expect(st.past).toHaveLength(0);
  });

  it('clearAll bisa di-undo', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('resistor');
    s.placeAt(terminalHoleId('L', 24, 2));
    useCircuitStore.getState().clearAll();
    expect(useCircuitStore.getState().instances).toHaveLength(0);
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().instances).toHaveLength(1);
  });

  it('removeInstance bisa di-undo (instance + pinHoles pulih)', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('led-5mm');
    s.placeAt(terminalHoleId('L', 10, 2));
    const id = useCircuitStore.getState().instances[0].id;
    useCircuitStore.getState().removeInstance(id);
    expect(useCircuitStore.getState().instances).toHaveLength(0);
    useCircuitStore.getState().undo();
    const st = useCircuitStore.getState();
    expect(st.instances).toHaveLength(1);
    expect(st.pinHoles[id]).toBeDefined();
  });

  it('interact TIDAK menambah histori (drag kontinu tidak membanjiri undo)', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('resistor');
    s.placeAt(terminalHoleId('L', 24, 2));
    const before = useCircuitStore.getState().past.length;
    const id = useCircuitStore.getState().instances[0].id;
    useCircuitStore.getState().interact(id, { value: 470 });
    expect(useCircuitStore.getState().past.length).toBe(before);
  });

  it('undo/redo pada tumpukan kosong adalah no-op', () => {
    const s = useCircuitStore.getState();
    s.undo();
    s.redo();
    const st = useCircuitStore.getState();
    expect(st.instances).toHaveLength(0);
    expect(st.canUndo).toBe(false);
    expect(st.canRedo).toBe(false);
  });

  it('mutasi baru setelah undo mengosongkan future', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('resistor');
    s.placeAt(terminalHoleId('L', 24, 2));
    useCircuitStore.getState().undo();
    expect(useCircuitStore.getState().canRedo).toBe(true);
    const s2 = useCircuitStore.getState();
    s2.setPlacing('led-5mm');
    s2.placeAt(terminalHoleId('L', 10, 2));
    const st = useCircuitStore.getState();
    expect(st.canRedo).toBe(false);
    expect(st.instances).toHaveLength(1);
    expect(st.instances[0].type).toBe('led-5mm');
  });
});
