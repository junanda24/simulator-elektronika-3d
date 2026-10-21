/**
 * Mesin simulasi rangkaian — SIMULATION_RULES.md §1 & §2.
 *
 * Alur: bangun peta net → iterasi PWL (maks 8×, berhenti saat konvergen) →
 * hitung arus cabang per instance → evaluasi aturan kerusakan.
 *
 * Zero-core-touch: engine tidak pernah memeriksa tipe komponen; semua
 * perilaku elektrik datang dari `electricalOf` (registry plugin).
 */

import type {
  CircuitInput,
  CircuitSolution,
  ComponentElectrical,
  ComponentSimResult,
  DamageReport,
  StampContext,
} from '../../../shared/types';
import { GND_NET, MnaBuilder } from './mna';

const MAX_PWL_ITERATIONS = 8;
const CONVERGENCE_EPS = 1e-6;
/** Langkah waktu tetap yang diteruskan ke stamp plugin (detik). */
const SIM_DT = 1 / 60;

export function solveCircuit(
  input: CircuitInput,
  electricalOf: (type: string) => ComponentElectrical | undefined,
): CircuitSolution {
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

  let prev = new Map<string, number>();
  let voltages = new Map<string, number>([[GND_NET, 0]]);

  for (let iter = 0; iter < MAX_PWL_ITERATIONS; iter++) {
    const builder = new MnaBuilder(nets);
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
    if (maxDelta < CONVERGENCE_EPS) break;
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

  return { voltages, results, damageEvents };
}
