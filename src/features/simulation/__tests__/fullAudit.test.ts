import { beforeAll, describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../worker/simSession';
import { initSim } from '../worker/bridge';
import { useCircuitStore } from '../../wiring/store/circuitStore';
import { computePlacement } from '../../wiring/placement';
import { terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';
import type { WireConnection } from '../../wiring/netlist';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import type { ComponentInstanceState } from '../../../shared/types';

/**
 * FASE 5 — Verifikasi komprehensif SOP audit user (2026-10-21).
 *
 * Lapisan UJUNG-ke-UJUNG di level sesi (SimSession) dan store
 * (useCircuitStore + bridge fallback lokal): melengkapi tes audit
 * per-fase (audit-p1, audit-p2-*, audit-p3-netlist-solver, p4-forensic,
 * push-button-chain), bukan menyalinnya. Setiap skenario SOP dipetakan
 * ke satu describe:
 *  S1 loop tanpa delay 500 ms virtual + Serial terbatas (perbaikan P1/K4)
 *  S2 INPUT_PULLUP + push button pola Modul 3 (inti keluhan user)
 *  S3 eksekusi pin di 4 board (perbaikan P1/K1+K5, P3/K13 demo pin Pico)
 *  S4 rangkaian klasik: LED, transistor, servo PWM, kapasitor DC-tunak
 *  S5 pemulihan kerusakan lewat jalur RESMI (Ganti Komponen) + kunci
 *     desain yang DISENGAJA: Run ulang tanpa mengganti komponen TIDAK
 *     memulihkan kerusakan (kerusakan persisten adalah fitur belajar).
 *
 * Semua ekspektasi angka adalah hitungan tangan dari model komponen:
 * LED merah Vf ±2,07 V / Ron 5 Ω; pin GPIO Thevenin 25 Ω (pinOhms
 * profil); resistor seri sesuai props; servo sudut = rasio V(SIG)
 * terhadap V(VCC) terukur × 180°; kapasitor = bocor dielektrik 10 MΩ.
 */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `fa-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

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
    await new Promise((r) => setTimeout(r, 30));
  }
  return check();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function groundPinId(boardId: string): string {
  const pin = getBoardDefinition(boardId).pins.find((p) => p.kind === 'ground');
  if (!pin) throw new Error(`board ${boardId} tanpa pin ground`);
  return pin.id;
}

function powerPinId(boardId: string, prefix: string): string {
  const pin = getBoardDefinition(boardId).pins.find(
    (p) => p.kind === 'power' && p.id.startsWith(prefix),
  );
  if (!pin) throw new Error(`board ${boardId} tanpa pin daya ${prefix}`);
  return pin.id;
}

/* ================= S1 — loop tanpa delay & Serial terbatas ================= */

describe('S1 — loop tanpa delay selama 500 ms waktu virtual (level sesi)', () => {
  it('pola millis() non-blocking mencapai ±500 tanpa delay() dan tanpa hang', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit({ boardId: 'uno', instances: [], pinHoles: {}, wires: [] });
    session.startSketch(`unsigned long prev = 0;
int level = 0;
void setup() { pinMode(13, OUTPUT); Serial.begin(9600); }
void loop() {
  if (millis() - prev >= 100) {
    prev = millis();
    level = !level;
    digitalWrite(13, level);
    Serial.println(prev);
  }
}`);
    const stamps = () =>
      c
        .serial()
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => /^\d+$/.test(s))
        .map(Number);
    // Jam virtual sesi berjalan mengikuti waktu nyata (advance per tick
    // 16 ms) → cap 500 ms virtual tercapai dalam ±0,5 dtk nyata.
    expect(await waitFor(() => stamps()[stamps().length - 1] >= 500, 6000)).toBe(true);
    const values = stamps();
    expect(values.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    // Pin D13 benar-benar bertukar mengikuti cabang millis (bukan beku).
    expect(c.snapshots.some((s) => s.pinStates['D13']?.high === true)).toBe(true);
    expect(c.snapshots.some((s) => s.pinStates['D13']?.high === false)).toBe(true);
    // Tidak hang: sketch masih hidup, tanpa error, di akhir pengujian.
    expect(c.snapshots.every((s) => s.sketchError === null)).toBe(true);
    expect(c.last().sketchRunning).toBe(true);
    session.stopSketch();
  }, 20000);

  it('banjir Serial dari loop tanpa delay terikat batas laju per tick', async () => {
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit({ boardId: 'uno', instances: [], pinHoles: {}, wires: [] });
    session.startSketch(`void setup() { Serial.begin(9600); }
void loop() { Serial.println("banjir-banjir-banjir-banjir"); }`);
    await sleep(400);
    const chars = c.serial().length;
    // Perilaku lama yang rusak: ±112.500 println/300 ms (≈3,1 jt karakter
    // untuk string ini). Dengan budget 2048 karakter per irisan advance
    // (tick 16 ms), 400 ms nyata berplafon ±55 rb karakter.
    expect(chars).toBeGreaterThan(500); // tetap mengalir — bukan mati total
    expect(chars).toBeLessThan(150000);
    expect(c.last().sketchRunning).toBe(true);
    expect(c.snapshots.every((s) => s.sketchError === null)).toBe(true);
    session.stopSketch();
  }, 20000);
});

/* ============ S2 — INPUT_PULLUP + push button (pola Modul 3) ============ */

describe('S2 — Modul 3 di level sesi: tombol INPUT_PULLUP menggerakkan LED D13', () => {
  it('lepas → digitalRead 1 + LED padam; tekan saat berjalan → 0 + LED menyala; lepas → 1 lagi', async () => {
    const btn = computePlacement('push-button', terminalHoleId('L', 20, 4), new Set());
    const res = computePlacement('resistor', terminalHoleId('R', 30, 2), new Set());
    const led = computePlacement('led-5mm', terminalHoleId('R', 26, 4), new Set());
    if (!btn || !res || !led) throw new Error('placement Modul 3 gagal');

    const parts = (pressed: boolean) => {
      const btnInstance: ComponentInstanceState = {
        ...btn.instance,
        interactiveState: { pressed },
      };
      return {
        boardId: 'uno',
        instances: [
          btnInstance,
          { ...res.instance, props: { resistance: 220 } },
          { ...led.instance, props: { color: 'red' } },
        ],
        pinHoles: {
          [btn.instance.id]: btn.pinHoles,
          [res.instance.id]: res.pinHoles,
          [led.instance.id]: led.pinHoles,
        },
        wires: [
          wire(board('D2'), hole(btn.pinHoles.A1)),
          wire(hole(btn.pinHoles.B1), hole(railHoleId('R-', 15))),
          wire(board('D13'), hole(res.pinHoles.A)),
          wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
          wire(hole(railHoleId('R-', 4)), board('GND#1')),
        ],
      };
    };

    const session = new SimSession();
    const c = collect(session);
    session.setCircuit(parts(false));
    session.startSketch(`void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  int tombol = digitalRead(2);
  Serial.print("TOMBOL=");
  Serial.println(tombol);
  if (tombol == LOW) { digitalWrite(13, HIGH); } else { digitalWrite(13, LOW); }
  delay(50);
}`);
    const ledMa = () =>
      (c.last()?.results[led.instance.id]?.branchCurrents['led'] ?? 0) * 1000;
    const btnA1 = () => c.last()?.results[btn.instance.id]?.pinVoltages['A1'] ?? NaN;

    // Lepas: pull-up 20 kΩ menahan net D2 di ±5 V → terbaca 1, LED padam.
    expect(await waitFor(() => c.serial().includes('TOMBOL=1'))).toBe(true);
    expect(btnA1()).toBeGreaterThan(4.5);
    expect(ledMa()).toBeLessThan(1);

    // Tekan SELAGI berjalan (jalur interact store → setCircuit sesi).
    const markPress = c.serial().length;
    session.setCircuit(parts(true));
    expect(
      await waitFor(() => c.serial().slice(markPress).includes('TOMBOL=0')),
    ).toBe(true);
    // Kontak tombol menarik net D2 ke ±0 V; LED menyala dari D13:
    // I = (5 − 2,07)/(25 + 220 + 5) ≈ 11,7 mA.
    expect(await waitFor(() => ledMa() > 8)).toBe(true);
    expect(ledMa()).toBeLessThan(16);
    expect(btnA1()).toBeLessThan(0.5);

    // Lepas lagi: kembali 1 dan LED padam.
    const markRelease = c.serial().length;
    session.setCircuit(parts(false));
    expect(
      await waitFor(() => c.serial().slice(markRelease).includes('TOMBOL=1')),
    ).toBe(true);
    expect(await waitFor(() => ledMa() < 1)).toBe(true);

    // Penekanan tombol tidak boleh melahirkan event kerusakan palsu.
    expect(c.snapshots.every((s) => s.damageEvents.length === 0)).toBe(true);
    expect(c.snapshots.every((s) => s.boardEvents.length === 0)).toBe(true);
    expect(c.snapshots.every((s) => s.sketchError === null)).toBe(true);
    session.stopSketch();
  }, 20000);
});

/* ================= S3 — eksekusi pin di keempat board ================= */

describe('S3 — pin khas tiap board berjalan tanpa sketchError', () => {
  const BOARDS: Array<{
    id: string;
    /** Argumen analogRead persis seperti yang diketik user (SOP Fase 1). */
    analogArg: string;
    /** Id pin board yang dikabelkan ke rel logika untuk dibaca ADC. */
    analogPinId: string;
    pwrPrefix: string;
    adcMax: number;
    minAdc: number;
    logic: number;
  }> = [
    { id: 'uno', analogArg: 'A0', analogPinId: 'A0', pwrPrefix: '5V', adcMax: 1023, minAdc: 1000, logic: 5 },
    { id: 'esp32', analogArg: '34', analogPinId: 'D34', pwrPrefix: '3V3', adcMax: 4095, minAdc: 3900, logic: 3.3 },
    { id: 'nodemcu', analogArg: 'A0', analogPinId: 'A0', pwrPrefix: '3V3', adcMax: 1023, minAdc: 1000, logic: 3.3 },
    { id: 'pico', analogArg: 'A0', analogPinId: 'A0', pwrPrefix: '3V3', adcMax: 4095, minAdc: 3900, logic: 3.3 },
  ];

  for (const b of BOARDS) {
    it(`${b.id}: LED di pin demo + analogRead(${b.analogArg}) skala penuh`, async () => {
      const def = getBoardDefinition(b.id);
      const res = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
      const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
      if (!res || !led) throw new Error('placement gagal');
      const session = new SimSession();
      const c = collect(session);
      session.setCircuit({
        boardId: b.id,
        instances: [
          { ...res.instance, props: { resistance: 220 } },
          { ...led.instance, props: { color: 'red' } },
        ],
        pinHoles: {
          [res.instance.id]: res.pinHoles,
          [led.instance.id]: led.pinHoles,
        },
        wires: [
          wire(board(def.demoPinId), hole(res.pinHoles.A)),
          wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
          wire(hole(railHoleId('R-', 4)), board(groundPinId(b.id))),
          // Pin analog dikabelkan langsung ke rel logika board → ADC penuh.
          wire(board(b.analogPinId), board(powerPinId(b.id, b.pwrPrefix))),
        ],
      });
      session.startSketch(`void setup() { pinMode(${def.demoPinId}, OUTPUT); Serial.begin(9600); }
void loop() {
  digitalWrite(${def.demoPinId}, HIGH);
  Serial.print("ADC=");
  Serial.println(analogRead(${b.analogArg}));
  delay(70);
}`);
      const adcValues = () =>
        [...c.serial().matchAll(/ADC=(\d+)/g)].map((m) => Number(m[1]));
      expect(await waitFor(() => adcValues().length > 0)).toBe(true);
      const adc = adcValues()[adcValues().length - 1];
      expect(adc).toBeGreaterThanOrEqual(b.minAdc);
      expect(adc).toBeLessThanOrEqual(b.adcMax);

      // Arus LED dari pin demo: I = (Vlogic − 2,07)/(25 + 220 + 5).
      const expected = (b.logic - 2.07) / 250;
      const ledA = () => c.last()?.results[led.instance.id]?.branchCurrents['led'] ?? 0;
      expect(await waitFor(() => ledA() > expected * 0.6)).toBe(true);
      expect(ledA()).toBeLessThan(expected * 1.4);

      expect(c.snapshots.every((s) => s.sketchError === null)).toBe(true);
      expect(c.snapshots.every((s) => s.boardEvents.length === 0)).toBe(true);
      session.stopSketch();
    }, 20000);
  }
});

/* ================= S4 — rangkaian klasik di level sesi ================= */

describe('S4 — rangkaian klasik (solver lewat sesi penuh)', () => {
  it('LED + 220 Ω dari D13: I ≈ (5 − 2,07)/(25 + 220 + 5) ≈ 11,7 mA', async () => {
    const res = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
    const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
    if (!res || !led) throw new Error('placement gagal');
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit({
      boardId: 'uno',
      instances: [
        { ...res.instance, props: { resistance: 220 } },
        { ...led.instance, props: { color: 'red' } },
      ],
      pinHoles: { [res.instance.id]: res.pinHoles, [led.instance.id]: led.pinHoles },
      wires: [
        wire(board('D13'), hole(res.pinHoles.A)),
        wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#1')),
      ],
    });
    session.startSketch(`void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delay(100); }`);
    const ma = () => (c.last()?.results[led.instance.id]?.branchCurrents['led'] ?? 0) * 1000;
    expect(await waitFor(() => ma() > 10.5)).toBe(true);
    expect(ma()).toBeLessThan(13.5);
    expect(c.last()?.results[led.instance.id]?.isDamaged).toBe(false);
    session.stopSketch();
  }, 20000);

  it('transistor NPN menggerakkan LED: Vc jenuh < 0,3 V, I LED ±12,6 mA', async () => {
    const tr = computePlacement('transistor', terminalHoleId('L', 10, 0), new Set());
    const rb = computePlacement('resistor', terminalHoleId('L', 24, 2), new Set());
    const rc = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
    const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
    if (!tr || !rb || !rc || !led) throw new Error('placement gagal');
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit({
      boardId: 'uno',
      instances: [
        { ...tr.instance, props: { beta: 100 } },
        { ...rb.instance, props: { resistance: 10000 } },
        { ...rc.instance, props: { resistance: 220 } },
        { ...led.instance, props: { color: 'red' } },
      ],
      pinHoles: {
        [tr.instance.id]: tr.pinHoles,
        [rb.instance.id]: rb.pinHoles,
        [rc.instance.id]: rc.pinHoles,
        [led.instance.id]: led.pinHoles,
      },
      wires: [
        // Basis: D2 (Thevenin 5 V/25 Ω) → Rb 10 kΩ → B.
        // Ib = (5 − 0,7)/(25 + 10 kΩ + ±25) ≈ 0,43 mA; β·Ib ≈ 43 mA ≫ Ic.
        wire(board('D2'), hole(rb.pinHoles.A)),
        wire(hole(rb.pinHoles.B), hole(tr.pinHoles.B)),
        wire(hole(tr.pinHoles.E), hole(railHoleId('L-', 29))),
        wire(hole(railHoleId('L-', 4)), board('GND#1')),
        // Kolektor: rel 5 V → Rc 220 Ω → strip anoda LED (baris 20 bank R)
        // → katoda LED → C. I = (5 − 2,07 − Vce,sat)/(1 + 220 + 5).
        wire(board('5V#3'), hole(railHoleId('R+', 4))),
        wire(hole(railHoleId('R+', 29)), hole(rc.pinHoles.A)),
        wire(hole(led.pinHoles.CATHODE), hole(tr.pinHoles.C)),
      ],
    });
    session.startSketch(`void setup() { pinMode(2, OUTPUT); }
