import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type ComponentSimResult,
  type DamageReport,
} from '../../../shared/types';
import { useCircuitStore } from '../store/circuitStore';
import type { WireConnection } from '../netlist';
import type { SimSnapshot } from '../../simulation/worker/bridge';

/**
 * Audit P2 (store) — K8, K9, K11:
 * K8: setBoard membuang kabel berujung pin board (termasuk pin yang tidak
 *     ada di board baru, mis. board:D36 ESP32 → Uno).
 * K9: isDamaged PERSISTEN secara desain — setRunning(true) TIDAK meresetnya;
 *     jalur pemulihan sah = replaceInstance ("Ganti Komponen").
 * K11: interact saat running mengubah interactiveState, dan applySnapshot
 *     TIDAK menimpanya (hanya simState yang diganti).
 */

function makeInstance(
  id: string,
  overrides: Partial<ComponentInstanceState> = {},
): ComponentInstanceState {
  return {
    id,
    type: 'push-button',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState: {},
    simState: EMPTY_SIM_RESULT,
    ...overrides,
  };
}

function makeSnapshot(results: Record<string, ComponentSimResult>): SimSnapshot {
  return {
    voltages: {},
    results,
    damageEvents: [],
    boardEvents: [],
    pinStates: {},
    deadPins: [],
    boardFault: false,
    serialChunk: '',
    sketchError: null,
    sketchRunning: true,
    currentLine: null,
    solverError: null,
    notice: null,
  };
}

