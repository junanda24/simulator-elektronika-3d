import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../simSession';
import { computePlacement } from '../../../wiring/placement';
import { terminalHoleId, railHoleId } from '../../../../shared/boards/breadboard';
import type { WireConnection } from '../../../wiring/netlist';
import { DEFAULT_SKETCH } from '../../../sketch/defaultSketch';

/**
 * Tes integrasi Batch 2: sesi simulasi penuh (netlist → runtime sketch →
 * solver → aturan board) tanpa worker, digerakkan waktu nyata.
 */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `tw-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

function blinkParts() {
  const resistor = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
  const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
  if (!resistor || !led) throw new Error('placement demo gagal');
  const instances = [
    { ...resistor.instance, props: { resistance: 220 } },
    { ...led.instance, props: { color: 'red' } },
  ];
  const pinHoles = {
    [resistor.instance.id]: resistor.pinHoles,
    [led.instance.id]: led.pinHoles,
  };
  const wires: WireConnection[] = [
    wire(board('D13'), hole(resistor.pinHoles.A)),
    wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
    wire(hole(railHoleId('R-', 4)), board('GND#1')),
  ];
  return { instances, pinHoles, wires, ledId: led.instance.id, boardId: 'uno' };
}

function collect(session: SimSession) {
  const snapshots: SimSnapshot[] = [];
  let serial = '';
  session.setSnapshotListener((snap) => {
    snapshots.push(snap);
    serial += snap.serialChunk;
  });
  return {
    snapshots,
    serial: () => serial,
    last: () => snapshots[snapshots.length - 1],
  };
}

async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return check();
}

describe('SimSession — Batch 2', () => {
  it('blink: arus LED menyala lalu padam mengikuti sketch D13', async () => {
    const session = new SimSession();
    const { last, serial } = collect(session);
    const parts = blinkParts();
    session.setCircuit(parts);
    session.startSketch(DEFAULT_SKETCH);
    const ledOn = () =>
      (last()?.results[parts.ledId]?.branchCurrents['led'] ?? 0) > 0.005;
    const ledOff = () =>
      last() !== undefined &&
      (last().results[parts.ledId]?.branchCurrents['led'] ?? 1) < 0.001;
    expect(await waitFor(ledOn, 4000)).toBe(true);
    expect(await waitFor(ledOff, 4000)).toBe(true);
    expect(serial()).toContain('Blink dimulai!');
    session.stopSketch();
  }, 15000);

  it('LED langsung di D13 tanpa resistor: pin mati (MCU_PIN_OVERCURRENT)', async () => {
    const session = new SimSession();
    const { last, snapshots } = collect(session);
    const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
    if (!led) throw new Error('placement gagal');
    session.setCircuit({
      boardId: 'uno',
      instances: [{ ...led.instance, props: { color: 'red' } }],
      pinHoles: { [led.instance.id]: led.pinHoles },
      wires: [
        wire(board('D13'), hole(led.pinHoles.ANODE)),
        wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#1')),
      ],
    });
    session.startSketch(`void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delay(100); }`);
    const pinDead = () =>
      snapshots.some((s) => s.boardEvents.some((e) => e.pinId === 'D13')) &&
      last().deadPins.includes('D13');
    expect(await waitFor(pinDead, 4000)).toBe(true);
    session.stopSketch();
  }, 15000);

  it('rel 5V langsung ke GND: POWER_SHORT_CIRCUIT dan board fault', async () => {
    const session = new SimSession();
    const { last } = collect(session);
    session.setCircuit({
      boardId: 'uno',
      instances: [],
      pinHoles: {},
      wires: [wire(board('5V#3'), board('GND#1'))],
    });
    session.setPowered(true);
    expect(last().boardFault).toBe(true);
    expect(last().boardEvents[0]?.report.ruleId).toBe('POWER_SHORT_CIRCUIT');
    expect(last().boardEvents[0]?.pinId).toBeNull();
  });

  it('digitalRead INPUT_PULLUP: lepas = 1, ditarik ke GND = 0', async () => {
    const sketch = `void setup() { pinMode(2, INPUT_PULLUP); }
void loop() { Serial.println(digitalRead(2)); delay(60); }`;
    const s1 = new SimSession();
    const c1 = collect(s1);
    s1.setCircuit({ boardId: 'uno', instances: [], pinHoles: {}, wires: [] });
    s1.startSketch(sketch);
    expect(await waitFor(() => c1.serial().includes('1\n'), 4000)).toBe(true);
    s1.stopSketch();

    const s2 = new SimSession();
    const c2 = collect(s2);
    s2.setCircuit({
      boardId: 'uno',
      instances: [],
      pinHoles: {},
      wires: [wire(board('D2'), board('GND#1'))],
    });
    s2.startSketch(sketch);
    expect(await waitFor(() => c2.serial().includes('0\n'), 4000)).toBe(true);
    s2.stopSketch();
  }, 15000);

  it('analogRead membaca pembagi tegangan 1k/1k ≈ 512', async () => {
    const session = new SimSession();
    const { serial } = collect(session);
    const r1 = computePlacement('resistor', terminalHoleId('L', 24, 2), new Set());
    const r2 = computePlacement('resistor', terminalHoleId('L', 20, 4), new Set());
    if (!r1 || !r2) throw new Error('placement gagal');
    const instances = [
      { ...r1.instance, props: { resistance: 1000 } },
      { ...r2.instance, props: { resistance: 1000 } },
    ];
    const pinHoles = {
      [r1.instance.id]: r1.pinHoles,
      [r2.instance.id]: r2.pinHoles,
    };
    const wires: WireConnection[] = [
      wire(board('5V#3'), hole(railHoleId('L+', 4))),
      wire(hole(railHoleId('L+', 29)), hole(r1.pinHoles.A)),
      // Node tengah = strip baris 20 bank L (B r1 dan A r2 berbagi strip)
      wire(hole(r2.pinHoles.B), hole(railHoleId('L-', 29))),
      wire(hole(railHoleId('L-', 4)), board('GND#1')),
      wire(board('A0'), hole(terminalHoleId('L', 20, 0))),
    ];
    session.setCircuit({ boardId: 'uno', instances, pinHoles, wires });
    session.startSketch(`void setup() { }
void loop() { Serial.println(analogRead(A0)); delay(60); }`);
    const found = await waitFor(() => {
      const match = serial().match(/(\d{3,4})\n/);
      if (!match) return false;
      const value = Number(match[1]);
      return value > 490 && value < 535;
    }, 4000);
    expect(found).toBe(true);
    session.stopSketch();
  }, 15000);
});
