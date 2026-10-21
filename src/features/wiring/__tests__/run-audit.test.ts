import { beforeAll, describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
  type ComponentSimResult,
} from '../../../shared/types';
import { initSim, type SimSnapshot } from '../../simulation/worker/bridge';
import { useCircuitStore } from '../store/circuitStore';

/**
 * Audit jalur Run (keluhan user: tekan Jalankan tapi rangkaian tidak jalan):
 * 1) Identitas objek instance di applySnapshot — snapshot dengan nilai sama
 *    TIDAK boleh mengganti referensi instance (memo React panggung 3D).
 * 2) Integrasi store penuh: loadDemo → setRunning(true) → blink hidup
 *    terlihat lewat store (pinStates D13 + arus LED), memakai SimSession
 *    lokal lewat fallback bridge (di node, Worker global tidak ada).
 * 3) Histori undo defensif: nilai tak-terklon di interactiveState tidak
 *    boleh menggagalkan aksi user.
 */

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return check();
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

function makeInstance(id: string): ComponentInstanceState {
  return {
    id,
    type: 'resistor',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState: {},
    simState: EMPTY_SIM_RESULT,
  };
}

describe('applySnapshot — identitas objek instance', () => {
  it('snapshot bernilai sama mempertahankan referensi; yang berubah saja dibuat baru', () => {
    useCircuitStore.setState({
      instances: [makeInstance('inst-a'), makeInstance('inst-b')],
      pinHoles: {},
      activeLessonId: null,
      lessonChecks: [],
    });
    const resultA: ComponentSimResult = {
      pinVoltages: { A: 5, B: 3 },
      branchCurrents: { main: 0.02 },
      isDamaged: false,
    };
    const resultB: ComponentSimResult = {
      pinVoltages: { A: 3.3, B: 0 },
      branchCurrents: { main: -0.01 },
      isDamaged: false,
    };
    const store = useCircuitStore.getState();

    store.applySnapshot(makeSnapshot({ 'inst-a': resultA, 'inst-b': resultB }));
    const firstArray = useCircuitStore.getState().instances;
    const firstA = firstArray[0];
    const firstB = firstArray[1];
    // Sanity: snapshot pertama memang menerapkan hasil (objek baru dari EMPTY).
    expect(firstA.simState.branchCurrents.main).toBe(0.02);

    // Snapshot kedua: objek hasil BARU dari solver, nilai PERSIS sama.
    store.applySnapshot(
      makeSnapshot({
        'inst-a': { ...resultA, pinVoltages: { ...resultA.pinVoltages }, branchCurrents: { ...resultA.branchCurrents } },
        'inst-b': { ...resultB, pinVoltages: { ...resultB.pinVoltages }, branchCurrents: { ...resultB.branchCurrents } },
      }),
    );
    const secondArray = useCircuitStore.getState().instances;
    expect(secondArray[0]).toBe(firstA);
    expect(secondArray[1]).toBe(firstB);
    expect(secondArray).toBe(firstArray);

    // Snapshot ketiga: hanya arus inst-a berubah → hanya dia yang baru.
    store.applySnapshot(
      makeSnapshot({
        'inst-a': { ...resultA, branchCurrents: { main: 0.025 } },
        'inst-b': { ...resultB, pinVoltages: { ...resultB.pinVoltages }, branchCurrents: { ...resultB.branchCurrents } },
      }),
    );
    const thirdArray = useCircuitStore.getState().instances;
    expect(thirdArray[0]).not.toBe(firstA);
    expect(thirdArray[0].simState.branchCurrents.main).toBe(0.025);
    expect(thirdArray[1]).toBe(firstB);
  });
});

describe('jalur Run lewat store (fallback sesi lokal)', () => {
  beforeAll(() => {
    initSim((snapshot) => useCircuitStore.getState().applySnapshot(snapshot));
  });

  it('loadDemo → setRunning(true): pin D13 berkedip dan arus LED mengikuti', async () => {
    const store = useCircuitStore.getState();
    store.loadDemo();
    // Sketch blink cepat agar tes tidak menunggu delay(1000) bawaan.
    store.setSketchCode(`void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(60);
  digitalWrite(13, LOW);
  delay(60);
}
`);
    store.setRunning(true);
    expect(useCircuitStore.getState().running).toBe(true);

    const ledCurrent = () => {
      const led = useCircuitStore
        .getState()
        .instances.find((i) => i.type === 'led-5mm');
      return led?.simState.branchCurrents['led'] ?? 0;
    };
    const d13High = () =>
      useCircuitStore.getState().pinStates['D13']?.high === true;

    expect(await waitFor(d13High, 4000)).toBe(true);
    expect(await waitFor(() => ledCurrent() > 0.005, 4000)).toBe(true);
    expect(await waitFor(() => !d13High(), 4000)).toBe(true);
    expect(await waitFor(() => ledCurrent() < 0.001, 4000)).toBe(true);
    expect(useCircuitStore.getState().sketchError).toBeNull();

    useCircuitStore.getState().setRunning(false);
  }, 20000);
});

