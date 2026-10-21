import { create } from 'zustand';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type DamageReport,
  type PinState,
} from '../../../shared/types';
import { holeWorldPosition, terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';
import { buildNetlist, type TerminalRef, type WireConnection } from '../netlist';
import { computePlacement, type PlacementRotation } from '../placement';
import { playClick, playSnap } from '../../../shared/utils/soundFx';
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
import { getLesson } from '../../lessons/curriculum';
import { evaluateAssertions, type LessonContext } from '../../lessons/engine';
import type { SharedProject } from '../../share/projectShare';

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

/** Snapshot rangkaian untuk histori undo/redo — data polos saja, aman di-deep-clone. */
interface CircuitSnapshot {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
}

const HISTORY_LIMIT = 50;

function takeSnapshot(state: CircuitSnapshot): CircuitSnapshot {
  return structuredClone({
    instances: state.instances,
    pinHoles: state.pinHoles,
    wires: state.wires,
  });
}

type SetFn = (partial: Partial<CircuitStore>) => void;

/** Dorong snapshot state SAAT INI ke tumpukan undo — panggil SEBELUM mutasi. */
function pushHistory(set: SetFn, get: () => CircuitStore): void {
  const s = get();
  const past = [...s.past, takeSnapshot(s)].slice(-HISTORY_LIMIT);
  set({ past, future: [], canUndo: true, canRedo: false });
}

/** Kosongkan histori — proyek/demo/starter/board baru adalah titik awal baru. */
function resetHistory(set: SetFn): void {
  set({ past: [], future: [], canUndo: false, canRedo: false });
}

/** Pilihan & autopsi yang menunjuk entitas yang sudah tidak ada dibersihkan. */
function pruneAfterRestore(
  state: CircuitStore,
  restored: CircuitSnapshot,
): Pick<CircuitStore, 'selectedInstanceId' | 'selectedWireId' | 'autopsy'> {
  return {
    selectedInstanceId: restored.instances.some((i) => i.id === state.selectedInstanceId)
      ? state.selectedInstanceId
      : null,
    selectedWireId: restored.wires.some((w) => w.id === state.selectedWireId)
      ? state.selectedWireId
      : null,
    autopsy:
      state.autopsy?.instanceId &&
      !restored.instances.some((i) => i.id === state.autopsy?.instanceId)
        ? null
        : state.autopsy,
  };
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
  activeLessonId: string | null;
  lessonChecks: boolean[];
  completedLessons: string[];
  lastDamageRuleId: string | null;
  autopsy: AutopsyState | null;
  selectedInstanceId: string | null;
  selectedWireId: string | null;
  placingType: string | null;
  pendingFrom: TerminalRef | null;
  wireColor: string;
  hover: HoverState | null;
  focusNonce: number;
  focusPosition: [number, number, number] | null;
  /** State transien interaksi 3D (Batch 6) — tidak ikut disimpan/di-share. */
  isDragging3D: boolean;
  placementRotation: PlacementRotation;
  wireCursorPos: [number, number, number] | null;
  /** Tumpukan histori undo/redo berisi snapshot {instances, pinHoles, wires}. */
  past: CircuitSnapshot[];
  future: CircuitSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  /** Perintah gerak kamera dari UI (preset / fokus autopsi) — nonce memicu CameraRig. */
  cameraView: {
    target: [number, number, number];
    position: [number, number, number];
    nonce: number;
  } | null;
  /** Mode hapus: klik seleksi berikutnya langsung menghapus entitasnya. */
  deleteMode: boolean;

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
  setDragging3D: (v: boolean) => void;
  rotatePlacement: () => void;
  setWireCursorPos: (pos: [number, number, number] | null) => void;
  undo: () => void;
  redo: () => void;
  setCameraView: (
    target: [number, number, number],
    position: [number, number, number],
  ) => void;
  setDeleteMode: (v: boolean) => void;
  closeAutopsy: () => void;
  setRunning: (running: boolean) => void;
  setBoard: (boardId: string) => void;
  setSketchCode: (code: string) => void;
  restartSketch: () => void;
  clearSerial: () => void;
  replaceBoard: () => void;
  interact: (instanceId: string, patch: Record<string, unknown>) => void;
  applySnapshot: (snapshot: SimSnapshot) => void;
  setActiveLesson: (id: string | null) => void;
  applyStarter: (lessonId: string) => void;
  loadShared: (project: SharedProject) => void;
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
  activeLessonId: null,
  lessonChecks: [],
  completedLessons: (() => {
    try {
      const raw = localStorage.getItem('sim3d:completed-lessons');
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })(),
  lastDamageRuleId: null,
  autopsy: null,
  selectedInstanceId: null,
  selectedWireId: null,
  placingType: null,
  pendingFrom: null,
  wireColor: '#3b82f6',
  hover: null,
  focusNonce: 0,
  focusPosition: null,
  isDragging3D: false,
  placementRotation: 0,
  wireCursorPos: null,
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
  cameraView: null,
  deleteMode: false,

  setCameraView: (target, position) =>
    set((s) => ({
      cameraView: { target, position, nonce: (s.cameraView?.nonce ?? 0) + 1 },
    })),

  setDeleteMode: (v) => set({ deleteMode: v }),

  setPlacing: (type) =>
    set({
      placingType: type,
      pendingFrom: null,
      placementRotation: type === null ? 0 : get().placementRotation,
    }),

  setDragging3D: (v) => set({ isDragging3D: v }),

  rotatePlacement: () =>
    set((s) => ({
      placementRotation: ((s.placementRotation + 90) % 360) as PlacementRotation,
    })),

  setWireCursorPos: (pos) => set({ wireCursorPos: pos }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const restored = takeSnapshot(state.past[state.past.length - 1]);
    set({
      past: state.past.slice(0, -1),
      future: [...state.future, takeSnapshot(state)],
      instances: restored.instances,
      pinHoles: restored.pinHoles,
      wires: restored.wires,
      pendingFrom: null,
      wireCursorPos: null,
      ...pruneAfterRestore(state, restored),
      canUndo: state.past.length - 1 > 0,
      canRedo: true,
    });
    syncSim(get);
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const restored = takeSnapshot(state.future[state.future.length - 1]);
    set({
      past: [...state.past, takeSnapshot(state)].slice(-HISTORY_LIMIT),
      future: state.future.slice(0, -1),
      instances: restored.instances,
      pinHoles: restored.pinHoles,
      wires: restored.wires,
      pendingFrom: null,
      wireCursorPos: null,
      ...pruneAfterRestore(state, restored),
      canUndo: true,
      canRedo: state.future.length - 1 > 0,
    });
    syncSim(get);
  },

  placeAt: (holeId) => {
    const { placingType, instances, pinHoles, placementRotation } = get();
    if (!placingType) return false;
    const occupied = new Set(Object.values(pinHoles).flatMap((m) => Object.values(m)));
    const placement = computePlacement(placingType, holeId, occupied, placementRotation);
    if (!placement) return false;
    pushHistory(set, get);
    set({
      instances: [...instances, placement.instance],
      pinHoles: { ...pinHoles, [placement.instance.id]: placement.pinHoles },
      placingType: null,
      selectedInstanceId: placement.instance.id,
    });
    syncSim(get);
    playSnap();
    return true;
  },

  clickTerminal: (ref) => {
    const { pendingFrom, wires, wireColor } = get();
    if (!pendingFrom) {
      set({ pendingFrom: ref, selectedWireId: null });
      return;
    }
    if (sameTerminal(pendingFrom, ref)) {
      set({ pendingFrom: null, wireCursorPos: null });
      return;
    }
    const exists = wires.some(
      (w) =>
        (sameTerminal(w.a, pendingFrom) && sameTerminal(w.b, ref)) ||
        (sameTerminal(w.a, ref) && sameTerminal(w.b, pendingFrom)),
    );
    if (!exists) {
      pushHistory(set, get);
      set({
        wires: [...wires, { id: nextWireId(), a: pendingFrom, b: ref, color: wireColor }],
      });
      syncSim(get);
      playClick(880);
    }
    set({ pendingFrom: null, wireCursorPos: null });
  },

  cancelPending: () =>
    set({ pendingFrom: null, placingType: null, placementRotation: 0, wireCursorPos: null }),
  setWireColor: (color) => set({ wireColor: color }),

  removeWire: (id) => {
    pushHistory(set, get);
    set((s) => ({
      wires: s.wires.filter((w) => w.id !== id),
      selectedWireId: s.selectedWireId === id ? null : s.selectedWireId,
    }));
    syncSim(get);
  },

  removeInstance: (id) => {
    pushHistory(set, get);
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
    pushHistory(set, get);
    set((s) => ({
      instances: s.instances.map((i) =>
        i.id === id ? { ...i, simState: EMPTY_SIM_RESULT } : i,
      ),
      autopsy: s.autopsy?.instanceId === id ? null : s.autopsy,
    }));
    syncSim(get);
  },

  clearAll: () => {
    pushHistory(set, get);
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
      lessonChecks: [],
      lastDamageRuleId: null,
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
    if (!resistor || !led) {
      resetHistory(set);
      return;
    }
    const board = getBoardDefinition(get().boardId);
    const groundPin = board.pins.find((pin) => pin.kind === 'ground');
    if (!groundPin) {
      resetHistory(set);
      return;
    }
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
    resetHistory(set);
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
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
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
    // SENGAJA tidak dicatat ke histori undo: interact dipakai oleh drag
    // kontinu (potensiometer, joystick, sensor) yang memicu puluhan mutasi
    // per detik — mencatatnya akan membanjiri tumpukan histori (batas 50)
    // dan mengusir snapshot mutasi penting (pasang/hapus komponen & kabel).
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

    // --- Evaluasi lesson (sticky): konteks dari snapshot + netlist segar ---
    const damageRuleId =
      firstDamage?.report.ruleId ?? firstBoard?.report.ruleId ?? state.lastDamageRuleId;
    let lessonChecks = state.lessonChecks;
    let completedLessons = state.completedLessons;
    const activeLesson = state.activeLessonId ? getLesson(state.activeLessonId) : undefined;
    if (activeLesson) {
      const board = getBoardDefinition(state.boardId);
      const netlist = buildNetlist(
        nextInstances,
        state.pinHoles,
        state.wires,
        snapshot.pinStates,
        board,
      );
      const ctx: LessonContext = {
        boardId: state.boardId,
        instances: nextInstances,
        pinStates: snapshot.pinStates,
        serialText,
        lastDamageRuleId: damageRuleId,
        voltageOfBoardPin: (pinId) => snapshot.voltages[netlist.netOfBoardPin(pinId)],
        voltageOfComponentPin: (type, pinId) => {
          const inst = nextInstances.find((i) => i.type === type);
          if (!inst) return undefined;
          const net = netlist.netOfPin(inst.id, pinId);
          return net ? snapshot.voltages[net] : undefined;
        },
      };
      const fresh = evaluateAssertions(activeLesson.assertions, ctx);
      lessonChecks = activeLesson.assertions.map((_, i) => lessonChecks[i] || fresh[i]);
      if (
        lessonChecks.every(Boolean) &&
        !completedLessons.includes(activeLesson.id)
      ) {
        completedLessons = [...completedLessons, activeLesson.id];
        try {
          localStorage.setItem(
            'sim3d:completed-lessons',
            JSON.stringify(completedLessons),
          );
        } catch {
          /* penyimpanan lokal tidak tersedia; abaikan */
        }
      }
    }

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
        lastDamageRuleId: damageRuleId,
        lessonChecks,
        completedLessons,
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
      lastDamageRuleId: damageRuleId,
      lessonChecks,
      completedLessons,
    });
  },

  setActiveLesson: (id) => {
    set({
      activeLessonId: id,
      lessonChecks: id ? (getLesson(id)?.assertions.map(() => false) ?? []) : [],
      lastDamageRuleId: null,
    });
  },

  applyStarter: (lessonId) => {
    const lesson = getLesson(lessonId);
    if (!lesson?.starter) return;
    if (lesson.boardId !== get().boardId) get().setBoard(lesson.boardId);
    get().clearAll();
    const starter = lesson.starter;
    for (const placement of starter.placements) {
      set({ placingType: placement.type });
      const before = new Set(get().instances.map((i) => i.id));
      get().placeAt(placement.holeId);
      if (placement.props) {
        const placed = get().instances.find((i) => !before.has(i.id));
        if (placed) {
          set((s) => ({
            instances: s.instances.map((i) =>
              i.id === placed.id ? { ...i, props: { ...i.props, ...placement.props } } : i,
            ),
          }));
        }
      }
    }
    set({
      wires: starter.wires.map((w) => ({ ...w, id: nextWireId() })),
      placingType: null,
      sketchCode: starter.sketch ?? get().sketchCode,
      activeLessonId: lesson.id,
      lessonChecks: lesson.assertions.map(() => false),
      lastDamageRuleId: null,
    });
    syncSim(get);
    resetHistory(set);
  },

  loadShared: (project) => {
    simStopSketch();
    simSetPowered(false);
    set({
      boardId: project.boardId,
      instances: project.instances.map((i) => ({
        ...i,
        interactiveState: i.interactiveState ?? {},
        simState: EMPTY_SIM_RESULT,
      })),
      pinHoles: project.pinHoles,
      wires: project.wires,
      sketchCode: project.sketchCode,
      running: false,
      pinStates: {},
      autopsy: null,
      activeLessonId: null,
      lessonChecks: [],
      lastDamageRuleId: null,
      selectedInstanceId: null,
      selectedWireId: null,
      pendingFrom: null,
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
    syncSim(get);
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
