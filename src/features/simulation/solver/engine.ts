/**
 * Mesin simulasi rangkaian — SIMULATION_RULES.md §1 & §2.
 *
 * Alur: bangun peta net → iterasi PWL (maks 8×, berhenti saat konvergen) →
 * hitung arus cabang per instance → evaluasi aturan kerusakan.
 * Iterasi ke-0 dapat disemai `initialVoltages` (solusi tick sebelumnya).
 *
 * Zero-core-touch: engine tidak pernah memeriksa tipe komponen; semua
 * perilaku elektrik datang dari `electricalOf` (registry plugin).
 *
 * Self-healing solver (2026-10-21): satu percobaan solve dinyatakan
 * GAGAL bila PWL tidak konvergen dalam batas iterasi atau ada nilai
 * tak-hingga (NaN/Infinity) di tegangan/arus hasil. Kegagalan tidak
 * langsung menyerah — tangga pemulihan dijalankan berurutan:
 *   1. Buang tebakan tegangan awal (solve dingin dari 0 V) — tebakan
 *      basi/korup dari tick sebelumnya adalah penyebab gagal terbanyak.
 *   2. Naikkan gmin ×10 — jangkar bocor lebih kuat menenangkan matriks
 *      nyaris singular (harga akurasi ≈ arus bocor 5 V × 1e-8 S = 50 nA,
 *      jauh di bawah toleransi pelajaran mana pun).
 *   3. Naikkan gmin ×100.
 * Bila semua tangga gagal, yang dikembalikan BUKAN angka rusak:
 * solusi jujur serba-0 yang hingga + `solveError` terisi, agar UI bisa
 * menyatakan "perhitungan gagal" alih-alih menampilkan NaN.
 */

import type {
  CircuitInput,
  CircuitSolution,
  ComponentElectrical,
  ComponentSimResult,
  DamageReport,
  StampContext,
} from '../../../shared/types';
import { GND_NET, GMIN, MnaBuilder } from './mna';

const MAX_PWL_ITERATIONS = 8;
const CONVERGENCE_EPS = 1e-6;
/** Langkah waktu tetap yang diteruskan ke stamp plugin (detik). */
const SIM_DT = 1 / 60;

type ElectricalOf = (type: string) => ComponentElectrical | undefined;

/** Hasil satu percobaan solve + vonis kesehatannya. */
interface SolveAttempt {
  voltages: Map<string, number>;
  results: Map<string, ComponentSimResult>;
  damageEvents: Array<{ instanceId: string; report: DamageReport }>;
  /** true = PWL konvergen DAN semua nilai hasil hingga. */
  healthy: boolean;
}

/** Satu percobaan solve penuh (PWL + arus cabang + kerusakan). */
function attemptSolve(
  input: CircuitInput,
  electricalOf: ElectricalOf,
  initialVoltages: Map<string, number> | undefined,
  gminScale: number,
): SolveAttempt {
  // Pin tanpa entri di pinNets = net unik sendiri (mengambang, tegangan 0 via gmin).
  const netOf = (instanceId: string, pinId: string): string =>
    input.pinNets[`${instanceId}:${pinId}`] ?? `__float:${instanceId}:${pinId}`;

  const netSet = new Set<string>();
  for (const net of Object.values(input.pinNets)) {
    if (net !== GND_NET) netSet.add(net);
  }
  for (const source of input.sources) {
    if (source.net !== GND_NET) netSet.add(source.net);
  }
  for (const link of input.links ?? []) {
    if (link.a !== GND_NET) netSet.add(link.a);
    if (link.b !== GND_NET) netSet.add(link.b);
  }
  const nets = [...netSet];

  let prev = initialVoltages ? new Map(initialVoltages) : new Map<string, number>();
  let voltages = new Map<string, number>([[GND_NET, 0]]);
  let converged = false;

  for (let iter = 0; iter < MAX_PWL_ITERATIONS; iter++) {
    const builder = new MnaBuilder(nets, GMIN * gminScale);
    const ctx: StampContext = {
      netOf,
      prevVoltage: (net) => (net === GND_NET ? 0 : (prev.get(net) ?? 0)),
      conductance: (a, b, g) => builder.conductance(a, b, g),
      current: (from, to, amps) => builder.current(from, to, amps),
      thevenin: (net, volts, ohms) => builder.thevenin(net, volts, ohms),
    };

    for (const source of input.sources) {
      ctx.thevenin(source.net, source.volts, source.seriesOhms);
    }
    for (const link of input.links ?? []) {
      ctx.conductance(link.a, link.b, 1 / link.ohms);
    }
    for (const instance of input.instances) {
      // Komponen yang sudah rusak = rangkaian terbuka: tidak di-stamp sama sekali.
      if (instance.simState.isDamaged) continue;
      const electrical = electricalOf(instance.type);
      if (electrical) electrical.stamp(ctx, instance, SIM_DT);
    }

    voltages = builder.solve();

    let maxDelta = 0;
    for (const net of nets) {
      const delta = Math.abs((voltages.get(net) ?? 0) - (prev.get(net) ?? 0));
      if (delta > maxDelta) maxDelta = delta;
    }
    prev = voltages;
    if (maxDelta < CONVERGENCE_EPS) {
      converged = true;
      break;
    }
  }

  const results = new Map<string, ComponentSimResult>();
  const damageEvents: Array<{ instanceId: string; report: DamageReport }> = [];

  for (const instance of input.instances) {
    const pinVoltages: Record<string, number> = {};
    for (const key of Object.keys(input.pinNets)) {
      const sep = key.indexOf(':');
      if (sep > 0 && key.slice(0, sep) === instance.id) {
        const pinId = key.slice(sep + 1);
        pinVoltages[pinId] = voltages.get(netOf(instance.id, pinId)) ?? 0;
      }
    }

    if (instance.simState.isDamaged) {
      // Tetap laporkan tegangan pin-nya, tapi tanpa arus cabang (tidak menghantar)
      // dan tanpa event baru — kerusakan lama bukan "kerusakan baru pada tick ini".
      const carried: ComponentSimResult = {
        pinVoltages,
        branchCurrents: {},
        isDamaged: true,
      };
      if (instance.simState.damageReport) {
        carried.damageReport = instance.simState.damageReport;
      }
      results.set(instance.id, carried);
      continue;
    }

    const electrical = electricalOf(instance.type);
    const branchCurrents = electrical
      ? electrical.computeCurrents(instance, voltages, netOf)
      : {};
    const result: ComponentSimResult = { pinVoltages, branchCurrents, isDamaged: false };

    if (electrical) {
      const report = electrical.checkDamage(instance, result);
      if (report) {
        result.isDamaged = true;
        result.damageReport = report;
        damageEvents.push({ instanceId: instance.id, report });
      }
    }
    results.set(instance.id, result);
  }

  // Vonis kesehatan: konvergen saja tidak cukup — satu NaN di arus
  // cabang (computeCurrents plugin) juga kegagalan, karena angka itu
  // yang akan dibaca inspektor & lencana 3D.
  let healthy = converged;
  if (healthy) {
    for (const volts of voltages.values()) {
      if (!Number.isFinite(volts)) {
        healthy = false;
        break;
      }
    }
  }
  if (healthy) {
    outer: for (const result of results.values()) {
      for (const volts of Object.values(result.pinVoltages)) {
        if (!Number.isFinite(volts)) {
          healthy = false;
          break outer;
        }
      }
      for (const amps of Object.values(result.branchCurrents)) {
        if (!Number.isFinite(amps)) {
          healthy = false;
          break outer;
        }
      }
    }
  }

  return { voltages, results, damageEvents, healthy };
}

