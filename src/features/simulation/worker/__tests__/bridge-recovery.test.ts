import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as Comlink from 'comlink';
import {
  __resetBridgeForTests,
  __setSimWorkerFactoryForTests,
  __setWatchdogTimingForTests,
  getSimRecoveryLog,
  initSim,
  simDiagnosticsPing,
  simSetCircuit,
  simSetPowered,
  simStartSketch,
  type SimSnapshot,
} from '../bridge';
import { SimSession } from '../simSession';
import { computePlacement } from '../../../wiring/placement';
import {
  railHoleId,
  terminalHoleId,
} from '../../../../shared/boards/breadboard';
import type { WireConnection } from '../../../wiring/netlist';
import { DEFAULT_SKETCH } from '../../../sketch/defaultSketch';

/**
 * Self-healing bridge (2026-10-21): worker yang mati/beku DI TENGAH
 * sesi harus disembuhkan — worker baru + putar-ulang state, atau sesi
 * lokal sebagai jalur terakhir — dan pemulihannya tercatat + tertera
 * sebagai notice one-shot di snapshot.
 *
 * Worker palsu: SimSession sungguhan yang diekspos comlink di atas
 * MessageChannel Node (terbukti setara untuk kebutuhan bridge:
 * postMessage/addEventListener/proxy callback). Kontrol tes dapat
 * membekukan ping (watchdog), memicu event error, dan menggagalkan
 * pembuatan worker berikutnya (uji jalur fallback lokal).
 */

interface FakeControl {
  /** true → ping worker tidak pernah menjawab (worker beku). */
  frozen: boolean;
  /** true → pabrik melempar saat membuat worker berikutnya. */
  failNextSpawn: boolean;
  /** Worker terakhir yang dibuat (untuk triggerError). */
  current: { triggerError: () => void } | null;
}

