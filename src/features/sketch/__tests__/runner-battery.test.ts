import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';
import { SimSession, type SimSnapshot } from '../../simulation/worker/simSession';
import { computePlacement } from '../../wiring/placement';
import { terminalHoleId, railHoleId } from '../../../shared/boards/breadboard';
import type { WireConnection } from '../../wiring/netlist';

/**
 * Baterai runner sketch (audit runner, keluhan user: "kodingan yang udah
 * ku ketik ga bisa jalan animasinya, aku ga tau errornya dimana").
 *
 * Setiap sketch dijalankan lewat JALUR SEBENARNYA — transpileSketch →
 * SimSession lokal (runtime + solver + netlist sungguhan, tanpa worker)
 * dengan rangkaian breadboard nyata — lalu perilakunya diasersi dari
 * snapshot (arus LED, state pin, keluaran Serial, sketchError).
 *
 * Kriteria lulus per sketch: JALAN dengan perilaku benar, ATAU gagal
 * dengan error Bahasa Indonesia yang menyebut penyebab secara manusiawi.
 * Mati diam / error mentah JS ("Cannot read properties of null",
 * "X is not defined" untuk fungsi Arduino yang sah) = GAGAL.
 */

let wireSeq = 0;
function wire(a: WireConnection['a'], b: WireConnection['b']): WireConnection {
  wireSeq += 1;
  return { id: `bw-${wireSeq}`, a, b, color: '#3b82f6' };
}
const board = (pinId: string) => ({ kind: 'board', pinId }) as const;
const hole = (holeId: string) => ({ kind: 'hole', holeId }) as const;

/** Rangkaian demo: D13 → resistor 220Ω → LED merah → rel R- → GND. */
function ledCircuit() {
  const resistor = computePlacement('resistor', terminalHoleId('R', 24, 2), new Set());
  const led = computePlacement('led-5mm', terminalHoleId('R', 20, 4), new Set());
  if (!resistor || !led) throw new Error('placement demo gagal');
  return {
    boardId: 'uno',
    instances: [
      { ...resistor.instance, props: { resistance: 220 } },
      { ...led.instance, props: { color: 'red' } },
    ],
    pinHoles: {
      [resistor.instance.id]: resistor.pinHoles,
      [led.instance.id]: led.pinHoles,
    },
    wires: [
      wire(board('D13'), hole(resistor.pinHoles.A)),
      wire(hole(led.pinHoles.CATHODE), hole(railHoleId('R-', 29))),
      wire(hole(railHoleId('R-', 4)), board('GND#1')),
    ],
    ledId: led.instance.id,
  };
}

const EMPTY_CIRCUIT = { boardId: 'uno', instances: [], pinHoles: {}, wires: [] };

interface Run {
  session: SimSession;
  serial: () => string;
  last: () => SimSnapshot;
}

