import type {
  CircuitSolution,
  ComponentInstanceState,
  ComponentSimResult,
  DamageReport,
  PinState,
} from '../../../shared/types';
import {
  getBoardDefinition,
  type BoardDefinition,
} from '../../../shared/boards/definitions';
import { buildNetlist, type WireConnection } from '../../wiring/netlist';
import { solveCircuit } from '../solver/engine';
import { electricalOf } from '../../../shared/components/electricalRegistry';
import {
  evaluatePinOvercurrent,
  evaluatePinOvervoltage,
  shortCircuitDamageReport,
} from '../damage/boardRules';
import { transpileSketch } from '../../sketch/transpiler';
import { startSketchProgram, type SketchControl } from '../../sketch/runtime';

/**
 * Sesi simulasi — satu-satunya pemilik kebenaran elektrik di worker:
 * menerima rangkaian dari UI, menjalankan sketch (runtime), me-solve
 * sinkron setiap state pin berubah, menilai aturan kerusakan board,
 * dan mengirim snapshot berkala ke main thread.
 *
 * Model daya: powered=false berarti board dicabut (semua sumber padam,
 * tidak ada kerusakan baru). powered=true: rel hidup + sketch berjalan.
 */

export interface SimSnapshot {
  voltages: Record<string, number>;
  results: Record<string, ComponentSimResult>;
  /** Kerusakan komponen BARU pada snapshot ini saja. */
  damageEvents: Array<{ instanceId: string; report: DamageReport }>;
  /** Kerusakan board BARU pada snapshot ini saja (pinId null = korsleting rel). */
  boardEvents: Array<{ pinId: string | null; report: DamageReport }>;
  pinStates: Record<string, PinState>;
  deadPins: string[];
  boardFault: boolean;
  serialChunk: string;
  sketchError: string | null;
  sketchRunning: boolean;
}

interface CircuitParts {
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  boardId: string;
}

