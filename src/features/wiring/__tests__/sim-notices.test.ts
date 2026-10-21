import { beforeEach, describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type DamageReport,
} from '../../../shared/types';
import type { SimSnapshot } from '../../simulation/worker/bridge';
import {
  handleSimRecoveryForStore,
  useCircuitStore,
} from '../store/circuitStore';

/**
 * Pengait UI self-healing (SH-3): snapshot sesi kini membawa `notice`
 * (one-shot) dan `solverError` (persisten) dari SH-2, dan bridge
 * memulihkan worker otomatis — ketiganya harus SAMPAI ke pengguna:
 * 1) notice antri sekali di store (anti dobel berturut-turut) dan
 *    dirender App sebagai pill pemberitahuan;
 * 2) solverError tersimpan selama solver gagal, bersih saat sehat;
 * 3) pemulihan watchdog (sesi ditinggal berhenti, sketch tidak
 *    diputar ulang) mematikan flag running di store — lewat saluran
 *    pemulihan bridge, BUKAN cermin buta sketchRunning (kontrak F-1:
 *    snapshot sketchRunning=false tanpa error tidak menyentuh status,
 *    karena snapshot seperti itu juga tiba tepat setelah Jalankan
 *    ditekan dan selama putar-ulang pemulihan restart).
 */

function makeSnapshot(overrides: Partial<SimSnapshot> = {}): SimSnapshot {
  return {
    voltages: {},
    results: {},
    damageEvents: [],
    boardEvents: [],
    pinStates: {},
    deadPins: [],
    boardFault: false,
    serialChunk: '',
    sketchError: null,
    sketchRunning: false,
    currentLine: null,
    solverError: null,
    notice: null,
    ...overrides,
  };
}

function makeInstance(id: string): ComponentInstanceState {
  return {
    id,
    type: 'led-5mm',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState: {},
    simState: EMPTY_SIM_RESULT,
  };
}

beforeEach(() => {
  useCircuitStore.setState({
    instances: [],
    pinHoles: {},
    wires: [],
    running: false,
    simBusy: false,
    sketchError: null,
    currentLine: null,
    solverError: null,
    simNotices: [],
    lastNoticeText: null,
    autopsy: null,
    activeLessonId: null,
    lessonChecks: [],
  });
});

describe('notice one-shot dari snapshot', () => {
  it('snapshot ber-notice mengantrikan tepat satu pemberitahuan; snapshot polos sesudahnya tidak menghapus antrian', () => {
    const store = useCircuitStore.getState();
    store.applySnapshot(makeSnapshot({ notice: 'Solver pulih.' }));
    let st = useCircuitStore.getState();
    expect(st.simNotices).toHaveLength(1);
    expect(st.simNotices[0].text).toBe('Solver pulih.');
    expect(st.lastNoticeText).toBe('Solver pulih.');

    store.applySnapshot(makeSnapshot({ notice: null }));
    st = useCircuitStore.getState();
    expect(st.simNotices).toHaveLength(1);
    expect(st.lastNoticeText).toBeNull();
  });

  it('teks yang sama pada snapshot berturut-turut tidak dobel; setelah jeda tanpa notice, teks yang sama tampil lagi', () => {
    const store = useCircuitStore.getState();
    store.applySnapshot(makeSnapshot({ notice: 'Mesin dimulai ulang.' }));
    store.applySnapshot(makeSnapshot({ notice: 'Mesin dimulai ulang.' }));
    expect(useCircuitStore.getState().simNotices).toHaveLength(1);

    store.applySnapshot(makeSnapshot({ notice: null }));
    store.applySnapshot(makeSnapshot({ notice: 'Mesin dimulai ulang.' }));
    const st = useCircuitStore.getState();
    expect(st.simNotices).toHaveLength(2);
    expect(st.simNotices[0].id).not.toBe(st.simNotices[1].id);
  });

  it('notice berbeda langsung mengantri sebagai pemberitahuan baru', () => {
    const store = useCircuitStore.getState();
    store.applySnapshot(makeSnapshot({ notice: 'Pemberitahuan A' }));
    store.applySnapshot(makeSnapshot({ notice: 'Pemberitahuan B' }));
    const st = useCircuitStore.getState();
    expect(st.simNotices.map((n) => n.text)).toEqual([
      'Pemberitahuan A',
      'Pemberitahuan B',
    ]);
  });

  it('antrian dibatasi — yang terlama dibuang lebih dulu', () => {
    const store = useCircuitStore.getState();
    for (let i = 1; i <= 7; i += 1) {
      store.applySnapshot(makeSnapshot({ notice: `Notice ${i}` }));
    }
    const st = useCircuitStore.getState();
    expect(st.simNotices).toHaveLength(5);
    expect(st.simNotices[0].text).toBe('Notice 3');
    expect(st.simNotices[4].text).toBe('Notice 7');
  });

  it('dismissSimNotice membuang hanya pemberitahuan yang dimaksud', () => {
    const store = useCircuitStore.getState();
    store.applySnapshot(makeSnapshot({ notice: 'Satu' }));
    store.applySnapshot(makeSnapshot({ notice: 'Dua' }));
    const [first, second] = useCircuitStore.getState().simNotices;
    store.dismissSimNotice(first.id);
    const st = useCircuitStore.getState();
    expect(st.simNotices).toEqual([second]);
  });
});