describe('histori undo defensif terhadap nilai tak-terklon', () => {
  it('removeInstance tetap berhasil walau interactiveState berisi fungsi', () => {
    const bad = makeInstance('bad-1');
    bad.interactiveState = { fn: () => 1 };
    useCircuitStore.setState({
      instances: [bad],
      pinHoles: { 'bad-1': { A: 'hole-x', B: 'hole-y' } },
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
    expect(() => useCircuitStore.getState().removeInstance('bad-1')).not.toThrow();
    expect(
      useCircuitStore.getState().instances.find((i) => i.id === 'bad-1'),
    ).toBeUndefined();
  });

  it('undo tidak melempar walau state kini tidak bisa di-klon', () => {
    const good = makeInstance('good-1');
    useCircuitStore.setState({
      instances: [good],
      pinHoles: {},
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    });
    // Mutasi normal tercatat ke histori…
    useCircuitStore.getState().removeInstance('good-1');
    expect(useCircuitStore.getState().canUndo).toBe(true);
    // …lalu state kini diracuni nilai tak-terklon; undo harus tetap jalan.
    const poisoned = makeInstance('poison-1');
    poisoned.interactiveState = { fn: () => 2 };
    useCircuitStore.setState({ instances: [poisoned] });
    expect(() => useCircuitStore.getState().undo()).not.toThrow();
    expect(
      useCircuitStore.getState().instances.some((i) => i.id === 'good-1'),
    ).toBe(true);
    useCircuitStore.setState({ instances: [], pinHoles: {} });
  });
});

describe('kejujuran status saat sketch mati (perbaikan F-1)', () => {
  it('snapshot dengan sketchError + sketchRunning false mematikan status running UI', () => {
    useCircuitStore.setState({
      instances: [],
      pinHoles: {},
      activeLessonId: null,
      lessonChecks: [],
      running: true,
      sketchError: null,
    });
    const store = useCircuitStore.getState();
    store.applySnapshot({
      ...makeSnapshot({}),
      sketchError: 'Baris 3: Kurung kurawal tidak ditutup.',
      sketchRunning: false,
    });
    expect(useCircuitStore.getState().running).toBe(false);
    expect(useCircuitStore.getState().sketchError).toContain('Baris 3');

    // Tanpa error, status tidak disentuh walau sketch belum berjalan.
    useCircuitStore.setState({ running: true, sketchError: null });
    store.applySnapshot({ ...makeSnapshot({}), sketchRunning: false });
    expect(useCircuitStore.getState().running).toBe(true);
    useCircuitStore.setState({ running: false });
  });

  it('sketch rusak lewat jalur Run nyata: running berakhir false dan error terisi', async () => {
    // initSim idempoten (penjaga `initialized` di bridge) — aman
    // dipanggil lagi agar tes ini juga lulus saat difilter sendirian.
    initSim((snapshot) => useCircuitStore.getState().applySnapshot(snapshot));
    const store = useCircuitStore.getState();
    store.setSketchCode(`void setup() {
  pinMode(13, OUTPUT);
void loop() {
}
`);
    store.setRunning(true);
    // Catatan timing: di fallback sesi lokal, snapshot error tiba
    // SINKRON di dalam setRunning (store memasang running:true dulu,
    // lalu simStartSketch gagal transpile dan applySnapshot
    // membaliknya) — jadi yang diasersi adalah keadaan AKHIR, bukan
    // keadaan sesaat setelah panggilan.
    const settled = await waitFor(
      () =>
        useCircuitStore.getState().running === false &&
        useCircuitStore.getState().sketchError !== null,
      4000,
    );
    expect(settled).toBe(true);
    expect(useCircuitStore.getState().sketchError).toBeTruthy();
    useCircuitStore.getState().setRunning(false);
  }, 20000);
});