export class SimSession {
  private parts: CircuitParts = { instances: [], pinHoles: {}, wires: [], boardId: 'uno' };
  private board: BoardDefinition = getBoardDefinition('uno');
  private get profile() {
    return this.board.profile;
  }
  private powered = false;
  private runtime: SketchControl | null = null;
  private readonly deadPins = new Set<string>();
  private boardFault = false;
  private lastSolution: CircuitSolution | null = null;
  private netOfBoardPin: (pinId: string) => string = () => '';
  private serialBuffer = '';
  private serialDirty = false;
  private sketchError: string | null = null;
  private pendingDamage: SimSnapshot['damageEvents'] = [];
  private pendingBoard: SimSnapshot['boardEvents'] = [];
  private listener: ((snapshot: SimSnapshot) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;

  setSnapshotListener(listener: (snapshot: SimSnapshot) => void): void {
    this.listener = listener;
  }

  setCircuit(parts: CircuitParts): void {
    if (parts.boardId !== this.parts.boardId) {
      // Ganti board = board baru: kerusakan board lama tidak terbawa.
      this.deadPins.clear();
      this.boardFault = false;
      this.stopRuntime();
    }
    this.parts = parts;
    this.board = getBoardDefinition(parts.boardId);
    this.solveAndEmit();
  }

  setPowered(on: boolean): void {
    this.powered = on;
    if (!on) this.stopRuntime();
    this.solveAndEmit();
  }

  startSketch(source: string): void {
    this.stopRuntime();
    this.powered = true;
    const { code, error } = transpileSketch(source);
    if (error || !code) {
      this.sketchError = error ?? 'Transpilasi sketch gagal.';
      this.solveAndEmit();
      return;
    }
    this.sketchError = null;
    this.runtime = startSketchProgram(
      code,
      {
        onPinStatesChanged: () => this.solveAndEmit(),
        pinVolts: (pinId) =>
          this.lastSolution?.voltages.get(this.netOfBoardPin(pinId)) ?? 0,
        onSerial: (text) => {
          this.serialBuffer += text;
          this.serialDirty = true;
        },
        isPinDead: (pinId) => this.deadPins.has(pinId) || this.boardFault,
        onError: (message) => {
          this.sketchError = message;
          this.emit();
        },
      },
      this.profile,
    );
    this.ensureTimer();
    this.solveAndEmit();
  }

  stopSketch(): void {
    this.stopRuntime();
    this.solveAndEmit();
  }

  /** Board diganti: pin mati & fault korsleting bersih kembali. */
  clearBoardDamage(): void {
    this.deadPins.clear();
    this.boardFault = false;
    this.solveAndEmit();
  }

  private stopRuntime(): void {
    this.runtime?.stop();
    this.runtime = null;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTickAt;
      this.lastTickAt = now;
      if (this.runtime && !this.runtime.isStopped()) {
        this.runtime.advance(delta);
      }
      if (this.serialDirty) this.emit();
    }, 16);
  }

  /** State pin yang benar-benar di-stamp: tanpa pin mati & tanpa board fault. */
  private livePinStates(): Record<string, PinState> {
    if (!this.runtime || this.boardFault) return {};
    const all = this.runtime.getPinStates();
    const live: Record<string, PinState> = {};
    for (const [pinId, state] of Object.entries(all)) {
      if (!this.deadPins.has(pinId)) live[pinId] = state;
    }
    return live;
  }

  private solveAndEmit(): void {
    const pinStates = this.livePinStates();
    const netlist = buildNetlist(
      this.parts.instances,
      this.parts.pinHoles,
      this.parts.wires,
      pinStates,
      this.board,
    );
    this.netOfBoardPin = netlist.netOfBoardPin;

    let solution = solveCircuit(
      this.powered && !this.boardFault ? netlist.input : { ...netlist.input, sources: [] },
      electricalOf,
    );

    if (this.powered && !this.boardFault && netlist.shortCircuit) {
      this.boardFault = true;
      this.pendingBoard.push({
        pinId: null,
        report: shortCircuitDamageReport(netlist.shortCircuit.volts),
      });
      solution = solveCircuit({ ...netlist.input, sources: [] }, electricalOf);
    }

    if (this.powered && !this.boardFault) {
      const signalPinIds = this.board.pins
        .filter((pin) => pin.kind === 'digital' || pin.kind === 'analog')
        .map((pin) => pin.id);
      const ovEvents = evaluatePinOvervoltage({
        pinIds: signalPinIds,
        voltages: solution.voltages,
        netOfBoardPin: netlist.netOfBoardPin,
        profile: this.profile,
        deadPins: this.deadPins,
      });
      for (const event of ovEvents) {
        this.deadPins.add(event.pinId);
        this.pendingBoard.push({ pinId: event.pinId, report: event.report });
      }
    }

    if (this.powered && !this.boardFault) {
      const events = evaluatePinOvercurrent({
        pinStates,
        voltages: solution.voltages,
        netOfBoardPin: netlist.netOfBoardPin,
        profile: this.profile,
        deadPins: this.deadPins,
      });
      if (events.length > 0) {
        for (const event of events) {
          this.deadPins.add(event.pinId);
          this.pendingBoard.push({ pinId: event.pinId, report: event.report });
        }
        // Pin yang baru mati mengubah rangkaian: hitung ulang agar snapshot konsisten.
        const rebuilt = buildNetlist(
          this.parts.instances,
          this.parts.pinHoles,
          this.parts.wires,
          this.livePinStates(),
          this.board,
        );
        this.netOfBoardPin = rebuilt.netOfBoardPin;
        solution = solveCircuit(rebuilt.input, electricalOf);
      }
    }

    for (const event of solution.damageEvents) this.pendingDamage.push(event);
    this.lastSolution = solution;
    this.emit();
  }

  private emit(): void {
    if (!this.listener) return;
    const voltages: Record<string, number> = {};
    if (this.lastSolution) {
      for (const [net, volts] of this.lastSolution.voltages) voltages[net] = volts;
    }
    const results: Record<string, ComponentSimResult> = {};
    if (this.lastSolution) {
      for (const [id, result] of this.lastSolution.results) results[id] = result;
    }
    const snapshot: SimSnapshot = {
      voltages,
      results,
      damageEvents: this.pendingDamage,
      boardEvents: this.pendingBoard,
      pinStates: this.livePinStates(),
      deadPins: [...this.deadPins],
      boardFault: this.boardFault,
      serialChunk: this.serialBuffer,
      sketchError: this.sketchError,
      sketchRunning: this.runtime !== null && !this.runtime.isStopped(),
    };
    this.pendingDamage = [];
    this.pendingBoard = [];
    this.serialBuffer = '';
    this.serialDirty = false;
    this.listener(snapshot);
  }
}