describe('solverError dari snapshot', () => {
  it('tersimpan selama solver gagal dan bersih sendiri saat snapshot sehat', () => {
    const store = useCircuitStore.getState();
    store.applySnapshot(
      makeSnapshot({ solverError: 'Solver tidak konvergen untuk rangkaian ini.' }),
    );
    expect(useCircuitStore.getState().solverError).toContain('tidak konvergen');

    store.applySnapshot(
      makeSnapshot({ solverError: 'Solver tidak konvergen untuk rangkaian ini.' }),
    );
    expect(useCircuitStore.getState().solverError).toContain('tidak konvergen');

    store.applySnapshot(makeSnapshot({ solverError: null }));
    expect(useCircuitStore.getState().solverError).toBeNull();
  });

  it('jalur kerusakan pun membawa notice + solverError ke store', () => {
    const report: DamageReport = {
      ruleId: 'LED_OVERCURRENT',
      titleId: 'LED Terbakar',
      explanationId: 'Arus melebihi batas.',
      measured: 0.12,
      limit: 0.03,
      unit: 'A',
    };
    useCircuitStore.setState({ instances: [makeInstance('led-1')] });
    const store = useCircuitStore.getState();
    store.applySnapshot(
      makeSnapshot({
        damageEvents: [{ instanceId: 'led-1', report }],
        notice: 'Solver gagal menghitung rangkaian ini.',
        solverError: 'Solver tidak konvergen.',
      }),
    );
    const st = useCircuitStore.getState();
    expect(st.autopsy?.instanceId).toBe('led-1');
    expect(st.simNotices.map((n) => n.text)).toEqual([
      'Solver gagal menghitung rangkaian ini.',
    ]);
    expect(st.solverError).toBe('Solver tidak konvergen.');
  });
});

describe('sinkron status jalan (pemulihan watchdog)', () => {
  it('peristiwa watchdog mematikan running + sorot baris; pemulihan restart tidak menyentuh status', () => {
    useCircuitStore.setState({ running: true, currentLine: 7 });
    handleSimRecoveryForStore({
      at: 1,
      reason: 'watchdog',
      outcome: 'worker-restart',
    });
    let st = useCircuitStore.getState();
    expect(st.running).toBe(false);
    expect(st.currentLine).toBeNull();

    // Pemulihan yang memutar ulang sketch: sesi tetap berjalan,
    // status jalan di store tidak boleh dipadamkan.
    useCircuitStore.setState({ running: true, currentLine: 3 });
    handleSimRecoveryForStore({
      at: 2,
      reason: 'worker-error',
      outcome: 'worker-restart',
    });
    handleSimRecoveryForStore({
      at: 3,
      reason: 'ping-gagal',
      outcome: 'local-fallback',
    });
    st = useCircuitStore.getState();
    expect(st.running).toBe(true);
    expect(st.currentLine).toBe(3);
  });

  it('snapshot sketchRunning=false (bahkan yang ber-notice restart) tidak mematikan running — kontrak F-1 tetap', () => {
    useCircuitStore.setState({ running: true });
    const store = useCircuitStore.getState();
    // Transien putar-ulang pemulihan restart: snapshot setCircuit
    // mendahului startSketch, sketchRunning masih false, notice
    // restart ikut terbawa — status jalan TIDAK boleh padam, tapi
    // notice-nya tetap harus sampai ke pengguna.
    store.applySnapshot(
      makeSnapshot({
        sketchRunning: false,
        notice: 'Mesin simulasi dimulai ulang otomatis — rangkaianmu utuh.',
      }),
    );
    const st = useCircuitStore.getState();
    expect(st.running).toBe(true);
    expect(st.simNotices).toHaveLength(1);
  });
});
