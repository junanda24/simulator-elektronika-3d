import { describe, expect, it } from 'vitest';
import type {
  ComponentElectrical,
  ComponentInstanceState,
} from '../../../shared/types';
import { EMPTY_SIM_RESULT } from '../../../shared/types';
import { RESISTOR_META } from '../../../shared/components/catalog/resistor/meta';
import { resistorElectrical } from '../../../shared/components/catalog/resistor/electrical';
import { solveCircuit } from '../solver/engine';
import { SimSession } from '../worker/simSession';

/**
 * Self-healing solver (2026-10-21): tangga pemulihan engine —
 * (1) buang tebakan awal, (2) gmin ×10, (3) gmin ×100 — dan kegagalan
 * jujur (solveError + solusi serba-0 yang hingga) bila semua tangga
 * gagal. NaN/Infinity tidak boleh pernah keluar dari solveCircuit.
 */

function instance(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props,
    interactiveState: {},
    simState: { ...EMPTY_SIM_RESULT },
  };
}

/**
 * Plugin uji berosilasi: target Thevenin-nya membalik mengikuti
 * tegangan iterasi sebelumnya (di atas 2,5 V → 0 V, di bawah → 5 V),
 * jadi PWL memantul 0↔±5 V selamanya dan tidak pernah konvergen —
 * pemicu non-konvergensi yang deterministik.
 */
const flipFlopElectrical: ComponentElectrical = {
  stamp: (ctx, inst) => {
    const net = ctx.netOf(inst.id, 'X');
    ctx.thevenin(net, ctx.prevVoltage(net) > 2.5 ? 0 : 5, 1);
  },
  computeCurrents: () => ({}),
  checkDamage: () => null,
};

function flipFlopCircuit(electricalOf: (t: string) => ComponentElectrical | undefined) {
  return {
    input: {
      instances: [
        instance('r1', 'resistor', { resistance: 1000 }),
        instance('f1', 'test-flipflop'),
      ],
      pinNets: { 'r1:A': 'NX', 'r1:B': 'GND', 'f1:X': 'NX' },
      sources: [],
    },
    electricalOf,
  };
}

const withFlipFlop = (extra?: Record<string, ComponentElectrical>) => {
  const registry: Record<string, ComponentElectrical> = {
    [RESISTOR_META.type]: resistorElectrical,
    'test-flipflop': flipFlopElectrical,
    ...extra,
  };
  return (type: string) => registry[type];
};

describe('Solver guard — tangga pemulihan', () => {
  it('rangkaian sehat: tidak ada solveError, hasil seperti biasa', () => {
    const solution = solveCircuit(
      {
        instances: [
          instance('r1', 'resistor', { resistance: 1000 }),
          instance('r2', 'resistor', { resistance: 1000 }),
        ],
        pinNets: { 'r1:A': 'V5', 'r1:B': 'MID', 'r2:A': 'MID', 'r2:B': 'GND' },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      withFlipFlop(),
    );
    expect(solution.solveError).toBeUndefined();
    expect(solution.voltages.get('MID') ?? NaN).toBeCloseTo(2.5, 1);
  });

  it('non-konvergensi permanen: semua tangga gagal → solveError + solusi 0 yang hingga', () => {
    const { input, electricalOf } = flipFlopCircuit(withFlipFlop());
    const solution = solveCircuit(input, electricalOf);

    expect(solution.solveError).toBeTruthy();
    // Tidak ada satu pun angka rusak yang bocor.
    for (const volts of solution.voltages.values()) {
      expect(Number.isFinite(volts)).toBe(true);
      expect(volts).toBe(0);
    }
    for (const result of solution.results.values()) {
      for (const volts of Object.values(result.pinVoltages)) {
        expect(Number.isFinite(volts)).toBe(true);
      }
      for (const amps of Object.values(result.branchCurrents)) {
        expect(Number.isFinite(amps)).toBe(true);
      }
    }
    // Kegagalan solver bukan kerusakan komponen: tanpa event kerusakan.
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('plugin nakal hanya di percobaan pertama: tangga berikutnya memulihkan solve', () => {
    // Menghitung panggilan stamp: 8 panggilan pertama (= seluruh
    // iterasi percobaan pertama) berosilasi; setelah itu plugin
    // berperilaku sebagai sumber 5 V tetap — mensimulasikan keadaan
    // awal korup yang hilang saat tebakan awal dibuang.
    let stamps = 0;
    const recoveringElectrical: ComponentElectrical = {
      stamp: (ctx, inst) => {
        stamps += 1;
        const net = ctx.netOf(inst.id, 'X');
        if (stamps <= 8) {
          ctx.thevenin(net, ctx.prevVoltage(net) > 2.5 ? 0 : 5, 1);
        } else {
          ctx.thevenin(net, 5, 1);
        }
      },
      computeCurrents: () => ({}),
      checkDamage: () => null,
    };
    const { input, electricalOf } = flipFlopCircuit(
      withFlipFlop({ 'test-flipflop': recoveringElectrical }),
    );
    const solution = solveCircuit(input, electricalOf);

    expect(solution.solveError).toBeUndefined();
    // Sumber 5 V (1 Ω) membebani resistor 1 kΩ: 5 · 1000/1001 ≈ 4,995 V.
    expect(solution.voltages.get('NX') ?? NaN).toBeCloseTo(4.995, 2);
    expect(stamps).toBeGreaterThan(8);
  });

  it('arus cabang NaN dari plugin: dinyatakan gagal, NaN tidak bocor ke hasil', () => {
    const nanCurrentElectrical: ComponentElectrical = {
      stamp: (ctx, inst) => {
        ctx.conductance(ctx.netOf(inst.id, 'X'), 'GND', 1 / 1000);
      },
      computeCurrents: () => ({ main: Number.NaN }),
      checkDamage: () => null,
    };
    const solution = solveCircuit(
      {
        instances: [instance('n1', 'test-nan')],
        pinNets: { 'n1:X': 'V5' },
        sources: [{ net: 'V5', volts: 5, seriesOhms: 1 }],
      },
      withFlipFlop({ 'test-nan': nanCurrentElectrical }),
    );

    expect(solution.solveError).toBeTruthy();
    for (const result of solution.results.values()) {
      for (const amps of Object.values(result.branchCurrents)) {
        expect(Number.isFinite(amps)).toBe(true);
      }
    }
  });

  it('snapshot sesi membawa kolom solverError & notice (null saat sehat)', () => {
    const session = new SimSession();
    let lastSolverError: string | null | undefined;
    let lastNotice: string | null | undefined;
    session.setSnapshotListener((snap) => {
      lastSolverError = snap.solverError;
      lastNotice = snap.notice;
    });
    session.setCircuit({ instances: [], pinHoles: {}, wires: [], boardId: 'uno' });
    session.setPowered(true);
    expect(lastSolverError).toBeNull();
    expect(lastNotice).toBeNull();
    session.stopSketch();
  });
});