void loop() { digitalWrite(2, HIGH); delay(100); }`);
    const ledMa = () => (c.last()?.results[led.instance.id]?.branchCurrents['led'] ?? 0) * 1000;
    expect(await waitFor(() => ledMa() > 11)).toBe(true);
    expect(ledMa()).toBeLessThan(14);
    const trResult = c.last()?.results[tr.instance.id];
    expect(trResult?.pinVoltages.C ?? 9).toBeLessThan(0.3);
    expect(trResult?.pinVoltages.C ?? -9).toBeGreaterThanOrEqual(0);
    expect(trResult?.pinVoltages.B ?? 0).toBeGreaterThan(0.6);
    expect(trResult?.pinVoltages.B ?? 9).toBeLessThan(0.85);
    expect(trResult?.isDamaged).toBe(false);
    session.stopSketch();
  }, 20000);

  it('servo PWM: sudut mengikuti rasio SIG terhadap VCC terukur — penuh di Uno 5 V maupun ESP32 3,3 V', async () => {
    const servo = computePlacement('servo', terminalHoleId('L', 15, 0), new Set());
    if (!servo) throw new Error('placement servo gagal');
    const runServo = async (
      boardId: string,
      wires: WireConnection[],
      sketch: string,
      ready: (angle: number) => boolean,
    ): Promise<number> => {
      const session = new SimSession();
      const c = collect(session);
      session.setCircuit({
        boardId,
        instances: [{ ...servo.instance }],
        pinHoles: { [servo.instance.id]: servo.pinHoles },
        wires,
      });
      session.startSketch(sketch);
      const angle = () => c.last()?.results[servo.instance.id]?.branchCurrents['angle'];
      // Snapshot awal (sebelum pin PWM pertama diterapkan) masih membawa
      // sudut 0 — tunggu sampai sudut mencapai kondisi yang diharapkan.
      await waitFor(() => {
        const a = angle();
        return a !== undefined && ready(a);
      }, 4000);
      const value = angle() ?? NaN;
      session.stopSketch();
      return value;
    };

    // Uno: VCC dari rel 5 V; analogWrite 255 → V(SIG) rata-rata 5 V → 180°.
    const unoFull = await runServo(
      'uno',
      [
        wire(board('5V#3'), hole(railHoleId('L+', 4))),
        wire(hole(railHoleId('L+', 29)), hole(servo.pinHoles.VCC)),
        wire(hole(servo.pinHoles.GND), hole(railHoleId('L-', 29))),
        wire(hole(railHoleId('L-', 4)), board('GND#1')),
        wire(board('D9'), hole(servo.pinHoles.SIG)),
      ],
      `void setup() { pinMode(9, OUTPUT); }
