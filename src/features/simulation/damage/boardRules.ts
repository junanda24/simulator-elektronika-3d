import type { BoardProfile, DamageReport, PinState } from '../../../shared/types';

/**
 * Aturan kerusakan tingkat board (SIMULATION_RULES.md §4) — dievaluasi
 * sesi simulasi dari hasil solver + state pin, BUKAN oleh plugin komponen:
 * - MCU_PIN_OVERCURRENT: pin OUTPUT menarik/menyalurkan arus > batas board.
 * - POWER_SHORT_CIRCUIT: rail daya terhubung langsung ke GND.
 */

export interface PinOvercurrentEvent {
  pinId: string;
  amps: number;
  report: DamageReport;
}

/** Tegangan target pin OUTPUT — harus sama dengan yang di-stamp netlist. */
export function pinTargetVolts(state: PinState, profile: BoardProfile): number {
  if (state.pwm !== undefined) return (profile.logicVolts * state.pwm) / 255;
  return state.high ? profile.logicVolts : 0;
}

export function evaluatePinOvercurrent(args: {
  pinStates: Record<string, PinState>;
  voltages: Map<string, number>;
  netOfBoardPin: (pinId: string) => string;
  profile: BoardProfile;
  deadPins: ReadonlySet<string>;
}): PinOvercurrentEvent[] {
  const events: PinOvercurrentEvent[] = [];
  for (const [pinId, state] of Object.entries(args.pinStates)) {
    if (state.mode !== 'OUTPUT' || args.deadPins.has(pinId)) continue;
    const vNet = args.voltages.get(args.netOfBoardPin(pinId)) ?? 0;
    const amps = (pinTargetVolts(state, args.profile) - vNet) / args.profile.pinOhms;
    const ma = Math.abs(amps) * 1000;
    if (ma > args.profile.pinMaxMa) {
      events.push({
        pinId,
        amps,
        report: {
          ruleId: 'MCU_PIN_OVERCURRENT',
          titleId: `Pin ${pinId} Terbakar — Arus Pin Berlebih`,
          explanationId: `Pin GPIO ${pinId} hanya sanggup mengalirkan arus sampai ${args.profile.pinMaxMa} mA, tetapi rangkaian memaksanya mengalirkan ${ma.toFixed(0)} mA. Driver transistor di dalam mikrokontroler panas dan putus — pin ini mati permanen. Penyebab paling umum: beban tanpa resistor pembatas atau pin tertahan langsung ke rel daya/GND. Turunkan arus dengan resistor seri atau transistor perantara.`,
          measured: ma,
          limit: args.profile.pinMaxMa,
          unit: 'mA',
        },
      });
    }
  }
  return events;
}

/** Laporan korsleting rel daya (arus teoritis rel / 1 Ω resistansi rel). */
export function shortCircuitDamageReport(volts: number): DamageReport {
  return {
    ruleId: 'POWER_SHORT_CIRCUIT',
    titleId: 'Korsleting — Rel Daya Langsung ke GND',
    explanationId:
      'Kabel menghubungkan rel daya langsung ke ground tanpa beban apa pun. Arus melonjak ribuan miliampere dalam sekejap; di board asli regulator/fuse USB akan putus dan board mati total. Periksa kembali kabel merah dan hitam sebelum menyalakan board.',
    measured: volts * 1000,
    limit: 500,
    unit: 'mA',
  };
}

export interface PinOvervoltageEvent {
  pinId: string;
  volts: number;
  report: DamageReport;
}

/**
 * MCU_PIN_OVERVOLTAGE: pin GPIO menerima tegangan di luar rentang logika
 * board (klasik: sinyal 5 V masuk ke pin board 3,3 V). Dievaluasi untuk
 * SEMUA pin sinyal board — termasuk yang belum dikonfigurasi sketch —
 * karena kerusakan terjadi di level hardware, bukan program.
 */
export function evaluatePinOvervoltage(args: {
  pinIds: string[];
  voltages: Map<string, number>;
  netOfBoardPin: (pinId: string) => string;
  profile: BoardProfile;
  deadPins: ReadonlySet<string>;
}): PinOvervoltageEvent[] {
  const events: PinOvervoltageEvent[] = [];
  const limit = args.profile.logicVolts + 0.5;
  for (const pinId of args.pinIds) {
    if (args.deadPins.has(pinId)) continue;
    const volts = args.voltages.get(args.netOfBoardPin(pinId)) ?? 0;
    if (volts > limit || volts < -0.5) {
      events.push({
        pinId,
        volts,
        report: {
          ruleId: 'MCU_PIN_OVERVOLTAGE',
          titleId: `Pin ${pinId} Terbakar — Tegangan Melebihi Logika ${args.profile.logicVolts} V`,
          explanationId: `Pin ${pinId} dirancang untuk logika ${args.profile.logicVolts} V, tetapi menerima ${volts.toFixed(2)} V. Tegangan berlebih menembus gerbang transistor GPIO dan merusaknya permanen. Kesalahan klasik: memakai sinyal/rel 5 V (gaya Arduino Uno) langsung ke board 3,3 V seperti ESP32, NodeMCU, atau Pico. Gunakan pembagi tegangan atau level shifter.`,
          measured: volts,
          limit: args.profile.logicVolts,
          unit: 'V',
        },
      });
    }
  }
  return events;
}
