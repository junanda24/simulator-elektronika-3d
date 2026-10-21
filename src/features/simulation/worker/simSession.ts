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
import {
  CYCLE_MIN_US,
  ECHO_DELAY_US,
  TRIG_MIN_US,
  US_PER_CM,
  VCC_MIN_V,
  distanceCmOf,
  noObstacleOf,
} from '../../../shared/components/catalog/hc-sr04/electrical';

/** Ambang HIGH masukan TRIG (V) — masukan TTL modul: HIGH ≥ 2,0 V. */
const TRIG_TTL_HIGH_V = 2.0;

/** Jendela pulsa ECHO terjadwal (µs jam logis sketch). */
interface EchoWindow {
  startUs: number;
  endUs: number;
}

/**
 * Keadaan model perangkat HC-SR04 per instance (hidup di sesi, bukan
 * solver — bab riset §11.3/§11.4): tepi TRIG terakhir, waktu pemicu sah
 * terakhir, dan jadwal jendela ECHO yang belum lewat.
 */
interface HcSr04DeviceState {
  prevTrigHigh: boolean;
  trigRiseUs: number | null;
  lastTriggerUs: number | null;
  windows: EchoWindow[];
}

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
  /** Baris sketch (1-based) yang sedang dieksekusi; null bila sketch berhenti/error. */
  currentLine: number | null;
  /**
   * Self-healing solver: pesan kegagalan solve yang masih berlaku
   * (semua tangga pemulihan engine gagal; tegangan snapshot adalah
   * solusi jujur serba-0). null = solver sehat.
   */
  solverError: string | null;
  /**
   * Pemberitahuan satu-kali (one-shot): terisi pada snapshot pertama
   * setelah peristiwa pemulihan (solver gagal / solver pulih), lalu
   * kembali null pada snapshot berikutnya. Bridge juga memakai kolom
   * ini untuk menyuntikkan pemberitahuan pemulihan worker-nya.
   */
  notice: string | null;
}

/** Pesan pemberitahuan saat solver mulai gagal total (transisi sehat→gagal). */
const SOLVER_FAILED_NOTICE =
  'Solver gagal menghitung rangkaian ini setelah semua pemulihan dicoba — ' +
  'tegangan ditampilkan 0 V agar tidak menyesatkan. Periksa kembali rangkaianmu.';