void loop() { analogWrite(9, 255); delay(100); }`,
      (a) => a > 170,
    );
    expect(unoFull).toBeGreaterThan(170);

    // Uno duty 128/255: V(SIG) ±2,51 V / 5 V → ±90°.
    const unoHalf = await runServo(
      'uno',
      [
        wire(board('5V#3'), hole(railHoleId('L+', 4))),
        wire(hole(railHoleId('L+', 29)), hole(servo.pinHoles.VCC)),
        wire(hole(servo.pinHoles.GND), hole(railHoleId('L-', 29))),
        wire(hole(railHoleId('L-', 4)), board('GND#1')),
        wire(board('D9'), hole(servo.pinHoles.SIG)),
      ],
      `void setup() { pinMode(9, OUTPUT); }
void loop() { analogWrite(9, 128); delay(100); }`,
      (a) => a > 80,
    );
    expect(unoHalf).toBeGreaterThan(80);
    expect(unoHalf).toBeLessThan(100);

    // ESP32: VCC 3,3 V dan SIG rata-rata 3,3 V → rasio 1 → 180° PENUH
    // (regresi klaim G7: penyebut bukan konstanta 5,0 V).
    const espFull = await runServo(
      'esp32',
      [
        wire(board(powerPinId('esp32', '3V3')), hole(servo.pinHoles.VCC)),
        wire(hole(servo.pinHoles.GND), board(groundPinId('esp32'))),
        wire(board('D13'), hole(servo.pinHoles.SIG)),
      ],
      `void setup() { pinMode(13, OUTPUT); }
