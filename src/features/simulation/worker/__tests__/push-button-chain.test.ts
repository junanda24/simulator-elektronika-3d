import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../simSession';
import { computePlacement } from '../../../wiring/placement';
import { terminalHoleId } from '../../../../shared/boards/breadboard';
import type { WireConnection } from '../../../wiring/netlist';
import type { ComponentInstanceState } from '../../../../shared/types';

/**
 * Audit P2 — K11 (jalur push button, fokus user):
 * rantai penekanan tombol saat simulasi BERJALAN:
 * interact/setCircuit(pressed) → solveAndEmit → digitalRead berubah.
 * Rangkaian: D2 (INPUT_PULLUP) — tombol — GND. Lepas = 1, tekan = 0.
 */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `pb-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

const SKETCH = `void setup() { pinMode(2, INPUT_PULLUP); }
void loop() { Serial.println(digitalRead(2)); delay(50); }`;

// Placement dibuat SEKALI: penekanan tombol di UI nyata memakai instance
// yang sama (id sama), hanya interactiveState.pressed yang berubah lewat
// circuitStore.interact → syncSim → simSetCircuit.
const PLACEMENT = (() => {
  // Push button menjembatani celah tengah breadboard: jangkar A1 = bank L kolom 4.
  const placement = computePlacement('push-button', terminalHoleId('L', 15, 4), new Set());
  if (!placement) throw new Error('placement push-button gagal');
  return placement;
})();

function buttonParts(pressed: boolean) {
  const instance: ComponentInstanceState = {
    ...PLACEMENT.instance,
    interactiveState: { pressed },
  };
  return {
    parts: {
      boardId: 'uno',
      instances: [instance],
      pinHoles: { [instance.id]: PLACEMENT.pinHoles },
      wires: [
        wire(board('D2'), hole(PLACEMENT.pinHoles.A1)),
        wire(hole(PLACEMENT.pinHoles.B1), board('GND#1')),
      ],
    },
    buttonId: instance.id,
  };
}

async function waitFor(check: () => boolean, timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return check();
}

describe('K11 — push button saat simulasi berjalan (level sesi)', () => {
  it('lepas = digitalRead 1; tekan via setCircuit = 0; lepas lagi = 1', async () => {
    const session = new SimSession();
    let serial = '';
    const snapshots: SimSnapshot[] = [];
    session.setSnapshotListener((snap) => {
      snapshots.push(snap);
      serial += snap.serialChunk;
    });

    const released = buttonParts(false);
    session.setCircuit(released.parts);
    session.startSketch(SKETCH);
    expect(await waitFor(() => serial.includes('1\n'))).toBe(true);

    // Tekan tombol SELAGI sketch berjalan — jalur yang sama dengan
    // circuitStore.interact → syncSim → simSetCircuit.
    const markPress = serial.length;
    session.setCircuit(buttonParts(true).parts);
    expect(
      await waitFor(() => serial.slice(markPress).includes('0\n')),
    ).toBe(true);

    // Snapshot tidak boleh membawa damage/board event palsu dari penekanan.
    expect(snapshots.every((s) => s.damageEvents.length === 0)).toBe(true);
    expect(snapshots.every((s) => s.boardEvents.length === 0)).toBe(true);

    // Lepas lagi → kembali 1.
    const markRelease = serial.length;
    session.setCircuit(buttonParts(false).parts);
    expect(
      await waitFor(() => serial.slice(markRelease).includes('1\n')),
    ).toBe(true);

    session.stopSketch();
  }, 15000);
});
