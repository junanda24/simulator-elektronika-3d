import { describe, expect, it } from 'vitest';
import { buildNetlist, type WireConnection } from '../netlist';
import { computePlacement } from '../placement';
import { solveCircuit } from '../../simulation/solver/engine';
import { electricalOf } from '../../../shared/components/electricalRegistry';
import { terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';

describe('placement', () => {
  it('LED: katoda 2 baris di bawah anoda, kolom sama', () => {
    const p = computePlacement('led-5mm', terminalHoleId('L', 10, 2), new Set());
    expect(p).not.toBeNull();
    expect(p?.pinHoles.ANODE).toBe(terminalHoleId('L', 10, 2));
    expect(p?.pinHoles.CATHODE).toBe(terminalHoleId('L', 12, 2));
  });

  it('LED di baris terakhir ditolak (katoda keluar papan)', () => {
    expect(computePlacement('led-5mm', terminalHoleId('L', 62, 0), new Set())).toBeNull();
  });

  it('Resistor: kaki B 4 baris di atas kaki A, rotasi 90 derajat', () => {
    const p = computePlacement('resistor', terminalHoleId('R', 20, 1), new Set());
    expect(p?.pinHoles.A).toBe(terminalHoleId('R', 20, 1));
    expect(p?.pinHoles.B).toBe(terminalHoleId('R', 16, 1));
    expect(p?.instance.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('Lubang terisi ditolak', () => {
    const occupied = new Set([terminalHoleId('L', 12, 2)]);
    expect(computePlacement('led-5mm', terminalHoleId('L', 10, 2), occupied)).toBeNull();
  });
});

describe('netlist + solver (rangkaian demo)', () => {
  function buildDemo() {
    const resistorPlace = computePlacement('resistor', terminalHoleId('L', 24, 2), new Set());
    const ledPlace = computePlacement('led-5mm', terminalHoleId('R', 22, 2), new Set());
    if (!resistorPlace || !ledPlace) throw new Error('placement gagal');
    const resistor = { ...resistorPlace.instance, props: { resistance: 220 } };
    const led = { ...ledPlace.instance, props: { color: 'red' } };
    const pinHoles = {
      [resistor.id]: resistorPlace.pinHoles,
      [led.id]: ledPlace.pinHoles,
    };
    const wires: WireConnection[] = [
      { id: 'w1', a: { kind: 'board', pinId: '5V#3' }, b: { kind: 'hole', holeId: railHoleId('L+', 4) }, color: '#ef4444' },
      { id: 'w2', a: { kind: 'hole', holeId: railHoleId('L+', 29) }, b: { kind: 'hole', holeId: resistorPlace.pinHoles.A }, color: '#ef4444' },
      { id: 'w3', a: { kind: 'hole', holeId: resistorPlace.pinHoles.B }, b: { kind: 'hole', holeId: ledPlace.pinHoles.ANODE }, color: '#eab308' },
      { id: 'w4', a: { kind: 'hole', holeId: ledPlace.pinHoles.CATHODE }, b: { kind: 'hole', holeId: railHoleId('R-', 29) }, color: '#2a2e37' },
      { id: 'w5', a: { kind: 'hole', holeId: railHoleId('R-', 4) }, b: { kind: 'board', pinId: 'GND#1' }, color: '#2a2e37' },
    ];
    return { resistor, led, pinHoles, wires };
  }

  it('rangkaian demo lengkap: LED menyala aman ±13 mA, tanpa kerusakan', () => {
    const { resistor, led, pinHoles, wires } = buildDemo();
    const { input, netOfPin } = buildNetlist([resistor, led], pinHoles, wires);
    // Kedua rail board selalu hidup (board berdaya USB): 5V pada net gabungannya,
    // 3V3 pada net-nya sendiri yang mengambang.
    expect(input.sources).toHaveLength(2);
    expect(input.sources.some((s) => s.volts === 5)).toBe(true);
    expect(netOfPin(led.id, 'CATHODE')).toBe('GND');
    const solution = solveCircuit(input, electricalOf);
    const ledResult = solution.results.get(led.id);
    const amps = ledResult?.branchCurrents['led'] ?? 0;
    expect(amps).toBeGreaterThan(0.011);
    expect(amps).toBeLessThan(0.015);
    expect(solution.damageEvents).toHaveLength(0);
  });

  it('tanpa resistor (anoda langsung ke rail 5V): LED rusak overcurrent', () => {
    const { resistor, led, pinHoles, wires } = buildDemo();
    // Buang resistor + kabelnya; sambungkan anoda langsung ke rail L+
    const wiresDirect: WireConnection[] = [
      wires[0],
      { id: 'wd', a: { kind: 'hole', holeId: railHoleId('L+', 29) }, b: { kind: 'hole', holeId: pinHoles[led.id].ANODE }, color: '#ef4444' },
      wires[3],
      wires[4],
    ];
    const { input } = buildNetlist([led], { [led.id]: pinHoles[led.id] }, wiresDirect);
    void resistor;
    const solution = solveCircuit(input, electricalOf);
    expect(solution.damageEvents).toHaveLength(1);
    expect(solution.damageEvents[0].report.ruleId).toBe('LED_OVERCURRENT');
    expect(solution.results.get(led.id)?.isDamaged).toBe(true);
  });

  it('kabel 5V langsung ke GND: rail runtuh ke 0 V, solver tetap stabil', () => {
    const wires: WireConnection[] = [
      { id: 'ws', a: { kind: 'board', pinId: '5V#3' }, b: { kind: 'board', pinId: 'GND#1' }, color: '#ef4444' },
    ];
    const { input } = buildNetlist([], {}, wires);
    // Sumber 5V dibuang (net-nya korslet ke GND). Sumber 3V3 tetap pada net
    // mengambangnya sendiri — penyederhanaan Batch 1 (di board asli polyfuse
    // USB akan memutus semua daya; aturan POWER_SHORT_CIRCUIT menyusul).
    expect(input.sources).toHaveLength(1);
    expect(input.sources[0].volts).toBe(3.3);
    const solution = solveCircuit(input, electricalOf);
    for (const volts of solution.voltages.values()) {
      expect(Number.isFinite(volts)).toBe(true);
    }
  });
});