void loop() { analogWrite(13, 255); delay(100); }`,
      (a) => a > 170,
    );
    expect(espFull).toBeGreaterThan(170);
  }, 30000);

  it('kapasitor = model DC-tunak TERDOKUMENTASI: tegangan tunak seketika + arus bocor ±0,5 µA, BUKAN pengisian RC', async () => {
    const cap = computePlacement('capacitor', terminalHoleId('L', 15, 2), new Set());
    if (!cap) throw new Error('placement kapasitor gagal');
    const session = new SimSession();
    const c = collect(session);
    session.setCircuit({
      boardId: 'uno',
      instances: [{ ...cap.instance, props: { capacitance: 100, voltageRating: 25 } }],
      pinHoles: { [cap.instance.id]: cap.pinHoles },
      wires: [
        wire(board('5V#3'), hole(railHoleId('R+', 4))),
        wire(hole(railHoleId('R+', 29)), hole(cap.pinHoles.PLUS)),
        wire(hole(cap.pinHoles.MINUS), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#1')),
      ],
    });
    // Sketch diam di delay panjang: snapshot periodik datang dari tick
    // solver untuk komponen dinamis (K10), bukan dari perubahan pin.
    session.startSketch(`void setup() { }
void loop() { delay(5000); }`);
    await sleep(260);
    // Hanya snapshot semasa sketch berjalan (berdaya): snapshot setCircuit
    // sebelum daya menyala memang membawa tegangan 0 dan bukan bagian
    // dari asersi keadaan tunak ini.
    const capSnaps = c.snapshots.filter(
      (s) => s.sketchRunning && s.results[cap.instance.id],
    );
    expect(capSnaps.length).toBeGreaterThanOrEqual(3);
    const plusValues = capSnaps.map(
      (s) => s.results[cap.instance.id]?.pinVoltages.PLUS ?? NaN,
    );
    // Snapshot PERTAMA setelah berdaya sudah di tegangan tunak — model
    // proyek memang tidak mensimulasikan ramp pengisian RC.
    expect(plusValues[0]).toBeGreaterThan(4.9);
    // Dan tegangan itu diam (tak ada kurva pengisian antar-tick).
    const spread = Math.max(...plusValues) - Math.min(...plusValues);
    expect(spread).toBeLessThan(0.01);
    // Arus tunak = arus bocor dielektrik: 5 V / 10 MΩ = 0,5 µA.
    const lastCap = c.last()?.results[cap.instance.id];
    expect(Math.abs(lastCap?.branchCurrents.main ?? 9)).toBeGreaterThan(1e-7);
    expect(Math.abs(lastCap?.branchCurrents.main ?? 9)).toBeLessThan(2e-6);
    expect(lastCap?.isDamaged).toBe(false);
    session.stopSketch();
  }, 20000);
});

/* ===== S5 — pemulihan kerusakan: jalur resmi vs kunci yang disengaja ===== */

describe('S5 — kerusakan & pemulihan di level store (jalur resmi proyek)', () => {
  beforeAll(() => {
    initSim((snapshot) => useCircuitStore.getState().applySnapshot(snapshot));
  });

  it('LED tanpa resistor → rusak + autopsi + simulasi berhenti; Run ulang TIDAK memulihkan; Ganti Komponen + resistor → menyala lagi', async () => {
    useCircuitStore.setState({
      boardId: 'uno',
      instances: [],
      pinHoles: {},
      wires: [],
      running: false,
      autopsy: null,
      activeLessonId: null,
      lessonChecks: [],
      deadPins: [],
      boardFault: false,
      sketchError: null,
    });
    const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
    if (!led) throw new Error('placement LED gagal');
    const ledInstance: ComponentInstanceState = {
      ...led.instance,
      props: { color: 'red' },
    };
    const TRIVIAL = `void setup() { }
