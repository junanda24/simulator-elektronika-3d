import * as Comlink from 'comlink';
import type { ComponentInstanceState } from '../../../shared/types';
import type { WireConnection } from '../../wiring/netlist';
import { SimSession, type SimSnapshot } from './simSession';
import type { SimWorkerApi } from './sim.worker';

/**
 * Jembatan main thread ↔ sesi simulasi. Sesi berjalan di Web Worker
 * (comlink); bila Worker gagal dibuat, sesi yang sama dipakai langsung
 * di main thread — perilaku identik, hanya tanpa isolasi thread.
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
let initialized = false;

export function initSim(onSnapshot: (snapshot: SimSnapshot) => void): void {
  if (initialized) return;
  initialized = true;
  try {
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    remote = Comlink.wrap<SimWorkerApi>(worker);
    void remote.setSnapshotListener(Comlink.proxy(onSnapshot) as never);
  } catch {
    localSession = new SimSession();
    localSession.setSnapshotListener(onSnapshot);
  }
}

export function simSetCircuit(parts: CircuitParts): void {
  if (remote) void remote.setCircuit(parts as never);
  else localSession?.setCircuit(parts);
}

export function simSetPowered(on: boolean): void {
  if (remote) void remote.setPowered(on);
  else localSession?.setPowered(on);
}

export function simStartSketch(source: string): void {
  if (remote) void remote.startSketch(source);
  else localSession?.startSketch(source);
}

export function simStopSketch(): void {
  if (remote) void remote.stopSketch();
  else localSession?.stopSketch();
}

export function simClearBoardDamage(): void {
  if (remote) void remote.clearBoardDamage();
  else localSession?.clearBoardDamage();
}
