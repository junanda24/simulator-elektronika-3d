import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../simSession';
import { computePlacement } from '../../../wiring/placement';
import { terminalHoleId, railHoleId } from '../../../../shared/boards/breadboard';
import type { WireConnection } from '../../../wiring/netlist';

/** Tes Batch 3: multi-board + aturan MCU_PIN_OVERVOLTAGE. */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `tb-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

function collect(session: SimSession) {
  const snapshots: SimSnapshot[] = [];
  session.setSnapshotListener((snap) => snapshots.push(snap));
  return { last: () => snapshots[snapshots.length - 1], snapshots };
}

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return check();
}

describe('Batch 3 — multi-board', () => {
  it('ESP32: kabel VIN (5 V) ke GPIO D21 membunuh pin (MCU_PIN_OVERVOLTAGE)', async () => {
    const session = new SimSession();
    const { last, snapshots } = collect(session);
    session.setCircuit({
      boardId: 'esp32',
      instances: [],
      pinHoles: {},
      wires: [wire(board('VIN'), board('D21'))],
    });
    session.setPowered(true);
    expect(last().deadPins).toContain('D21');
    expect(
      snapshots.some((s) =>
        s.boardEvents.some(
          (e) => e.pinId === 'D21' && e.report.ruleId === 'MCU_PIN_OVERVOLTAGE',
        ),
      ),
    ).toBe(true);
    session.setPowered(false);
  });

  it('ESP32: pin 3V3 ke GPIO aman (tidak ada event overvoltage)', async () => {
    const session = new SimSession();
    const { last } = collect(session);
    session.setCircuit({
      boardId: 'esp32',
      instances: [],
      pinHoles: {},
      wires: [wire(board('3V3'), board('D21'))],
    });
    session.setPowered(true);
    expect(last().deadPins).toHaveLength(0);
    expect(last().boardFault).toBe(false);
    session.setPowered(false);
  });

  it('ESP32: blink di D2 dengan logika 3,3 V menyalakan LED', async () => {
    const session = new SimSession();
    const { last } = collect(session);
    const resistor = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
    const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
    if (!resistor || !led) throw new Error('placement gagal');
    session.setCircuit({
      boardId: 'esp32',
      instances: [
        { ...resistor.instance, props: { resistance: 220 } },
        { ...led.instance, props: { color: 'red' } },
      ],
      pinHoles: {
        [resistor.instance.id]: resistor.pinHoles,
        [led.instance.id]: led.pinHoles,
      },
      wires: [
        wire(board('D2'), hole(resistor.pinHoles.A)),
        wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#0')),
      ],
    });
    session.startSketch(`void setup() { pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); delay(400); digitalWrite(2, LOW); delay(400); }`);
    const ledOn = () =>
      (last()?.results[led.instance.id]?.branchCurrents['led'] ?? 0) > 0.002;
    expect(await waitFor(ledOn, 4000)).toBe(true);
    session.stopSketch();
  }, 15000);

  it('Uno: 5 V ke D21-equivalent (D7) aman karena logika Uno memang 5 V', async () => {
    const session = new SimSession();
    const { last } = collect(session);
    session.setCircuit({
      boardId: 'uno',
      instances: [],
      pinHoles: {},
      wires: [wire(board('5V#3'), board('D7'))],
    });
    session.setPowered(true);
    expect(last().deadPins).toHaveLength(0);
    session.setPowered(false);
  });
});