void loop() { delay(100); }`;

    // Fase 1 — pelanggaran nyata: LED langsung di rel 5 V tanpa resistor.
    // I = (5 − 2,07)/(1 + 5) ≈ 0,49 A ≫ batas LED_OVERCURRENT 30 mA.
    useCircuitStore.setState({
      instances: [ledInstance],
      pinHoles: { [ledInstance.id]: led.pinHoles },
      wires: [
        wire(board('5V#3'), hole(railHoleId('R+', 4))),
        wire(hole(railHoleId('R+', 29)), hole(led.pinHoles.ANODE)),
        wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#1')),
      ],
      sketchCode: TRIVIAL,
    });
    useCircuitStore.getState().setRunning(true);
    const ledState = () =>
      useCircuitStore.getState().instances.find((i) => i.id === ledInstance.id);
    expect(
      await waitFor(
        () =>
          ledState()?.simState.isDamaged === true &&
          useCircuitStore.getState().autopsy?.instanceId === ledInstance.id &&
          useCircuitStore.getState().running === false,
        6000,
      ),
    ).toBe(true);
    expect(useCircuitStore.getState().autopsy?.report.ruleId).toBe('LED_OVERCURRENT');

    // Fase 2 — KUNCI DESAIN YANG DISENGAJA: menekan Run lagi tanpa
    // mengganti komponen TIDAK memulihkan kerusakan (komponen terbakar
    // tetap terbakar; engine melewati instance rusak saat stamping).
    useCircuitStore.getState().setRunning(true);
    await sleep(600);
    expect(ledState()?.simState.isDamaged).toBe(true);
    expect(ledState()?.simState.branchCurrents['led'] ?? 0).toBeLessThan(0.001);
    useCircuitStore.getState().setRunning(false);

    // Fase 3 — perbaiki rangkaian (resistor 220 Ω seri, pola loadDemo)
    // lalu pulihkan lewat jalur RESMI: replaceInstance ("Ganti Komponen").
    const res = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
    if (!res) throw new Error('placement resistor gagal');
    const damagedLed = ledState();
    if (!damagedLed) throw new Error('instance LED hilang dari store');
    useCircuitStore.setState({
      instances: [
        damagedLed,
        { ...res.instance, props: { resistance: 220 } },
      ],
      pinHoles: {
        [ledInstance.id]: led.pinHoles,
        [res.instance.id]: res.pinHoles,
      },
      wires: [
        wire(board('5V#3'), hole(railHoleId('R+', 4))),
        wire(hole(railHoleId('R+', 29)), hole(res.pinHoles.A)),
        // Strip B resistor (baris 20 bank R) = strip anoda LED — seri.
        wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
        wire(hole(railHoleId('R-', 4)), board('GND#1')),
      ],
    });
    useCircuitStore.getState().replaceInstance(ledInstance.id);
    expect(ledState()?.simState.isDamaged).toBe(false);
    expect(useCircuitStore.getState().autopsy).toBeNull();

    useCircuitStore.getState().setRunning(true);
    const ledMa = () => (ledState()?.simState.branchCurrents['led'] ?? 0) * 1000;
    // I = (5 − 2,07)/(1 + 220 + 5) ≈ 13,0 mA — rangkaian sehat menyala.
    expect(await waitFor(() => ledMa() > 11, 6000)).toBe(true);
    expect(ledMa()).toBeLessThan(14.5);
    expect(ledState()?.simState.isDamaged).toBe(false);
    expect(useCircuitStore.getState().running).toBe(true);
    expect(useCircuitStore.getState().sketchError).toBeNull();
    useCircuitStore.getState().setRunning(false);
  }, 30000);
});
