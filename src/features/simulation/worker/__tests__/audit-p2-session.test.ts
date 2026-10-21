import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../simSession';
import { computePlacement } from '../../../wiring/placement';
import { railHoleId, terminalHoleId } from '../../../../shared/boards/breadboard';
import type { WireConnection } from '../../../wiring/netlist';

/**
 * Audit P2 — K10 (solve periodik saat runtime di dalam delay()):
 * selama sketch diam di delay() panjang TANPA perubahan pin dan TANPA
 * serial, snapshot harus tetap mengalir pada tick 16 ms bila rangkaian
 * berdaya dan memuat komponen dinamis (capacitor/dc-motor/servo).
 * Nilai solve ulang periodik (terkonfirmasi P3): solver disemai
 * initialVoltages dari solusi tick sebelumnya, sehingga komponen yang
 * membaca prevVoltage (LED/dioda PWL, transistor, relay, buzzer,
 * joystick, PIR, soil-moisture) memulai iterasi dari titik kerja
 * terakhir, bukan dari 0 V. CATATAN MODEL: kapasitor saat ini DC-tunak
 * murni (bocor 10 MΩ, tidak membaca prevVoltage) — tes ini TIDAK
 * mengharapkan pengisian muatan antar-tick; yang diasersi adalah
 * aliran snapshot periodik + tegangan tunaknya yang benar.
 * Kontrafaktual: rangkaian statis murni (resistor) TIDAK di-solve ulang
 * secara periodik (tidak membanjiri jembatan worker).
 */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `k10-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

const SILENT_SKETCH = `void setup() { }
void loop() { delay(5000); }`;

describe('K10 — solveAndEmit periodik pada tick timer', () => {
  it('kapasitor berdaya + sketch diam di delay(): snapshot terus mengalir', async () => {
    const placement = computePlacement('capacitor', terminalHoleId('L', 15, 2), new Set());
    if (!placement) throw new Error('placement kapasitor gagal');

    const session = new SimSession();
    const all: SimSnapshot[] = [];
    session.setSnapshotListener((snap) => all.push(snap));
    session.setCircuit({
      boardId: 'uno',
      instances: [placement.instance],
      pinHoles: { [placement.instance.id]: placement.pinHoles },
      wires: [
        wire(board('5V#3'), hole(railHoleId('R+', 4))),
        wire(hole(railHoleId('R+', 29)), hole(placement.pinHoles.PLUS)),
        wire(hole(placement.pinHoles.MINUS), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#1')),
      ],
    });
    session.startSketch(SILENT_SKETCH);
    const baseline = all.length;
    await new Promise((r) => setTimeout(r, 220));
    const during = all.length - baseline;
    // Tick 16 ms selama 220 ms ≈ belasan snapshot; longgar ≥ 4 untuk CI lambat.
    expect(during).toBeGreaterThanOrEqual(4);
    const lastSnap = all[all.length - 1];
    const capResult = lastSnap.results[placement.instance.id];
    expect(capResult).toBeDefined();
    expect(capResult.pinVoltages.PLUS).toBeGreaterThan(4.5);
    expect(capResult.isDamaged).toBe(false);
    session.stopSketch();
  }, 15000);

  it('rangkaian statis murni (resistor) + delay(): TIDAK ada banjir snapshot periodik', async () => {
    const res = computePlacement('resistor', terminalHoleId('L', 24, 2), new Set());
    if (!res) throw new Error('placement resistor gagal');
    const session = new SimSession();
    const all: SimSnapshot[] = [];
    session.setSnapshotListener((snap) => all.push(snap));
    session.setCircuit({
      boardId: 'uno',
      instances: [{ ...res.instance, props: { resistance: 1000 } }],
      pinHoles: { [res.instance.id]: res.pinHoles },
      wires: [
        wire(board('5V#3'), hole(railHoleId('L+', 4))),
        wire(hole(railHoleId('L+', 29)), hole(res.pinHoles.A)),
        wire(hole(res.pinHoles.B), hole(railHoleId('L-', 29))),
        wire(hole(railHoleId('L-', 4)), board('GND#1')),
      ],
    });
    session.startSketch(SILENT_SKETCH);
    const baseline = all.length;
    await new Promise((r) => setTimeout(r, 220));
    expect(all.length - baseline).toBe(0);
    session.stopSketch();
  }, 15000);
});
