import * as Comlink from 'comlink';
import { SimSession } from './simSession';

/**
 * Entrypoint Web Worker simulasi. Semua logika hidup di SimSession
 * (simSession.ts) agar bisa dipakai juga sebagai fallback main-thread.
 */
const session = new SimSession();

const api = {
  setSnapshotListener: (listener: (snapshot: unknown) => void) => {
    session.setSnapshotListener(listener as never);
  },
  setCircuit: (parts: never) => session.setCircuit(parts),
  setPowered: (on: boolean) => session.setPowered(on),
  startSketch: (source: string) => session.startSketch(source),
  stopSketch: () => session.stopSketch(),
  clearBoardDamage: () => session.clearBoardDamage(),
  /**
   * Detak jantung untuk watchdog bridge: sekadar membuktikan event
   * loop worker masih berputar dan antrean pesan comlink masih
   * dilayani. Mengembalikan stempel waktu worker.
   */
  ping: () => Date.now(),
};

export type SimWorkerApi = typeof api;

Comlink.expose(api);
