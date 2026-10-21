import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../simSession';

/**
 * Sorot baris eksekusi (RASA-2) lewat jalur Run asli: sketch blink
 * dijalankan SimSession sungguhan (transpile → runtime → snapshot),
 * dan currentLine pada snapshot harus berpindah mengikuti pernyataan
 * yang sedang dieksekusi, lalu null setelah stop/error.
 */

const LINE_HIGH = 5;
const LINE_LOW = 7;

const BLINK = [
  'void setup() {', //              baris 1
  '  pinMode(13, OUTPUT);', //      baris 2
  '}', //                           baris 3
  'void loop() {', //               baris 4
  '  digitalWrite(13, HIGH);', //   baris 5
  '  delay(120);', //               baris 6
  '  digitalWrite(13, LOW);', //    baris 7
  '  delay(120);', //               baris 8
  '}', //                           baris 9
].join('\n');

function collect(session: SimSession) {
  const snapshots: SimSnapshot[] = [];
  session.setSnapshotListener((snap) => {
    snapshots.push(snap);
  });
  return {
    snapshots,
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

const EMPTY_CIRCUIT = { boardId: 'uno', instances: [], pinHoles: {}, wires: [] };

describe('SimSession — currentLine (sorot baris eksekusi)', () => {
  it('blink: currentLine berpindah antara baris HIGH dan LOW, lalu null setelah stop', async () => {
    const session = new SimSession();
    const { snapshots, last } = collect(session);
    session.setCircuit(EMPTY_CIRCUIT);
    session.startSketch(BLINK);

    const sawHigh = await waitFor(() =>
      snapshots.some((s) => s.currentLine === LINE_HIGH),
    );
    expect(sawHigh).toBe(true);
    const sawLow = await waitFor(() =>
      snapshots.some((s) => s.currentLine === LINE_LOW),
    );
    expect(sawLow).toBe(true);

    session.stopSketch();
    expect(last().currentLine).toBeNull();
    expect(last().sketchRunning).toBe(false);
  }, 15000);

  it('error runtime: currentLine null pada snapshot error', async () => {
    const session = new SimSession();
    const { last } = collect(session);
    session.setCircuit(EMPTY_CIRCUIT);
    // tone() adalah stub "belum didukung" — melempar pada eksekusi pertama.
    session.startSketch(
      [
        'void setup() { }',
        'void loop() {',
        '  tone(8, 440, 100);',
        '  delay(50);',
        '}',
      ].join('\n'),
    );
    const errored = await waitFor(() => last()?.sketchError !== null);
    expect(errored).toBe(true);
    expect(last().sketchError).toContain('tone');
    expect(last().currentLine).toBeNull();
    session.stopSketch();
  }, 15000);
});