beforeEach(() => {
  useCircuitStore.setState({
    instances: [],
    pinHoles: {},
    wires: [],
    running: false,
    simBusy: false,
    boardId: 'uno',
    autopsy: null,
    activeLessonId: null,
    lessonChecks: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
});

describe('K8 — setBoard membersihkan kabel board lama', () => {
  it('ESP32 → Uno: kabel board:D36 dibuang, kabel lubang↔lubang bertahan', () => {
    const ghostWire: WireConnection = {
      id: 'w-ghost',
      a: { kind: 'board', pinId: 'D36' },
      b: { kind: 'hole', holeId: 'L:10:0' },
      color: '#3b82f6',
    };
    const holeWire: WireConnection = {
      id: 'w-hole',
      a: { kind: 'hole', holeId: 'L:10:0' },
      b: { kind: 'hole', holeId: 'L:12:0' },
      color: '#22c55e',
    };
    useCircuitStore.setState({
      boardId: 'esp32',
      wires: [ghostWire, holeWire],
      running: true,
      deadPins: ['D36'],
    });
    useCircuitStore.getState().setBoard('uno');
    const st = useCircuitStore.getState();
    expect(st.boardId).toBe('uno');
    expect(st.wires).toEqual([holeWire]);
    expect(st.wires.some((w) => w.a.kind === 'board' || w.b.kind === 'board')).toBe(false);
    expect(st.running).toBe(false);
    expect(st.deadPins).toEqual([]);
  });
});

describe('K9 — persistensi kerusakan adalah desain; pemulihan via Ganti Komponen', () => {
  const report: DamageReport = {
    ruleId: 'LED_OVERCURRENT',
    titleId: 'LED Terbakar',
    explanationId: 'Arus melebihi batas.',
    measured: 0.12,
    limit: 0.03,
    unit: 'A',
  };

  it('setRunning(true) TIDAK menghapus isDamaged (kerusakan persisten by design)', () => {
    const damaged = makeInstance('btn-1', {
      type: 'led-5mm',
      simState: { pinVoltages: {}, branchCurrents: {}, isDamaged: true, damageReport: report },
    });
    useCircuitStore.setState({ instances: [damaged] });
    useCircuitStore.getState().setRunning(true);
    const st = useCircuitStore.getState();
    expect(st.instances[0].simState.isDamaged).toBe(true);
    expect(st.instances[0].simState.damageReport?.ruleId).toBe('LED_OVERCURRENT');
    useCircuitStore.getState().setRunning(false);
  });

  it('replaceInstance memulihkan komponen rusak ke kondisi baru dan menutup autopsi', () => {
    const damaged = makeInstance('led-1', {
      type: 'led-5mm',
      simState: { pinVoltages: {}, branchCurrents: {}, isDamaged: true, damageReport: report },
    });
    useCircuitStore.setState({
      instances: [damaged],
      autopsy: { instanceId: 'led-1', report },
    });
    useCircuitStore.getState().replaceInstance('led-1');
    const st = useCircuitStore.getState();
    expect(st.instances[0].simState).toBe(EMPTY_SIM_RESULT);
    expect(st.instances[0].simState.isDamaged).toBe(false);
    expect(st.autopsy).toBeNull();
  });
});

describe('simBusy — indikator proses sesi (kontrak untuk UI)', () => {
  it('awal false; applySnapshot biasa memadamkannya', () => {
    expect(useCircuitStore.getState().simBusy).toBe(false);
    useCircuitStore.setState({ simBusy: true });
    useCircuitStore.getState().applySnapshot(makeSnapshot({}));
    expect(useCircuitStore.getState().simBusy).toBe(false);
  });

  it('snapshot berisi sketchError ikut memadamkan (jalur error tidak macet true)', () => {
    useCircuitStore.setState({ simBusy: true, running: true });
    useCircuitStore.getState().applySnapshot({
      ...makeSnapshot({}),
      sketchError: 'Baris 1: contoh error.',
      sketchRunning: false,
    });
    const st = useCircuitStore.getState();
    expect(st.simBusy).toBe(false);
    expect(st.running).toBe(false);
  });

  it('snapshot kerusakan (cabang damage applySnapshot) ikut memadamkan', () => {
    const report: DamageReport = {
      ruleId: 'LED_OVERCURRENT',
      titleId: 'LED Terbakar',
      explanationId: 'Arus melebihi batas.',
      measured: 0.12,
      limit: 0.03,
      unit: 'A',
    };
    const led = makeInstance('led-9', { type: 'led-5mm' });
    useCircuitStore.setState({ instances: [led], simBusy: true, running: true });
    useCircuitStore.getState().applySnapshot({
      ...makeSnapshot({}),
      damageEvents: [{ instanceId: 'led-9', report }],
    });
    const st = useCircuitStore.getState();
    expect(st.simBusy).toBe(false);
    expect(st.running).toBe(false);
    expect(st.autopsy?.instanceId).toBe('led-9');
  });

  it('setRunning(false) memadamkan tanpa menunggu snapshot', () => {
    useCircuitStore.setState({ simBusy: true, running: true });
    useCircuitStore.getState().setRunning(false);
    expect(useCircuitStore.getState().simBusy).toBe(false);
  });

  it('clearAll memadamkan', () => {
    useCircuitStore.setState({ simBusy: true, running: true });
    useCircuitStore.getState().clearAll();
    expect(useCircuitStore.getState().simBusy).toBe(false);
  });
});

describe('K11 — interact saat running + applySnapshot tidak menimpa interactiveState', () => {
  it('tekan tombol saat running: interactiveState berubah; snapshot hanya mengganti simState', () => {
    const btn = makeInstance('btn-1');
    useCircuitStore.setState({ instances: [btn], running: true });
    const store = useCircuitStore.getState();

    store.interact('btn-1', { pressed: true });
    let st = useCircuitStore.getState();
    expect(st.instances[0].interactiveState.pressed).toBe(true);
    // interact tidak dicatat ke histori undo (kontrak Batch 6 dipertahankan).
    expect(st.past).toHaveLength(0);

    const result: ComponentSimResult = {
      pinVoltages: { A1: 0, B1: 0 },
      branchCurrents: {},
      isDamaged: false,
    };
    store.applySnapshot(makeSnapshot({ 'btn-1': result }));
    st = useCircuitStore.getState();
    expect(st.instances[0].interactiveState.pressed).toBe(true);
    expect(st.instances[0].simState.pinVoltages.A1).toBe(0);
    expect(st.instances[0].simState).not.toBe(EMPTY_SIM_RESULT);
  });
});
