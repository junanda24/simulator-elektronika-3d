import { create } from 'zustand';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type DamageReport,
  type PinState,
} from '../../../shared/types';
import { holeWorldPosition, terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';
import { buildNetlist, type TerminalRef, type WireConnection } from '../netlist';
import { computePlacement } from '../placement';
import {
  simClearBoardDamage,
  simSetCircuit,
  simSetPowered,
  simStartSketch,
  simStopSketch,
  type SimSnapshot,
} from '../../simulation/worker/bridge';
import { DEFAULT_SKETCH } from '../../sketch/defaultSketch';
import { getBoardDefinition } from '../../../shared/boards/definitions';

export interface AutopsyState {
  /** Id komponen yang rusak; null bila yang rusak adalah board. */
  instanceId: string | null;
  /** Pin board yang mati (kerusakan board); null bila korsleting rel. */
  boardPinId?: string | null;
  report: DamageReport;
}

export interface HoverState {
  ref: TerminalRef;
  clientX: number;
  clientY: number;
}

interface CircuitStore {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  running: boolean;
  boardId: string;
  voltages: Record<string, number>;
  sketchCode: string;
  serialText: string;
  pinStates: Record<string, PinState>;
  deadPins: string[];
  boardFault: boolean;
  sketchError: string | null;
  autopsy: AutopsyState | null;
  selectedInstanceId: string | null;
  selectedWireId: string | null;
  placingType: string | null;
  pendingFrom: TerminalRef | null;
  wireColor: string;
  hover: HoverState | null;
  focusNonce: number;
  focusPosition: [number, number, number] | null;

  setPlacing: (type: string | null) => void;
  placeAt: (holeId: string) => boolean;
  clickTerminal: (ref: TerminalRef) => void;
  cancelPending: () => void;
  setWireColor: (color: string) => void;
  removeWire: (id: string) => void;
  removeInstance: (id: string) => void;
  replaceInstance: (id: string) => void;
  clearAll: () => void;
  loadDemo: () => void;
  selectInstance: (id: string | null) => void;
  selectWire: (id: string | null) => void;
  setHover: (hover: HoverState | null) => void;
  closeAutopsy: () => void;
  setRunning: (running: boolean) => void;
  setBoard: (boardId: string) => void;
  setSketchCode: (code: string) => void;
  restartSketch: () => void;
  clearSerial: () => void;
  replaceBoard: () => void;
  interact: (instanceId: string, patch: Record<string, unknown>) => void;
  applySnapshot: (snapshot: SimSnapshot) => void;
  netNameOf: (ref: TerminalRef) => string;
}

let wireCounter = 0;
function nextWireId(): string {
  wireCounter += 1;
  return `wire-${Date.now().toString(36)}-${wireCounter}`;
}

function sameTerminal(a: TerminalRef, b: TerminalRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'hole' && b.kind === 'hole') return a.holeId === b.holeId;
  if (a.kind === 'board' && b.kind === 'board') return a.pinId === b.pinId;
  return false;
}