function makeFakeWorkerFactory(control: FakeControl): () => Worker {
  return () => {
    if (control.failNextSpawn) {
      control.failNextSpawn = false;
      throw new Error('spawn gagal (disimulasikan tes)');
    }
    const session = new SimSession();
    const api = {
      setSnapshotListener: (listener: (snap: SimSnapshot) => void) => {
        session.setSnapshotListener(listener);
      },
      setCircuit: (parts: never) => session.setCircuit(parts),
      setPowered: (on: boolean) => session.setPowered(on),
      startSketch: (source: string) => session.startSketch(source),
      stopSketch: () => session.stopSketch(),
      clearBoardDamage: () => session.clearBoardDamage(),
      ping: () =>
        control.frozen
          ? new Promise<number>(() => undefined)
          : Date.now(),
    };
    const { port1, port2 } = new MessageChannel();
    Comlink.expose(api, port1);
    const errorCallbacks: Array<() => void> = [];
    const handle = { triggerError: () => errorCallbacks.forEach((cb) => cb()) };
    control.current = handle;
    const fake = {
      postMessage: (...args: unknown[]) =>
        (port2.postMessage as (...a: unknown[]) => void)(...args),
      addEventListener: (type: string, cb: () => void) => {
        if (type === 'error') {
          errorCallbacks.push(cb);
          return;
        }
        port2.addEventListener(type as 'message', cb as EventListener);
      },
      removeEventListener: (type: string, cb: () => void) => {
        port2.removeEventListener(type as 'message', cb as EventListener);
      },
      start: () => port2.start(),
      terminate: () => {
        session.stopSketch();
        port1.close();
        port2.close();
      },
    };
    return fake as unknown as Worker;
  };
}

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `rw-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

function blinkParts() {
  const resistor = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
  const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
  if (!resistor || !led) throw new Error('placement demo gagal');
  const instances = [
    { ...resistor.instance, props: { resistance: 220 } },
    { ...led.instance, props: { color: 'red' } },
  ];
  const pinHoles = {
    [resistor.instance.id]: resistor.pinHoles,
    [led.instance.id]: led.pinHoles,
  };
  const wires: WireConnection[] = [
    wire(board('D13'), hole(resistor.pinHoles.A)),
    wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
    wire(hole(railHoleId('R-', 4)), board('GND#1')),
  ];
  return { instances, pinHoles, wires, boardId: 'uno', ledId: led.instance.id };
}

async function waitFor(check: () => boolean, timeoutMs = 8000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return check();
}

describe('bridge self-healing — pemulihan worker di tengah sesi', () => {
  let control: FakeControl;
  let snapshots: SimSnapshot[];

  beforeEach(() => {
    __resetBridgeForTests();
    control = { frozen: false, failNextSpawn: false, current: null };
    snapshots = [];
    __setSimWorkerFactoryForTests(makeFakeWorkerFactory(control));
    // Irama watchdog dipercepat: ping 50 ms, vonis beku > 400 ms.
    __setWatchdogTimingForTests(50, 400);
    initSim((snap) => snapshots.push(snap));
  });

  afterEach(() => {
    __resetBridgeForTests();
  });

  const last = () => snapshots[snapshots.length - 1];

  async function startBlinkSession() {
    const parts = blinkParts();
    simSetCircuit(parts);
    simSetPowered(true);
    simStartSketch(DEFAULT_SKETCH);
    const running = await waitFor(() => last()?.sketchRunning === true);
    expect(running).toBe(true);
    return parts;
  }

  it('worker sehat: ping diagnostik menjawab mode worker', async () => {
    const ping = await simDiagnosticsPing();
    expect(ping?.mode).toBe('worker');
  });

  it('event error di tengah sesi: worker BARU dibuat, state diputar ulang, notice tampil', async () => {
    const parts = await startBlinkSession();
    control.current?.triggerError();

    const recovered = await waitFor(
      () =>
        getSimRecoveryLog().some(
          (e) => e.reason === 'worker-error' && e.outcome === 'worker-restart',
        ),
    );
    expect(recovered).toBe(true);

    // Sketch ikut diputar ulang (restartSketch=true): sesi berjalan lagi
    // dan snapshot membawa notice pemulihan satu kali.
    const noticed = await waitFor(() =>
      snapshots.some(
        (s) => s.notice?.includes('dimulai ulang otomatis') ?? false,
      ),
    );
    expect(noticed).toBe(true);
    const ledFlowsAgain = await waitFor(
      () =>
        last()?.sketchRunning === true &&
        snapshots.some(
          (s) => (s.results[parts.ledId]?.branchCurrents['led'] ?? 0) > 0.005,
        ),
    );
    expect(ledFlowsAgain).toBe(true);
  }, 20000);

  it('worker beku (ping menggantung): watchdog memvonis, sketch TIDAK dijalankan ulang', async () => {
    await startBlinkSession();
    control.frozen = true;

    const recovered = await waitFor(
      () =>
        getSimRecoveryLog().some(
          (e) => e.reason === 'watchdog' && e.outcome === 'worker-restart',
        ),
    );
    expect(recovered).toBe(true);
    // Worker pengganti harus bisa menjawab ping lagi.
    control.frozen = false;

    const noticed = await waitFor(() =>
      snapshots.some((s) => s.notice?.includes('tidak merespons') ?? false),
    );
    expect(noticed).toBe(true);

    // Sesi kembali ke keadaan berhenti (sketch beku tidak dihidupkan
    // lagi) — dan tetap bisa dijalankan ulang secara sadar.
    const stopped = await waitFor(
      () => last()?.sketchRunning === false,
    );
    expect(stopped).toBe(true);
    simStartSketch(DEFAULT_SKETCH);
    const runningAgain = await waitFor(() => last()?.sketchRunning === true);
    expect(runningAgain).toBe(true);
  }, 20000);

  it('worker baru pun gagal dibuat: jatuh ke sesi lokal dan tetap berjalan', async () => {
    const parts = await startBlinkSession();
    control.failNextSpawn = true;
    control.current?.triggerError();

    const recovered = await waitFor(() =>
      getSimRecoveryLog().some((e) => e.outcome === 'local-fallback'),
    );
    expect(recovered).toBe(true);

    const noticed = await waitFor(() =>
      snapshots.some(
        (s) => s.notice?.includes('dimulai ulang otomatis') ?? false,
      ),
    );
    expect(noticed).toBe(true);
    // Sesi lokal memutar ulang sketch: LED berkedip lagi.
    const ledFlows = await waitFor(() =>
      snapshots.some(
        (s) => (s.results[parts.ledId]?.branchCurrents['led'] ?? 0) > 0.005,
      ),
    );
    expect(ledFlows).toBe(true);
    const ping = await simDiagnosticsPing();
    expect(ping?.mode).toBe('local');
  }, 20000);
});