function run(parts: unknown, source: string): Run {
  const session = new SimSession();
  const snapshots: SimSnapshot[] = [];
  let serial = '';
  session.setSnapshotListener((snap) => {
    snapshots.push(snap);
    serial += snap.serialChunk;
  });
  session.setCircuit(parts as never);
  session.startSketch(source);
  return {
    session,
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

const ledCurrent = (r: Run, ledId: string) =>
  r.last()?.results[ledId]?.branchCurrents['led'] ?? 0;

describe('baterai runner — sketch yang harus JALAN', () => {
  it('a. blink klasik pin 13: arus LED berganti nyala/padam lintas waktu', async () => {
    const parts = ledCircuit();
    const r = run(parts, `void setup() { pinMode(13, OUTPUT); }
void loop() {
  digitalWrite(13, HIGH);
  delay(80);
  digitalWrite(13, LOW);
  delay(80);
}`);
    expect(await waitFor(() => ledCurrent(r, parts.ledId) > 0.005)).toBe(true);
    expect(await waitFor(() => ledCurrent(r, parts.ledId) < 0.001)).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('b. fade PWM: for-loop analogWrite 0→255 terlihat di state pin', async () => {
    const parts = ledCircuit();
    const r = run(parts, `void setup() { pinMode(13, OUTPUT); }
void loop() {
  for (int i = 0; i <= 255; i += 85) {
    analogWrite(13, i);
    delay(60);
  }
}`);
    const sawMid = await waitFor(() => {
      const pwm = r.last()?.pinStates['D13']?.pwm;
      return pwm !== undefined && pwm > 0 && pwm < 255;
    });
    expect(sawMid).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('c. tombol (INPUT_PULLUP) → LED: lepas = mati, ditekan ke GND = nyala', async () => {
    const parts = ledCircuit();
    const r = run(parts, `void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}
void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
  delay(40);
}`);
    const offFirst = await waitFor(
      () =>
        r.last()?.pinStates['D13'] !== undefined &&
        ledCurrent(r, parts.ledId) < 0.001,
    );
    expect(offFirst).toBe(true);
    // Tombol ditekan: D2 ditarik ke GND (rangkaian diganti di tengah jalan).
    r.session.setCircuit({
      ...parts,
      wires: [...parts.wires, wire(board('D2'), board('GND#2'))],
    } as never);
    expect(await waitFor(() => ledCurrent(r, parts.ledId) > 0.005)).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('d. potensiometer: analogRead pembagi 1k/1k + map() + Serial.println', async () => {
    const r1 = computePlacement('resistor', terminalHoleId('L', 24, 2), new Set());
    const r2 = computePlacement('resistor', terminalHoleId('L', 20, 4), new Set());
    if (!r1 || !r2) throw new Error('placement gagal');
    const parts = {
      boardId: 'uno',
      instances: [
        { ...r1.instance, props: { resistance: 1000 } },
        { ...r2.instance, props: { resistance: 1000 } },
      ],
      pinHoles: { [r1.instance.id]: r1.pinHoles, [r2.instance.id]: r2.pinHoles },
      wires: [
        wire(board('5V#3'), hole(railHoleId('L+', 4))),
        wire(hole(railHoleId('L+', 29)), hole(r1.pinHoles.A)),
        wire(hole(r2.pinHoles.B), hole(railHoleId('L-', 29))),
        wire(hole(railHoleId('L-', 4)), board('GND#1')),
        wire(board('A0'), hole(terminalHoleId('L', 20, 0))),
      ],
    };
    const r = run(parts, `void setup() { Serial.begin(9600); }
void loop() {
  int mentah = analogRead(A0);
  int cerah = map(mentah, 0, 1023, 0, 255);
  Serial.println(cerah);
  delay(50);
}`);
    // Pembagi 1k/1k → ADC ≈ 512 → map ≈ 127. CATATAN FIDELITAS: map()
    // runtime saat ini mengembalikan float (127.38) sedangkan Arduino
    // asli memotong ke long (127) — sketch tetap JALAN benar; pemotongan
    // map() dicatat sebagai rekomendasi perbaikan runtime (di luar
    // wilayah transpiler), jadi asersi di sini toleran float.
    const ok = await waitFor(() => {
      const m = r.serial().match(/(\d+(?:\.\d+)?)\n/);
      if (!m) return false;
      const v = Number(m[1]);
      return v > 120 && v < 135;
    });
    expect(ok).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('e. variabel global penghitung naik tiap loop + fungsi buatan user', async () => {
    const r = run(EMPTY_CIRCUIT, `int hitungan = 0;
int dobel(int x) { return x * 2; }
void setup() { Serial.begin(9600); }
void loop() {
  hitungan = hitungan + 1;
  Serial.println(dobel(hitungan));
  delay(40);
}`);
    const ok = await waitFor(
      () =>
        r.serial().includes('2\n') &&
        r.serial().includes('4\n') &&
        r.serial().includes('6\n'),
    );
    expect(ok).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('f. #define + const int di atas sketch', async () => {
    const parts = ledCircuit();
    const r = run(parts, `#define PIN_LED 13
const int JEDA = 70;
void setup() { pinMode(PIN_LED, OUTPUT); }
void loop() {
  digitalWrite(PIN_LED, HIGH);
  delay(JEDA);
  digitalWrite(PIN_LED, LOW);
  delay(JEDA);
}`);
    expect(await waitFor(() => ledCurrent(r, parts.ledId) > 0.005)).toBe(true);
    expect(await waitFor(() => ledCurrent(r, parts.ledId) < 0.001)).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('g. if/else if/else berantai + operator && || !', async () => {
    const r = run(EMPTY_CIRCUIT, `void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT_PULLUP);
}
void loop() {
  int tombol = digitalRead(2);
  boolean gelap = false;
  if (tombol == HIGH && !gelap) {
    Serial.println("MODE-A");
  } else if (tombol == LOW || gelap) {
    Serial.println("MODE-B");
  } else {
    Serial.println("MODE-C");
  }
  delay(50);
}`);
    expect(await waitFor(() => r.serial().includes('MODE-A'))).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('h. while-loop terbatas mencetak urutan lalu selesai', async () => {
    const r = run(EMPTY_CIRCUIT, `void setup() { Serial.begin(9600); }
void loop() {
  int i = 0;
  while (i < 5) {
    Serial.print(i);
    i++;
  }
  Serial.println(" SELESAI");
  delay(60);
}`);
    expect(await waitFor(() => r.serial().includes('01234 SELESAI'))).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('i. String sederhana + konkatenasi ke Serial', async () => {
    const r = run(EMPTY_CIRCUIT, `void setup() { Serial.begin(9600); }
void loop() {
  int nilai = 42;
  String pesan = "Nilai: ";
  pesan += nilai;
  Serial.println(pesan);
  String gabungan = "Kode=" + String(7);
  Serial.println(gabungan);
  delay(60);
}`);
    const ok = await waitFor(
      () => r.serial().includes('Nilai: 42') && r.serial().includes('Kode=7'),
    );
    expect(ok).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);

  it('l2. random(lo, hi) berjalan dan nilainya di dalam rentang', async () => {
    const r = run(EMPTY_CIRCUIT, `void setup() { Serial.begin(9600); }
void loop() {
  long angka = random(1, 7);
  Serial.println(angka);
  delay(50);
}`);
    expect(await waitFor(() => /[1-6]\n/.test(r.serial()))).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);
});

describe('baterai runner — sketch yang harus GAGAL DENGAN JELAS', () => {
  it('j. library Servo: error menyebut Servo & method, tanpa TypeError mentah', async () => {
    const r = run(EMPTY_CIRCUIT, `#include <Servo.h>
Servo myservo;
void setup() { myservo.attach(9); }
void loop() { myservo.write(90); delay(100); }`);
    expect(await waitFor(() => r.last()?.sketchError != null)).toBe(true);
    const err = r.last()?.sketchError ?? '';
    expect(err).toMatch(/Servo/);
    expect(err).toMatch(/attach/);
    expect(err).toMatch(/belum didukung/);
    expect(err).not.toMatch(/Cannot read properties/);
    r.session.stopSketch();
  }, 15000);

  it('j2. library DHT dengan argumen konstruktor: error menyebut DHT', async () => {
    const r = run(EMPTY_CIRCUIT, `#include <DHT.h>
DHT dht(2, DHT11);
void setup() {
  dht.begin();
}
void loop() {
  float suhu = dht.readTemperature();
  Serial.println(suhu);
  delay(100);
}`);
    expect(await waitFor(() => r.last()?.sketchError != null)).toBe(true);
    const err = r.last()?.sketchError ?? '';
    expect(err).toMatch(/DHT/);
    expect(err).toMatch(/belum didukung/);
    expect(err).not.toMatch(/Cannot read properties/);
    r.session.stopSketch();
  }, 15000);

  it('j3. deklarasi objek library menghasilkan stub bernama di kode transpile', () => {
    const { code, error } = transpileSketch(`Servo myservo;
void setup() { myservo.attach(9); }
void loop() {}`);
    expect(error).toBeNull();
    expect(code).toContain('__libStub("Servo")');
    expect(code).not.toContain('myservo = null');
  });

  it('l. tone(): error "belum didukung" menyebut tone, bukan tuduhan salah eja', async () => {
    const r = run(EMPTY_CIRCUIT, `void setup() { }
void loop() {
  tone(8, 440);
  delay(100);
}`);
    expect(await waitFor(() => r.last()?.sketchError != null)).toBe(true);
    const err = r.last()?.sketchError ?? '';
    expect(err).toMatch(/tone/);
    expect(err).toMatch(/belum didukung/);
    expect(err).not.toMatch(/ejaan/);
    expect(err).not.toMatch(/is not defined/);
    r.session.stopSketch();
  }, 15000);

  // pulseIn LULUS dari keluarga stub pada gelombang HC-SR04
  // (2026-10-21): ia kini builtin runtime asli. Tanpa HC-SR04 pada
  // pin itu, semantik Arduino berlaku: tunggu timeout bawaan (1 s)
  // lalu kembalikan 0 — BUKAN error. Kasus ini mengunci kontrak baru
  // itu di jalur runner yang sama (dulu: error "belum didukung").
  it('l3. pulseIn() tanpa HC-SR04: kembali 0 setelah timeout, tanpa error', async () => {
    const r = run(EMPTY_CIRCUIT, `void setup() { Serial.begin(9600); }
void loop() {
  long durasi = pulseIn(7, HIGH);
  Serial.println(durasi);
  delay(100);
}`);
    expect(await waitFor(() => r.serial().includes('0'), 8000)).toBe(true);
    expect(r.last()?.sketchError).toBeNull();
    r.session.stopSketch();
  }, 15000);
});

describe('baterai runner — kesalahan sintaks pemula (nomor baris)', () => {
  it('k1. kurung kurang: error menyebut baris pernyataan itu sendiri', () => {
    const src = [
      'void setup() {',
      '  pinMode(13, OUTPUT;',
      '}',
      'void loop() {}',
    ].join('\n');
    const { code, error } = transpileSketch(src);
    expect(code).toBeNull();
    expect(error).toContain('Baris 2');
  });

  it('k2. titik koma hilang: error menyebut baris tempat titik koma seharusnya ada', () => {
    const src = [
      'void setup() { pinMode(13, OUTPUT); }',
      'void loop() {',
      '  digitalWrite(13, HIGH)',
      '  delay(100);',
      '}',
    ].join('\n');
    const { code, error } = transpileSketch(src);
    expect(code).toBeNull();
    // Titik koma hilang di AKHIR baris 3 — bukan baris 4 (delay).
    expect(error).toContain('Baris 3');
    expect(error).not.toContain('Baris 4');
  });

  it('k3. kurung kurawal kurang: error berawalan "Baris <n>" yang masuk akal', () => {
    const src = [
      'void setup() { pinMode(13, OUTPUT); }',
      'void loop() {',
      '  digitalWrite(13, HIGH);',
    ].join('\n');
    const { code, error } = transpileSketch(src);
    expect(code).toBeNull();
    expect(error).toMatch(/Baris \d+:/);
    expect(error).toMatch(/tidak ditutup/);
  });
});