function syncSim(get: () => CircuitStore): void {
  const { instances, pinHoles, wires, boardId } = get();
  simSetCircuit({ instances, pinHoles, wires, boardId });
}

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  instances: [],
  pinHoles: {},
  wires: [],
  running: false,
  boardId: 'uno',
  voltages: {},
  sketchCode: DEFAULT_SKETCH,
  serialText: '',
  pinStates: {},
  deadPins: [],
  boardFault: false,
  sketchError: null,
  autopsy: null,
  selectedInstanceId: null,
  selectedWireId: null,
  placingType: null,
  pendingFrom: null,
  wireColor: '#3b82f6',
  hover: null,
  focusNonce: 0,
  focusPosition: null,

  setPlacing: (type) => set({ placingType: type, pendingFrom: null }),

  placeAt: (holeId) => {
    const { placingType, instances, pinHoles } = get();
    if (!placingType) return false;
    const occupied = new Set(Object.values(pinHoles).flatMap((m) => Object.values(m)));
    const placement = computePlacement(placingType, holeId, occupied);
    if (!placement) return false;
    set({
      instances: [...instances, placement.instance],
      pinHoles: { ...pinHoles, [placement.instance.id]: placement.pinHoles },
      placingType: null,
      selectedInstanceId: placement.instance.id,
    });
    syncSim(get);
    return true;
  },

  clickTerminal: (ref) => {
    const { pendingFrom, wires, wireColor } = get();
    if (!pendingFrom) {
      set({ pendingFrom: ref, selectedWireId: null });
      return;
    }
    if (sameTerminal(pendingFrom, ref)) {
      set({ pendingFrom: null });
      return;
    }
    const exists = wires.some(
      (w) =>
        (sameTerminal(w.a, pendingFrom) && sameTerminal(w.b, ref)) ||
        (sameTerminal(w.a, ref) && sameTerminal(w.b, pendingFrom)),
    );
    if (!exists) {
      set({
        wires: [...wires, { id: nextWireId(), a: pendingFrom, b: ref, color: wireColor }],
      });
      syncSim(get);
    }
    set({ pendingFrom: null });
  },

  cancelPending: () => set({ pendingFrom: null, placingType: null }),
  setWireColor: (color) => set({ wireColor: color }),

  removeWire: (id) => {
    set((s) => ({
      wires: s.wires.filter((w) => w.id !== id),
      selectedWireId: s.selectedWireId === id ? null : s.selectedWireId,
    }));
    syncSim(get);
  },

  removeInstance: (id) => {
    set((s) => {
      const pinHoles = { ...s.pinHoles };
      delete pinHoles[id];
      return {
        instances: s.instances.filter((i) => i.id !== id),
        pinHoles,
        selectedInstanceId: s.selectedInstanceId === id ? null : s.selectedInstanceId,
        autopsy: s.autopsy?.instanceId === id ? null : s.autopsy,
      };
    });
    syncSim(get);
  },

  replaceInstance: (id) => {
    set((s) => ({
      instances: s.instances.map((i) =>
        i.id === id ? { ...i, simState: EMPTY_SIM_RESULT } : i,
      ),
      autopsy: s.autopsy?.instanceId === id ? null : s.autopsy,
    }));
    syncSim(get);
  },

  clearAll: () => {
    simStopSketch();
    simSetPowered(false);
    set({
      instances: [],
      pinHoles: {},
      wires: [],
      voltages: {},
      autopsy: null,
      selectedInstanceId: null,
      selectedWireId: null,
      pendingFrom: null,
      running: false,
      pinStates: {},
    });
  },

  loadDemo: () => {
    get().clearAll();
    // Rangkaian demo Batch 2: D13 -> resistor (baris 24->20) -> strip yang sama
    // dengan anoda LED (baris 20) -> katoda (baris 22) -> rail R- -> GND.
    // Pasangan DEFAULT_SKETCH: LED berkedip 1 detik.
    const place = (type: string, holeId: string) => {
      set({ placingType: type });
      get().placeAt(holeId);
    };
    place('resistor', terminalHoleId('R', 24, 2));
    place('led-5mm', terminalHoleId('R', 20, 4));
    const { instances } = get();
    const resistor = instances.find((i) => i.type === 'resistor');
    const led = instances.find((i) => i.type === 'led-5mm');
    if (!resistor || !led) return;
    const board = getBoardDefinition(get().boardId);
    const groundPin = board.pins.find((pin) => pin.kind === 'ground');
    if (!groundPin) return;
    const pinHoles = get().pinHoles;
    const wires: WireConnection[] = [
      { id: nextWireId(), a: { kind: 'board', pinId: board.demoPinId }, b: { kind: 'hole', holeId: pinHoles[resistor.id].A }, color: '#3b82f6' },
      { id: nextWireId(), a: { kind: 'hole', holeId: pinHoles[led.id].CATHODE }, b: { kind: 'hole', holeId: railHoleId('R-', 29) }, color: '#2a2e37' },
      { id: nextWireId(), a: { kind: 'hole', holeId: railHoleId('R-', 4) }, b: { kind: 'board', pinId: groundPin.id }, color: '#2a2e37' },
    ];
    set({
      wires,
      placingType: null,
      sketchCode: DEFAULT_SKETCH.replaceAll('13', String(board.demoPinNumber)),
    });
    syncSim(get);
  },

  selectInstance: (id) => set({ selectedInstanceId: id, selectedWireId: null }),
  selectWire: (id) => set({ selectedWireId: id, selectedInstanceId: null }),
  setHover: (hover) => set({ hover }),
  closeAutopsy: () => set({ autopsy: null }),

  setBoard: (boardId) => {
    if (boardId === get().boardId) return;
    simStopSketch();
    simSetPowered(false);
    simClearBoardDamage();
    set((s) => ({
      boardId,
      // Kabel yang menyentuh pin board lama tidak berlaku di board baru.
      wires: s.wires.filter((w) => w.a.kind !== 'board' && w.b.kind !== 'board'),
      running: false,
      pinStates: {},
      deadPins: [],
      boardFault: false,
      autopsy: null,
      selectedWireId: null,
      pendingFrom: null,
    }));
    syncSim(get);
  },

  setRunning: (running) => {
    set({ running });
    if (running) {
      syncSim(get);
      simSetPowered(true);
      simStartSketch(get().sketchCode);
    } else {
      simStopSketch();
      simSetPowered(false);
    }
  },

  setSketchCode: (code) => set({ sketchCode: code }),

  restartSketch: () => {
    if (!get().running) {
      get().setRunning(true);
      return;
    }
    syncSim(get);
    simStartSketch(get().sketchCode);
  },

  clearSerial: () => set({ serialText: '' }),

  replaceBoard: () => {
    simClearBoardDamage();
    set({ autopsy: null });
  },

  interact: (instanceId, patch) => {
    set((s) => ({
      instances: s.instances.map((i) =>
        i.id === instanceId
          ? { ...i, interactiveState: { ...i.interactiveState, ...patch } }
          : i,
      ),
    }));
    syncSim(get);
  },

  applySnapshot: (snapshot) => {
    const state = get();
    const nextInstances = state.instances.map((instance) => {
      const result = snapshot.results[instance.id];
      return result ? { ...instance, simState: result } : instance;
    });
    const serialText = snapshot.serialChunk
      ? (state.serialText + snapshot.serialChunk).slice(-6000)
      : state.serialText;
    const firstDamage = snapshot.damageEvents[0];
    const firstBoard = snapshot.boardEvents[0];
    if (firstDamage || firstBoard) {
      // Kerusakan baru: hentikan simulasi seperti Batch 1 (autopsi tampil).
      simStopSketch();
      simSetPowered(false);
      const damaged = firstDamage
        ? nextInstances.find((i) => i.id === firstDamage.instanceId)
        : null;
      set({
        instances: nextInstances,
        voltages: snapshot.voltages,
        serialText,
        pinStates: snapshot.pinStates,
        deadPins: snapshot.deadPins,
        boardFault: snapshot.boardFault,
        sketchError: snapshot.sketchError,
        running: false,
        autopsy: firstDamage
          ? { instanceId: firstDamage.instanceId, report: firstDamage.report }
          : { instanceId: null, boardPinId: firstBoard?.pinId ?? null, report: firstBoard!.report },
        focusPosition: damaged ? damaged.position : state.focusPosition,
        focusNonce: damaged ? state.focusNonce + 1 : state.focusNonce,
      });
      return;
    }
    set({
      instances: nextInstances,
      voltages: snapshot.voltages,
      serialText,
      pinStates: snapshot.pinStates,
      deadPins: snapshot.deadPins,
      boardFault: snapshot.boardFault,
      sketchError: snapshot.sketchError,
    });
  },

  netNameOf: (ref) => {
    const { instances, pinHoles, wires, boardId } = get();
    return buildNetlist(
      instances,
      pinHoles,
      wires,
      {},
      getBoardDefinition(boardId),
    ).netOfTerminal(ref);
  },
}));

export { holeWorldPosition };
