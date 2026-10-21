import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../simSession';
import { terminalHoleId } from '../../../../shared/boards/breadboard';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../../shared/types';
import type { WireConnection } from '../../../wiring/netlist';

/**
 * HC-SR04 — model perangkat di sesi (bab riset §11.4): TRIG dideteksi
 * dari stempel logis runtime, ECHO dijadwalkan analitik, pulseIn
 * mengembalikan jarak × 58 µs EKSAK — bukan kuantisasi tick 16 ms.
 *
 * Rangkaian dibangun manual (pinHoles eksplisit) agar tes ini berdiri
 * sendiri sebelum integrasi registri katalog: net TRIG/VCC digerakkan
 * sumber board lewat kabel, persis seperti di app.
 */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `hw-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

function hcCircuit(
  interactiveState: Record<string, unknown>,
  vccPin = '5V',
) {
  const instance: ComponentInstanceState = {
    id: 'hc1',
    type: 'hc-sr04',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
  const holes = {
    VCC: terminalHoleId('L', 10, 0),
    TRIG: terminalHoleId('L', 12, 0),
    ECHO: terminalHoleId('L', 14, 0),
    GND: terminalHoleId('L', 16, 0),
  };
  return {
    boardId: 'uno',
    instances: [instance],
    pinHoles: { hc1: holes },
    wires: [
      wire(board(vccPin), hole(holes.VCC)),
      wire(board('D7'), hole(holes.TRIG)),
      wire(board('D6'), hole(holes.ECHO)),
      wire(board('GND#1'), hole(holes.GND)),
    ],
  };
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
    count: (needle: string) => serial.split(needle).length - 1,
  };
}

async function waitFor(check: () => boolean, timeoutMs = 8000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return check();
}

const SKETCH_UKUR = `
const int trigPin = 7;
const int echoPin = 6;
void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long durasi = pulseIn(echoPin, HIGH);
  Serial.print("D=");
  Serial.println(durasi);
  Serial.print("J=");
  Serial.println(durasi / 58);
  delay(200);
}`;

describe('SimSession — HC-SR04', () => {
  it('jarak gizmo 100 cm: pulseIn = 5800 µs eksak, konversi cm = 100', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit(hcCircuit({ distanceCm: 100 }));
    session.startSketch(SKETCH_UKUR);
    expect(await waitFor(() => c.serial().includes('D=5800'))).toBe(true);
    expect(c.serial()).toContain('J=100');
    expect(c.last()?.sketchError).toBeNull();

    // Berhenti → mulai lagi: jadwal lama dibersihkan, ukur tetap benar.
    session.stopSketch();
    session.startSketch(SKETCH_UKUR);
    expect(await waitFor(() => c.count('D=5800') >= 2)).toBe(true);
    expect(c.last()?.sketchError).toBeNull();
    session.stopSketch();
  }, 20000);

  it('tanpa rintangan: pulseIn 0 setelah timeout penuh, jam maju sejumlah timeout', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit(hcCircuit({ distanceCm: 100, noObstacle: true }));
    session.startSketch(`
const int trigPin = 7;
const int echoPin = 6;
void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long t0 = millis();
  long durasi = pulseIn(echoPin, HIGH, 30000);
  Serial.print("D=");
  Serial.println(durasi);
  Serial.print("E=");
  Serial.println(millis() - t0);
  delay(200);
}`);
    expect(await waitFor(() => c.serial().includes('D=0'))).toBe(true);
    const m = /E=(\d+)/.exec(c.serial());
    expect(m).not.toBeNull();
    const elapsed = Number(m?.[1]);
    // Timeout 30 ms virtual: jam dinding sesi maju ±30 ms (± satu tick).
    expect(elapsed).toBeGreaterThanOrEqual(10);
    expect(elapsed).toBeLessThanOrEqual(90);
    expect(c.last()?.sketchError).toBeNull();
    session.stopSketch();
  }, 20000);

  it('pulsa TRIG 5 µs (<10 µs) diabaikan: tidak ada ECHO', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit(hcCircuit({ distanceCm: 100 }));
    session.startSketch(`
const int trigPin = 7;
const int echoPin = 6;
void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(5);
  digitalWrite(trigPin, LOW);
  long durasi = pulseIn(echoPin, HIGH, 20000);
  Serial.print("D=");
  Serial.println(durasi);
  delay(200);
}`);
    expect(await waitFor(() => c.serial().includes('D=0'))).toBe(true);
    expect(c.serial()).not.toContain('D=5800');
    expect(c.last()?.sketchError).toBeNull();
    session.stopSketch();
  }, 20000);

  it('picu ulang <60 ms dari pemicu sah diabaikan (anjuran siklus datasheet)', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit(hcCircuit({ distanceCm: 100 }));
    session.startSketch(`
const int trigPin = 7;
const int echoPin = 6;
void picu() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
}
void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}
void loop() {
  picu();
  delay(30);
  picu();
  long durasi = pulseIn(echoPin, HIGH, 25000);
  Serial.print("D=");
  Serial.println(durasi);
  delay(500);
}`);
    // Pemicu pertama sah (jendelanya sudah lewat saat pulseIn dipanggil
    // 30 ms kemudian); pemicu kedua <60 ms WAJIB diabaikan — bila ia
    // diterima, pulseIn akan mengukur 5800 dari jendela barunya.
    expect(await waitFor(() => c.serial().includes('D=0'))).toBe(true);
    expect(c.serial()).not.toContain('D=5800');
    expect(c.last()?.sketchError).toBeNull();
    session.stopSketch();
  }, 20000);

  it('gerbang catu: VCC 3,3 V (<4,5 V) — modul diam, pulseIn timeout 0', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit(hcCircuit({ distanceCm: 100 }, '3V3'));
    session.startSketch(`
const int trigPin = 7;
const int echoPin = 6;
void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long durasi = pulseIn(echoPin, HIGH, 20000);
  Serial.print("D=");
  Serial.println(durasi);
  delay(200);
}`);
    expect(await waitFor(() => c.serial().includes('D=0'))).toBe(true);
    expect(c.serial()).not.toContain('D=5800');
    expect(c.last()?.sketchError).toBeNull();
    session.stopSketch();
  }, 20000);
});