/** Pesan pemberitahuan saat solver pulih (transisi gagal→sehat). */
const SOLVER_RECOVERED_NOTICE =
  'Solver pulih — perhitungan rangkaian kembali normal.';

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
  private currentLine: number | null = null;
  /** Kegagalan solver yang sedang berlaku (dari CircuitSolution.solveError). */
  private solverError: string | null = null;
  /** Pemberitahuan one-shot menunggu snapshot berikutnya. */
  private pendingNotice: string | null = null;
  private pendingDamage: SimSnapshot['damageEvents'] = [];
  private pendingBoard: SimSnapshot['boardEvents'] = [];
  private listener: ((snapshot: SimSnapshot) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt = 0;
  /** Model perangkat HC-SR04 per instance id (jadwal ECHO analitik). */
  private readonly hcDevices = new Map<string, HcSr04DeviceState>();
  /** pinNets dari netlist terakhir (`${instanceId}:${pinId}` → net). */
  private lastPinNets: Record<string, string> = {};
  /** Jam dinding virtual sesi (µs) — diakumulasi dari advance() per tick. */
  private wallUs = 0;
  /** Stempel logis µs terakhir yang dilaporkan runtime (penulisan pin). */
  private lastStampUs = 0;

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
        onPinStatesChanged: (nowUs) => {
          if (nowUs > this.lastStampUs) this.lastStampUs = nowUs;
          this.solveAndEmit(nowUs);
        },
        pulseIn: (pinId, level, timeoutUs, nowUs) =>
          this.measurePulseIn(pinId, level, timeoutUs, nowUs),
        pinVolts: (pinId) =>
          this.lastSolution?.voltages.get(this.netOfBoardPin(pinId)) ?? 0,
        onSerial: (text) => {
          this.serialBuffer += text;
          this.serialDirty = true;
        },
        isPinDead: (pinId) => this.deadPins.has(pinId) || this.boardFault,
        onLine: (line) => {
          // Callback __line terpanggil di setiap batas pernyataan —
          // sentuh state hanya bila barisnya benar-benar berpindah.
          if (line !== this.currentLine) this.currentLine = line;
        },
        onError: (message) => {
          this.sketchError = message;
          this.currentLine = null;
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
    this.currentLine = null;
    // Jadwal perangkat waktu tidak boleh menggantung melewati Berhenti/
    // reset: jendela ECHO & jam virtual mulai dari nol lagi.
    this.hcDevices.clear();
    this.wallUs = 0;
    this.lastStampUs = 0;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Komponen yang perilakunya layak di-solve ulang tiap tick (K10). */
  private hasDynamicComponents(): boolean {
    return this.parts.instances.some(
      (i) =>
        i.type === 'capacitor' ||
        i.type === 'dc-motor' ||
        i.type === 'servo' ||
        i.type === 'hc-sr04',
    );
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTickAt;
      this.lastTickAt = now;
      this.wallUs += delta * 1000;
      if (this.runtime && !this.runtime.isStopped()) {
        this.runtime.advance(delta);
      }
      // Audit K10: selama runtime diam di dalam delay(), tidak ada
      // perubahan pin dan tidak ada serial — tanpa cabang ini solver
      // tidak pernah berjalan lagi sampai delay berakhir, sehingga
      // komponen dinamis membeku. Perubahan pin sudah menyelesaikan
      // dirinya secara sinkron lewat onPinStatesChanged; di sini kita
      // menyelesaikan ulang maksimal 1× per tick (16 ms) HANYA bila
      // rangkaian berdaya dan memuat komponen dinamis — rangkaian
      // statis tidak dibanjiri snapshot.
      if (this.powered && !this.boardFault && this.hasDynamicComponents()) {
        this.solveAndEmit();
      } else if (this.serialDirty) {
        this.emit();
      }
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

  /**
   * Salinan instances dengan flag echoOn HC-SR04 dipasang dari jadwal
   * sesi pada waktu `nowUs` — instance asli di parts TIDAK dimutasi
   * (interactiveState milik UI: distanceCm/noObstacle; echoOn murni
   * milik sesi). Tanpa perubahan, array asli dikembalikan apa adanya.
   */
  private instancesWithEchoOverlay(nowUs: number): ComponentInstanceState[] {
    let changed = false;
    const out = this.parts.instances.map((inst) => {
      if (inst.type !== 'hc-sr04') return inst;
      const device = this.hcDevices.get(inst.id);
      const on = device
        ? device.windows.some((w) => nowUs >= w.startUs && nowUs < w.endUs)
        : false;
      if ((inst.interactiveState.echoOn === true) === on) return inst;
      changed = true;
      return { ...inst, interactiveState: { ...inst.interactiveState, echoOn: on } };
    });
    return changed ? out : this.parts.instances;
  }

  /** Samakan peta perangkat HC-SR04 dengan instance yang ada sekarang. */
  private syncHcDevices(): void {
    const ids = new Set(
      this.parts.instances.filter((i) => i.type === 'hc-sr04').map((i) => i.id),
    );
    for (const id of [...this.hcDevices.keys()]) {
      if (!ids.has(id)) this.hcDevices.delete(id);
    }
    for (const id of ids) {
      if (!this.hcDevices.has(id)) {
        this.hcDevices.set(id, {
          prevTrigHigh: false,
          trigRiseUs: null,
          lastTriggerUs: null,
          windows: [],
        });
      }
    }
  }

  /**
   * Deteksi tepi TRIG dari tegangan solusi final (bab riset §11.4):
   * tepi turun setelah HIGH ≥10 µs (waktu dari stempel logis runtime)
   * + gerbang catu VCC ≥4,5 V + jeda siklus ≥60 ms = pemicu sah →
   * jadwalkan jendela ECHO: naik +250 µs, HIGH selama jarak × 58 µs
   * dari gizmo. Mode tanpa rintangan: tidak ada jendela sama sekali.
   */
  private detectTrigEdges(
    voltages: ReadonlyMap<string, number>,
    pinNets: Record<string, string>,
    nowUs: number,
  ): void {
    for (const inst of this.parts.instances) {
      if (inst.type !== 'hc-sr04') continue;
      const device = this.hcDevices.get(inst.id);
      if (!device) continue;
      const trigNet = pinNets[`${inst.id}:TRIG`];
      const trigVolts = trigNet ? (voltages.get(trigNet) ?? 0) : 0;
      const high = trigVolts >= TRIG_TTL_HIGH_V;
      if (high && !device.prevTrigHigh) {
        device.trigRiseUs = nowUs;
      } else if (!high && device.prevTrigHigh && device.trigRiseUs !== null) {
        const widthUs = nowUs - device.trigRiseUs;
        device.trigRiseUs = null;
        const vccNet = pinNets[`${inst.id}:VCC`];
        const vccVolts = vccNet ? (voltages.get(vccNet) ?? 0) : 0;
        const cycleOk =
          device.lastTriggerUs === null ||
          nowUs - device.lastTriggerUs >= CYCLE_MIN_US;
        if (
          widthUs >= TRIG_MIN_US &&
          cycleOk &&
          this.powered &&
          !this.boardFault &&
          vccVolts >= VCC_MIN_V
        ) {
          device.lastTriggerUs = nowUs;
          if (!noObstacleOf(inst)) {
            const echoWidthUs = Math.round(distanceCmOf(inst) * US_PER_CM);
            device.windows.push({
              startUs: nowUs + ECHO_DELAY_US,
              endUs: nowUs + ECHO_DELAY_US + echoWidthUs,
            });
          }
        }
      }
      device.prevTrigHigh = high;
      // Jendela lama dibuang: pulseIn yang sah tidak menoleh >2 detik
      // ke belakang (timeout bawaan Arduino maksimum pun 1 detik).
      if (device.windows.length > 0) {
        device.windows = device.windows.filter((w) => w.endUs >= nowUs - 2_000_000);
      }
    }
  }

  /**
   * pulseIn ANALITIK (hook runtime): semantik tiga fase Arduino
   * dihitung dari gabungan jadwal ECHO semua HC-SR04 yang berbagi net
   * dengan pin itu — tanpa polling, tanpa kuantisasi tick. Mengembal-
   * ikan null bila tak ada perangkat pada net pin itu (runtime lalu
   * memakai perilaku polos: tunggu timeout penuh, hasil 0).
   */
  private measurePulseIn(
    pinId: string,
    level: number,
    timeoutUs: number,
    nowUs: number,
  ): { widthUs: number; blockedUs: number } | null {
    if (this.boardFault || this.deadPins.has(pinId)) return null;
    const net = this.netOfBoardPin(pinId);
    if (!net) return null;
    const windows: EchoWindow[] = [];
    for (const inst of this.parts.instances) {
      if (inst.type !== 'hc-sr04') continue;
      if (this.lastPinNets[`${inst.id}:ECHO`] !== net) continue;
      const device = this.hcDevices.get(inst.id);
      if (device) windows.push(...device.windows);
    }
    if (windows.length === 0) return null;
    windows.sort((a, b) => a.startUs - b.startUs);

    const deadline = nowUs + timeoutUs;
    const fail = { widthUs: 0, blockedUs: timeoutUs };
    const highAt = (t: number) =>
      windows.some((w) => t >= w.startUs && t < w.endUs);
    const fallAt = (t: number) => {
      const w = windows.find((w2) => t >= w2.startUs && t < w2.endUs);
      return w ? w.endUs : Number.POSITIVE_INFINITY;
    };
    const nextRise = (t: number) => {
      let best = Number.POSITIVE_INFINITY;
      for (const w of windows) {
        if (w.startUs > t && w.startUs < best) best = w.startUs;
      }
      return best;
    };

    let cursor = nowUs;
    if (level === 1) {
      // Fase 1: pulsa HIGH sedang berjalan → tunggu selesai dulu.
      if (highAt(cursor)) {
        cursor = fallAt(cursor);
        if (cursor > deadline) return fail;
      }
      // Fase 2: tunggu pulsa HIGH berikutnya mulai.
      if (!highAt(cursor)) {
        const start = nextRise(cursor);
        if (!Number.isFinite(start) || start > deadline) return fail;
        cursor = start;
      }
      // Fase 3: ukur sampai turun.
      const end = fallAt(cursor);
      if (!Number.isFinite(end) || end > deadline) return fail;
      return { widthUs: end - cursor, blockedUs: end - nowUs };
    }
    // Level LOW: pulsa LOW adalah jeda antar jendela HIGH.
    if (!highAt(cursor)) {
      const endLow = nextRise(cursor);
      if (!Number.isFinite(endLow) || endLow > deadline) return fail;
      cursor = endLow;
    }
    if (highAt(cursor)) {
      cursor = fallAt(cursor);
      if (!Number.isFinite(cursor) || cursor > deadline) return fail;
    }
    const endLow = nextRise(cursor);
    if (!Number.isFinite(endLow) || endLow > deadline) return fail;
    return { widthUs: endLow - cursor, blockedUs: endLow - nowUs };
  }

  private solveAndEmit(nowUs?: number): void {
    // Waktu efektif solve: stempel logis penulisan pin bila ada,
    // selain itu perkiraan terbaik sesi (maks stempel & jam dinding).
    const nowEff = nowUs ?? Math.max(this.lastStampUs, this.wallUs);
    this.syncHcDevices();
    const instances = this.instancesWithEchoOverlay(nowEff);
    const pinStates = this.livePinStates();
    const netlist = buildNetlist(
      instances,
      this.parts.pinHoles,
      this.parts.wires,
      pinStates,
      this.board,
    );
    this.netOfBoardPin = netlist.netOfBoardPin;
    this.lastPinNets = netlist.input.pinNets;

    // Kontrak audit K10: solusi tick sebelumnya diteruskan sebagai
    // tegangan awal iterasi PWL (initialVoltages, parameter ke-3
    // solveCircuit) agar komponen non-linear tidak mulai dari 0 V
    // setiap solve.
    let solution = solveCircuit(
      this.powered && !this.boardFault ? netlist.input : { ...netlist.input, sources: [] },
      electricalOf,
      this.lastSolution?.voltages,
    );

    if (this.powered && !this.boardFault && netlist.shortCircuit) {
      this.boardFault = true;
      this.pendingBoard.push({
        pinId: null,
        report: shortCircuitDamageReport(netlist.shortCircuit.volts),
      });
      solution = solveCircuit({ ...netlist.input, sources: [] }, electricalOf, this.lastSolution?.voltages);
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
          instances,
          this.parts.pinHoles,
          this.parts.wires,
          this.livePinStates(),
          this.board,
        );
        this.netOfBoardPin = rebuilt.netOfBoardPin;
        this.lastPinNets = rebuilt.input.pinNets;
        solution = solveCircuit(rebuilt.input, electricalOf, this.lastSolution?.voltages);
      }
    }

    // Model perangkat HC-SR04: tepi TRIG dibaca dari solusi final pada
    // stempel waktu solve ini (jadwal ECHO berlaku untuk solve berikut).
    this.detectTrigEdges(solution.voltages, this.lastPinNets, nowEff);

    for (const event of solution.damageEvents) this.pendingDamage.push(event);
    this.lastSolution = solution;

    // Status solver (self-healing): lacak transisi sehat↔gagal agar
    // snapshot membawa status yang bisa ditampilkan UI (solverError)
    // dan pemberitahuan one-shot hanya muncul saat keadaan BERUBAH —
    // bukan banjir pesan di setiap tick selama rangkaian bermasalah.
    const nextSolverError = solution.solveError ?? null;
    if (nextSolverError !== this.solverError) {
      if (nextSolverError !== null && this.solverError === null) {
        this.pendingNotice = SOLVER_FAILED_NOTICE;
      } else if (nextSolverError === null && this.solverError !== null) {
        this.pendingNotice = SOLVER_RECOVERED_NOTICE;
      }
      this.solverError = nextSolverError;
    }

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
      currentLine: this.currentLine,
      solverError: this.solverError,
      notice: this.pendingNotice,
    };
    this.pendingNotice = null;
    this.pendingDamage = [];
    this.pendingBoard = [];
    this.serialBuffer = '';
    this.serialDirty = false;
    this.listener(snapshot);
  }
}