/**
 * Solusi jujur saat semua tangga pemulihan gagal: semua net 0 V,
 * semua arus 0, status kerusakan lama dipertahankan — hingga semua,
 * tanpa event kerusakan baru (tidak ada dasar elektrik untuk menilai).
 */
function failedSolution(input: CircuitInput): CircuitSolution {
  const voltages = new Map<string, number>([[GND_NET, 0]]);
  for (const net of Object.values(input.pinNets)) voltages.set(net, 0);
  for (const source of input.sources) voltages.set(source.net, 0);
  for (const link of input.links ?? []) {
    voltages.set(link.a, 0);
    voltages.set(link.b, 0);
  }
  const results = new Map<string, ComponentSimResult>();
  for (const instance of input.instances) {
    const pinVoltages: Record<string, number> = {};
    for (const key of Object.keys(input.pinNets)) {
      const sep = key.indexOf(':');
      if (sep > 0 && key.slice(0, sep) === instance.id) {
        pinVoltages[key.slice(sep + 1)] = 0;
      }
    }
    const result: ComponentSimResult = {
      pinVoltages,
      branchCurrents: {},
      isDamaged: instance.simState.isDamaged,
    };
    if (instance.simState.isDamaged && instance.simState.damageReport) {
      result.damageReport = instance.simState.damageReport;
    }
    results.set(instance.id, result);
  }
  return {
    voltages,
    results,
    damageEvents: [],
    solveError:
      'Solver tidak konvergen untuk rangkaian ini — semua tangga pemulihan ' +
      '(solve ulang tanpa tebakan awal, gmin dinaikkan bertingkat) sudah dicoba.',
  };
}

export function solveCircuit(
  input: CircuitInput,
  electricalOf: ElectricalOf,
  /**
   * Tegangan solusi tick sebelumnya (opsional, kontrak antar-tick dari
   * simSession). Dipakai sebagai `prevVoltage` pada iterasi PWL ke-0 —
   * menggantikan awal dingin 0 V — sehingga komponen yang membaca
   * tegangan sebelumnya (LED/dioda PWL, transistor, relay, sensor aktif)
   * mulai dari titik kerja terakhir, bukan dari nol setiap tick.
   * Peta disalin: milik pemanggil tidak pernah dimutasi solver.
   */
  initialVoltages?: Map<string, number>,
): CircuitSolution {
  // Tangga pemulihan (self-healing): percobaan pertama persis perilaku
  // historis; tangga berikutnya hanya berjalan bila percobaan di
  // atasnya dinyatakan tidak sehat.
  const ladder: Array<{ seed: Map<string, number> | undefined; gminScale: number }> = [
    { seed: initialVoltages, gminScale: 1 },
    { seed: undefined, gminScale: 1 },
    { seed: undefined, gminScale: 10 },
    { seed: undefined, gminScale: 100 },
  ];
  for (const step of ladder) {
    const attempt = attemptSolve(input, electricalOf, step.seed, step.gminScale);
    if (attempt.healthy) {
      return {
        voltages: attempt.voltages,
        results: attempt.results,
        damageEvents: attempt.damageEvents,
      };
    }
  }
  return failedSolution(input);
}
