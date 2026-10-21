import * as Comlink from 'comlink';
import type { ComponentInstanceState } from '../../../shared/types';
import type { WireConnection } from '../../wiring/netlist';
import { SimSession, type SimSnapshot } from './simSession';
import type { SimWorkerApi } from './sim.worker';

/**
 * Jembatan main thread ↔ sesi simulasi. Sesi berjalan di Web Worker
 * (comlink); bila Worker gagal dibuat, sesi yang sama dipakai langsung
 * di main thread — perilaku identik, hanya tanpa isolasi thread.
 *
 * Jalur diam yang ditutup (audit jalur Run): konstruksi `new Worker`
 * bisa SUKSES sementara script worker-nya gagal dimuat (bundle rusak,
 * browser lama) — tanpa penjagaan, semua panggilan comlink menggantung
 * selamanya dan tombol Jalankan terlihat mati total tanpa error apa pun.
 * Karena itu pendaftaran listener dibuktikan dengan round-trip: bila
 * tidak terjawab dalam batas waktu (atau worker memancarkan error),
 * bridge beralih ke sesi lokal dan MEMUTAR ULANG state terakhir
 * (rangkaian + daya + sketch) yang sempat terkirim ke worker.
 */

export type { SimSnapshot };

interface CircuitParts {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  boardId: string;
}

let remote: Comlink.Remote<SimWorkerApi> | null = null;
let localSession: SimSession | null = null;
let workerRef: Worker | null = null;
let initialized = false;

/** State terakhir yang dikirim UI — diputar ulang bila beralih ke lokal. */
let snapshotHandler: ((snapshot: SimSnapshot) => void) | null = null;
let lastParts: CircuitParts | null = null;
let lastPowered: boolean | null = null;
let lastSketch: string | null = null;

/** Aktifkan sesi lokal (fallback) dan putar ulang state terakhir. */
function useLocalSession(): void {
  if (localSession) return;
  remote = null;
  if (workerRef) {
    try {
      workerRef.terminate();
    } catch {
      /* worker sudah mati; abaikan */
    }
    workerRef = null;
  }
  localSession = new SimSession();
  if (snapshotHandler) localSession.setSnapshotListener(snapshotHandler);
  if (lastParts) localSession.setCircuit(lastParts);
  if (lastPowered !== null) localSession.setPowered(lastPowered);
  if (lastSketch !== null) localSession.startSketch(lastSketch);
}

export function initSim(onSnapshot: (snapshot: SimSnapshot) => void): void {
  if (initialized) return;
  initialized = true;
  snapshotHandler = onSnapshot;
  try {
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef = worker;
    remote = Comlink.wrap<SimWorkerApi>(worker);
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return;
      fellBack = true;
      useLocalSession();
    };
    worker.addEventListener('error', fallback);
    // Bukti round-trip: promise ini hanya selesai bila modul worker
    // benar-benar termuat dan method-nya ada. Timeout = worker mati diam.
    void Promise.race([
      Promise.resolve(
        remote.setSnapshotListener(Comlink.proxy(onSnapshot) as never),
      ).then(() => 'ok' as const),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 2000),
      ),
    ]).then((outcome) => {
      if (outcome !== 'ok') fallback();
    });
  } catch {
    useLocalSession();
  }
}

export function simSetCircuit(parts: CircuitParts): void {
  lastParts = parts;
  if (remote) void remote.setCircuit(parts as never);
  else localSession?.setCircuit(parts);
}

export function simSetPowered(on: boolean): void {
  lastPowered = on;
  if (remote) void remote.setPowered(on);
  else localSession?.setPowered(on);
}

export function simStartSketch(source: string): void {
  lastSketch = source;
  if (remote) void remote.startSketch(source);
  else localSession?.startSketch(source);
}

export function simStopSketch(): void {
  lastSketch = null;
  if (remote) void remote.stopSketch();
  else localSession?.stopSketch();
}

export function simClearBoardDamage(): void {
  if (remote) void remote.clearBoardDamage();
  else localSession?.clearBoardDamage();
}
