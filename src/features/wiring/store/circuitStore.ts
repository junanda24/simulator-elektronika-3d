import { create } from 'zustand';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type ComponentSimResult,
  type DamageReport,
  type PinState,
} from '../../../shared/types';
import { holeWorldPosition, terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';
import { buildNetlist, type TerminalRef, type WireConnection } from '../netlist';
import {
  DEFAULT_WIRE_COLOR,
  normalizeWireColor,
  type WireColorHex,
} from '../wireColors';
import {
  computeFreePlacement,
  computePlacement,
  isFreePlacementType,
  type PlacementRotation,
} from '../placement';
import { playClick, playSnap } from '../../../shared/utils/soundFx';
import {
  addSimRecoveryListener,
  setSimBusyListener,
  simClearBoardDamage,
  simSetCircuit,
  simSetPowered,
  simStartSketch,
  simStopSketch,
  type SimRecoveryEntry,
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

/** Satu pemberitahuan self-healing yang menunggu ditampilkan ke pengguna. */
export interface SimNoticeItem {
  id: number;
  text: string;
}

/** Batas tumpukan pemberitahuan — yang terlama dibuang lebih dulu. */
const SIM_NOTICE_LIMIT = 5;

/**
 * Keluarga MODE ALAT (satu sumber kebenaran untuk perilaku klik/drag di
 * kanvas — menggantikan boolean deleteMode lama):
 * - 'build'  : bawaan; semua aksi merakit aktif (pasang, kabel, gizmo).
 * - 'hand'   : navigasi murni — seret kiri menggeser pandangan, klik
 *              hanya memilih; pasang/kabel/drag gizmo dimatikan di
 *              gerbang aksi store (clickTerminal/placeAt/setPlacing/
 *              interact/setDragging3D), BUKAN di tiap komponen.
 * - 'delete' : Mode Hapus lama — seleksi berikutnya langsung dihapus
 *              (perilakunya di App, persis seperti sebelumnya).
 */
export type ToolMode = 'build' | 'hand' | 'delete';

/** Snapshot rangkaian untuk histori undo/redo — data polos saja, aman di-deep-clone. */
interface CircuitSnapshot {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
}

const HISTORY_LIMIT = 50;

/**
 * Deep-clone snapshot histori — DEFENSIF: bila ada nilai yang tidak bisa
 * di-klon (mis. fungsi nyasar di interactiveState), kembalikan null agar
 * pencatatan histori dilewati TANPA menggagalkan aksi user (placeAt dsb.).
 */
function tryTakeSnapshot(state: CircuitSnapshot): CircuitSnapshot | null {
  try {
    return structuredClone({
      instances: state.instances,
      pinHoles: state.pinHoles,
      wires: state.wires,
    });
  } catch {
    return null;
  }
}

type SetFn = (partial: Partial<CircuitStore>) => void;

/** Dorong snapshot state SAAT INI ke tumpukan undo — panggil SEBELUM mutasi. */
function pushHistory(set: SetFn, get: () => CircuitStore): void {
  const s = get();
  const snap = tryTakeSnapshot(s);
  if (!snap) {
    // Tidak bisa dicatat: mutasi tetap jalan, tumpukan redo dibatalkan
    // (mutasi baru memang membatalkan masa depan alternatif), past dibiarkan.
    set({ future: [], canRedo: false });
    return;
  }
  const past = [...s.past, snap].slice(-HISTORY_LIMIT);
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
  /**
   * Indikator proses berat di sesi simulasi: true sejak perintah sesi
   * dikirim (bridge melaporkan tepi naik in-flight), false saat snapshot
   * berikutnya tiba di applySnapshot, atau saat proses diakhiri lewat
   * jalur berhenti/error (lihat setRunning(false) & clearAll). UI
   * memakai field ini untuk pil "Memproses…" + mengunci tombol.
   */
  simBusy: boolean;
  boardId: string;
  voltages: Record<string, number>;
  sketchCode: string;
  serialText: string;
  pinStates: Record<string, PinState>;
  deadPins: string[];
  boardFault: boolean;
  sketchError: string | null;
  /** Baris sketch yang sedang dieksekusi (dari snapshot sesi); null = tanpa sorot. */
  currentLine: number | null;
  /**
   * Kegagalan solver yang sedang berlaku (cermin `solverError` snapshot
   * sesi, self-healing SH-2/SH-3): non-null selama solver gagal
   * menghitung rangkaian dan snapshot menampilkan keadaan aman serba-0.
   * UI menampilkannya sebagai pill status persisten; bersih sendiri
   * saat snapshot sehat kembali.
   */
  solverError: string | null;
  /**
   * Antrian pemberitahuan self-healing dari snapshot (kolom `notice`
   * one-shot sesi/bridge — pemulihan worker, solver gagal/pulih):
   * dirender App sebagai pill di tumpukan pemberitahuan dan dibuang
   * lewat dismissSimNotice (tombol tutup / hilang otomatis).
   */
  simNotices: SimNoticeItem[];
  /**
   * Teks notice pada snapshot TERAKHIR yang diproses — pembanding anti
   * dobel: teks yang sama pada snapshot berturut-turut antri sekali;
   * snapshot tanpa notice meresetnya ke null, jadi peristiwa yang sama
   * di kemudian waktu tetap tampil lagi.
   */
  lastNoticeText: string | null;
  activeLessonId: string | null;
  lessonChecks: boolean[];
  completedLessons: string[];
  lastDamageRuleId: string | null;
  autopsy: AutopsyState | null;
  selectedInstanceId: string | null;
  selectedWireId: string | null;
  placingType: string | null;
  pendingFrom: TerminalRef | null;
  /**
   * Warna kabel aktif — perilaku RADIO: selalu tepat satu hex dari palet
   * kanonik (wireColors.ts), tidak pernah kosong. Tipe union literal +
   * setter yang menolak nilai di luar palet menjaga invariant ini.
   */
  wireColor: WireColorHex;
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
  /** Mode alat aktif (keluarga ToolMode) — lihat definisi ToolMode. */
  toolMode: ToolMode;

  setPlacing: (type: string | null) => void;
  placeAt: (holeId: string) => boolean;
  /** Penempatan terminal-bebas (baterai 9V): titik [x, z] di alas meja. */
  placeFreeAt: (point: [number, number]) => boolean;
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
  setToolMode: (mode: ToolMode) => void;
  closeAutopsy: () => void;
  /** Buang satu pemberitahuan self-healing dari antrian tampil. */
  dismissSimNotice: (id: number) => void;
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

let noticeCounter = 0;
function nextNoticeId(): number {
  noticeCounter += 1;
  return noticeCounter;
}

function sameTerminal(a: TerminalRef, b: TerminalRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'hole' && b.kind === 'hole') return a.holeId === b.holeId;
  if (a.kind === 'board' && b.kind === 'board') return a.pinId === b.pinId;
  if (a.kind === 'component' && b.kind === 'component') {
    return a.instanceId === b.instanceId && a.pinId === b.pinId;
  }
  return false;
}

/** Kabel yang menyentuh terminal komponen milik instance tertentu. */
function touchesComponentInstance(ref: TerminalRef, instanceId: string): boolean {
  return ref.kind === 'component' && ref.instanceId === instanceId;
}

/** Perbandingan dangkal dua record angka (pinVoltages / branchCurrents). */
function sameNumberRecord(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

function sameDamageReport(a?: DamageReport, b?: DamageReport): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.ruleId === b.ruleId &&
    a.titleId === b.titleId &&
    a.explanationId === b.explanationId &&
    a.measured === b.measured &&
    a.limit === b.limit &&
    a.unit === b.unit
  );
}

/**
 * Kesetaraan NILAI dua hasil simulasi. Solver selalu membuat objek hasil
 * baru di setiap solve — tanpa perbandingan ini, applySnapshot akan
 * mengganti objek SEMUA instance di setiap snapshot (±60/dtk) dan
 * menghancurkan memo React di panggung 3D (animasi patah-patah).
 */
function sameSimResult(a: ComponentSimResult, b: ComponentSimResult): boolean {
  return (
    a.isDamaged === b.isDamaged &&
    sameNumberRecord(a.pinVoltages, b.pinVoltages) &&
    sameNumberRecord(a.branchCurrents, b.branchCurrents) &&
    sameDamageReport(a.damageReport, b.damageReport)
  );
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
  simBusy: false,
  boardId: 'uno',
  voltages: {},
  sketchCode: DEFAULT_SKETCH,
  serialText: '',
  pinStates: {},
  deadPins: [],
  boardFault: false,
  sketchError: null,
  currentLine: null,
  solverError: null,
  simNotices: [],
  lastNoticeText: null,
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
  wireColor: DEFAULT_WIRE_COLOR,
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
  toolMode: 'build',

  setCameraView: (target, position) =>
    set((s) => ({
      cameraView: { target, position, nonce: (s.cameraView?.nonce ?? 0) + 1 },
    })),

  setToolMode: (mode) => {
    if (mode === get().toolMode) return;
    if (mode === 'hand') {
      // Masuk Mode Tangan: batalkan gestur merakit yang menggantung
      // (kabel setengah jadi / mode pasang / pratinjau kursor) agar tidak
      // bocor ke mode navigasi, dan lepaskan kunci drag 3D agar
      // OrbitControls tidak tertahan mati oleh drag gizmo yang terputus.
      set({
        toolMode: mode,
        pendingFrom: null,
        placingType: null,
        placementRotation: 0,
        wireCursorPos: null,
        isDragging3D: false,
      });
      return;
    }
    set({ toolMode: mode });
  },

  setPlacing: (type) => {
    // Gerbang Mode Tangan: klik tile katalog tidak boleh mengaktifkan
    // mode pasang (membatalkan dengan null tetap selalu boleh).
    if (type !== null && get().toolMode === 'hand') return;
    set({
      placingType: type,
      pendingFrom: null,
      placementRotation: type === null ? 0 : get().placementRotation,
    });
  },

  setDragging3D: (v) => {
    // Gerbang Mode Tangan: drag gizmo tidak boleh merebut kamera —
    // isDragging3D=true akan mematikan OrbitControls dan mengunci
    // gestur geser. Nilai false (akhir drag) tetap selalu diterima.
    if (v && get().toolMode === 'hand') return;
    set({ isDragging3D: v });
  },

  rotatePlacement: () =>
    set((s) => ({
      placementRotation: ((s.placementRotation + 90) % 360) as PlacementRotation,
    })),

  setWireCursorPos: (pos) => set({ wireCursorPos: pos }),

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const restored = tryTakeSnapshot(state.past[state.past.length - 1]);
    if (!restored) {
      // Entri histori tidak bisa di-klon: buang entri itu, jangan gagalkan undo.
      const past = state.past.slice(0, -1);
      set({ past, canUndo: past.length > 0 });
      return;
    }
    const current = tryTakeSnapshot(state);
    set({
      past: state.past.slice(0, -1),
      future: current ? [...state.future, current] : state.future,
      instances: restored.instances,
      pinHoles: restored.pinHoles,
      wires: restored.wires,
      pendingFrom: null,
      wireCursorPos: null,
      ...pruneAfterRestore(state, restored),
      canUndo: state.past.length - 1 > 0,
      canRedo: current ? true : state.canRedo,
    });
    syncSim(get);
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const restored = tryTakeSnapshot(state.future[state.future.length - 1]);
    if (!restored) {
      const future = state.future.slice(0, -1);
      set({ future, canRedo: future.length > 0 });
      return;
    }
    const current = tryTakeSnapshot(state);
    set({
      past: current
        ? [...state.past, current].slice(-HISTORY_LIMIT)
        : state.past,
      future: state.future.slice(0, -1),
      instances: restored.instances,
      pinHoles: restored.pinHoles,
      wires: restored.wires,
      pendingFrom: null,
      wireCursorPos: null,
      ...pruneAfterRestore(state, restored),
      canUndo: current ? true : state.canUndo,
      canRedo: state.future.length - 1 > 0,
    });
    syncSim(get);
  },

  placeAt: (holeId) => {
    // Gerbang Mode Tangan: tidak ada penempatan komponen.
    if (get().toolMode === 'hand') return false;
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

  placeFreeAt: (point) => {
    // Gerbang Mode Tangan sama seperti placeAt.
    if (get().toolMode === 'hand') return false;
    const { placingType, instances, pinHoles, placementRotation } = get();
    if (!placingType || !isFreePlacementType(placingType)) return false;
    const others: Array<[number, number]> = instances
      .filter((i) => isFreePlacementType(i.type))
      .map((i) => [i.position[0], i.position[2]]);
    const placement = computeFreePlacement(placingType, point, others, placementRotation);
    if (!placement) return false;
    pushHistory(set, get);
    set({
      instances: [...instances, placement.instance],
      // pinHoles kosong: terminal baterai hidup sebagai TerminalRef
      // 'component', bukan lubang (lihat placement.ts & netlist.ts).
      pinHoles: { ...pinHoles, [placement.instance.id]: placement.pinHoles },
      placingType: null,
      selectedInstanceId: placement.instance.id,
    });
    syncSim(get);
    playSnap();
    return true;
  },

  clickTerminal: (ref) => {
    // Gerbang Mode Tangan: klik terminal tidak memulai/menyambung kabel.
    if (get().toolMode === 'hand') return;
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
  setWireColor: (color) => {
    // Radio, bukan toggle: nilai di luar palet (termasuk string kosong)
    // ditolak diam-diam — warna aktif sekarang dipertahankan, pilihan
    // tidak pernah bisa kosong. Mengklik warna yang sedang aktif pun
    // menormalkan ke hex yang sama: keadaan akhir tidak berubah.
    const canonical = normalizeWireColor(color);
    if (canonical) set({ wireColor: canonical });
  },

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
        // Kabel berujung terminal komponen milik instance ini ikut
        // hilang — ujungnya tidak menunjuk apa-apa lagi (berbeda dari
        // kabel lubang/board yang memang independen dari komponen).
        wires: s.wires.filter(
          (w) => !touchesComponentInstance(w.a, id) && !touchesComponentInstance(w.b, id),
        ),
        pendingFrom:
          s.pendingFrom && touchesComponentInstance(s.pendingFrom, id)
            ? null
            : s.pendingFrom,
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
      simBusy: false,
      pinStates: {},
      currentLine: null,
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

  dismissSimNotice: (id) =>
    set((s) => ({ simNotices: s.simNotices.filter((n) => n.id !== id) })),

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
      currentLine: null,
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
    // Berhenti = sorot baris eksekusi hilang seketika, tanpa menunggu
    // snapshot berikutnya dari sesi.
    set({ running, ...(running ? {} : { currentLine: null }) });
    if (running) {
      syncSim(get);
      simSetPowered(true);
      simStartSketch(get().sketchCode);
    } else {
      simStopSketch();
      simSetPowered(false);
      // Jalur keluar simBusy untuk perintah berhenti: jangan menunggu
      // snapshot — proses memang sedang diakhiri dari sisi UI.
      set({ simBusy: false });
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
    // Gerbang Mode Tangan: SEMUA manipulasi komponen (knop putar,
    // joystick, gizmo sensor, tombol tekan) bermuara ke aksi ini lewat
    // onInteract — mematikannya di sini mematikan seluruh gizmo tanpa
    // menyentuh satu pun model komponen.
    if (get().toolMode === 'hand') return;
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
    // --- Self-healing (SH-3): notice one-shot + status solver ---
    // notice hanya antri bila teksnya berbeda dari notice snapshot
    // sebelumnya (anti dobel berturut-turut); snapshot tanpa notice
    // mereset pembanding, jadi peristiwa sama yang terjadi lagi di
    // kemudian waktu tetap tampil. solverError dicerminkan apa adanya:
    // persisten selama solver gagal, bersih saat snapshot sehat.
    let simNotices = state.simNotices;
    if (snapshot.notice && snapshot.notice !== state.lastNoticeText) {
      simNotices = [
        ...simNotices,
        { id: nextNoticeId(), text: snapshot.notice },
      ].slice(-SIM_NOTICE_LIMIT);
    }
    const lastNoticeText = snapshot.notice;
    const solverError = snapshot.solverError;
    // Pertahankan referensi objek instance yang hasil simulasinya TIDAK
    // berubah nilainya — hanya instance yang berubah yang dibuat baru,
    // supaya React.memo di panggung 3D bisa melewati render ulang.
    let instancesChanged = false;
    const mappedInstances = state.instances.map((instance) => {
      const result = snapshot.results[instance.id];
      if (!result || sameSimResult(instance.simState, result)) return instance;
      instancesChanged = true;
      return { ...instance, simState: result };
    });
    const nextInstances = instancesChanged ? mappedInstances : state.instances;
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
        solverError,
        simNotices,
        lastNoticeText,
        running: false,
        simBusy: false,
        currentLine: null,
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
      solverError,
      simNotices,
      lastNoticeText,
      simBusy: false,
      currentLine: snapshot.currentLine,
      // Kejujuran status: bila sketch mati karena error (snapshot
      // melaporkan sketchRunning false) sementara UI mengira masih
      // berjalan, samakan statusnya — header tidak boleh terus
      // menampilkan "Simulasi berjalan" untuk sketch yang sudah berhenti.
      running:
        snapshot.sketchError !== null && !snapshot.sketchRunning
          ? false
          : state.running,
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
      currentLine: null,
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

// Latch simBusy: tepi naik in-flight dari bridge (perintah sesi pertama
// dikirim) menyalakan indikator; pemadaman dimiliki store sendiri
// (applySnapshot / jalur berhenti di setRunning & clearAll) karena
// "selesai dieksekusi worker" tidak sama dengan "snapshot sudah tiba".
setSimBusyListener((busy) => {
  if (busy) useCircuitStore.setState({ simBusy: true });
});

/**
 * Reaksi store terhadap peristiwa pemulihan bridge (self-healing SH-3).
 * Hanya pemulihan 'watchdog' yang meninggalkan sesi BERHENTI: sketch
 * yang beku sengaja TIDAK diputar ulang oleh bridge (di bridge,
 * restartSketch:false hanya dipakai jalur watchdog), jadi flag
 * `running` harus padam dan sorot baris eksekusi hilang — store
 * MENCERMINKAN keadaan sesi, bukan mengambil alih kendali. Pemulihan
 * lain ('worker-error' / 'ping-gagal') memutar ulang sketch, jadi
 * status jalan tidak disentuh.
 *
 * Kenapa tidak dicerminkan dari `sketchRunning` snapshot saja?
 * Snapshot sketchRunning=false juga tiba pada momen yang sah: tepat
 * setelah pengguna menekan Jalankan (snapshot setCircuit mendahului
 * startSketch) dan selama putar-ulang pemulihan restart (setCircuit &
 * setPowered terbit sebelum startSketch). Itulah kontrak F-1 yang
 * terkunci tes: tanpa error, snapshot tidak menyentuh status. Saluran
 * pemulihan bridge adalah satu-satunya sinyal yang membedakan "sesi
 * dihentikan mesin" dari "sketch belum berjalan".
 */
export function handleSimRecoveryForStore(entry: SimRecoveryEntry): void {
  if (entry.reason !== 'watchdog') return;
  useCircuitStore.setState({ running: false, currentLine: null });
}

// Daftarkan sebagai pendengar TAMBAHAN (multi-pendengar): slot tunggal
// setSimRecoveryListener adalah milik DiagnosticsPanel selama panel
// terpasang — merebutnya akan membungkam salah satu konsumen.
addSimRecoveryListener(handleSimRecoveryForStore);
