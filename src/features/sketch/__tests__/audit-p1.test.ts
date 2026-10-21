import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';
import { startSketchProgram, type RuntimeHooks } from '../runtime';
import { UNO_PROFILE } from '../../../shared/boards/profiles';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import type { BoardProfile, PinState } from '../../../shared/types';

/**
 * Regresi audit P1 (Fase 1 + Gerbang 2/3) — setiap tes di sini adalah
 * bukti eksekusi untuk satu klaim rencana audit user 2026-10-21:
 *  K1 konstanta pin PREAMBLE, K2 tipe C++, K3 await (disangkal),
 *  K4 guard jam virtual + batas Serial, K5 resolusi pin sadar board,
 *  K6 dirty-check + pull-up-on-write.
 */

async function flush(ms = 40): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

interface RunResult {
  states: () => Record<string, PinState>;
  errors: string[];
  serial: () => string;
  pinReads: string[];
  pinChanges: () => number;
  advance: (ms: number) => void;
  stop: () => void;
}

function runSketch(
  source: string,
  profile: BoardProfile = UNO_PROFILE,
  volts = 0,
): RunResult {
  const { code, error } = transpileSketch(source);
  if (error || !code) throw new Error(`Transpile gagal: ${error}`);
  const errors: string[] = [];
  const pinReads: string[] = [];
  let serialText = '';
  let changes = 0;
  const hooks: RuntimeHooks = {
    onPinStatesChanged: () => {
      changes += 1;
    },
    pinVolts: (pinId) => {
      pinReads.push(pinId);
      return volts;
    },
    onSerial: (t) => {
      serialText += t;
    },
    isPinDead: () => false,
    onError: (m) => errors.push(m),
  };
  const control = startSketchProgram(code, hooks, profile);
  return {
    states: () => control.getPinStates(),
    errors,
    serial: () => serialText,
    pinReads,
    pinChanges: () => changes,
    advance: (ms) => control.advance(ms),
    stop: () => control.stop(),
  };
}

/** Majukan jam virtual dalam irisan 16 ms seperti timer sesi. */
async function driveVirtual(r: RunResult, totalMs: number): Promise<void> {
  for (let t = 0; t < totalMs; t += 16) {
    r.advance(16);
    await flush(2);
  }
  await flush(30);
}

const profileOf = (id: string): BoardProfile => getBoardDefinition(id).profile;

/* ================= K1 — konstanta pin di PREAMBLE ================= */

describe('K1 — identifier pin D*/A6/A7/LED_BUILTIN bisa dieksekusi', () => {
  it('Uno: digitalWrite(D13) & pinMode(D2) memakai identifier, bukan angka', async () => {
    const r = runSketch(`void setup() { pinMode(D13, OUTPUT); pinMode(D2, INPUT_PULLUP); }
void loop() { digitalWrite(D13, HIGH); delay(20); }`);
    await flush();
    expect(r.errors).toEqual([]);
    expect(r.states()['D13']).toEqual({ mode: 'OUTPUT', high: true });
    expect(r.states()['D2']).toEqual({ mode: 'INPUT_PULLUP' });
    r.stop();
  });

  it('ESP32: digitalWrite(D2, HIGH) jalan (dulu ReferenceError: D2)', async () => {
    const r = runSketch(
      `void setup() { pinMode(D2, OUTPUT); }
void loop() { digitalWrite(D2, HIGH); delay(20); }`,
      profileOf('esp32'),
    );
    await flush();
    expect(r.errors).toEqual([]);
    expect(r.states()['D2']?.high).toBe(true);
    r.stop();
  });

  it('NodeMCU: D2 dan Pico: D15 sebagai identifier', async () => {
    const nm = runSketch(
      `void setup() { pinMode(D2, OUTPUT); } void loop() { digitalWrite(D2, HIGH); delay(20); }`,
      profileOf('nodemcu'),
    );
    await flush();
    expect(nm.errors).toEqual([]);
    expect(nm.states()['D2']?.high).toBe(true);
    nm.stop();

    const pico = runSketch(
      `void setup() { pinMode(D15, OUTPUT); } void loop() { digitalWrite(D15, HIGH); delay(20); }`,
      profileOf('pico'),
    );
    await flush();
    expect(pico.errors).toEqual([]);
    expect(pico.states()['D15']?.high).toBe(true);
    pico.stop();
  });

  it('A6/A7 terdefinisi dan LED_BUILTIN tetap 13 → D13', async () => {
    const r = runSketch(`void setup() { pinMode(LED_BUILTIN, OUTPUT); }
void loop() { int a = analogRead(A6); int b = analogRead(A7); digitalWrite(LED_BUILTIN, HIGH); delay(20); }`);
    await flush();
    expect(r.errors).toEqual([]);
    expect(r.pinReads).toContain('A6');
    expect(r.pinReads).toContain('A7');
    expect(r.states()['D13']?.high).toBe(true);
    r.stop();
  });
});

/* ================= K2 — tipe C++ ================= */

describe('K2 — tipe & kualifikasi C++ di semua posisi', () => {
  const okSources: Record<string, string> = {
    'Blink Without Delay (unsigned long)': `const int ledPin = 13;
int ledState = LOW;
unsigned long previousMillis = 0;
const long interval = 100;
void setup() { pinMode(ledPin, OUTPUT); }
void loop() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    ledState = ledState == LOW ? HIGH : LOW;
    digitalWrite(ledPin, ledState);
  }
}`,
    'debounce (unsigned long + INPUT_PULLUP)': `const int pinTombol = 2;
int stateTombol = LOW;
int lastState = LOW;
unsigned long lastDebounce = 0;
unsigned long debounceDelay = 50;
void setup() { pinMode(pinTombol, INPUT_PULLUP); }
void loop() {
  int baca = digitalRead(pinTombol);
  if (baca != lastState) { lastDebounce = millis(); }
  if ((millis() - lastDebounce) > debounceDelay) { stateTombol = baca; }
  lastState = baca;
  delay(5);
}`,
    'for (unsigned int ...)': `void setup() {}
void loop() { for (unsigned int i = 0; i < 3; i++) { Serial.println(i); } delay(10); }`,
    'parameter uint8_t': `void nyala(uint8_t pin) { digitalWrite(pin, HIGH); }
void setup() { pinMode(13, OUTPUT); }
void loop() { nyala(13); delay(10); }`,
    'byte/word/size_t': `byte b = 3; word w = 1000; size_t n = 4;
void setup() {}
void loop() { Serial.println(b + w + n); delay(10); }`,
    'volatile (celah terbukti: dulu gagal transpile)': `volatile int hitung = 0;
void setup() {}
void loop() { hitung++; delay(10); }`,
    'volatile unsigned long parameter & global': `volatile unsigned long cap = 0;
void catat(volatile int x) { cap = x; }
void setup() {}
void loop() { catat(1); delay(10); }`,
  };
  for (const [name, src] of Object.entries(okSources)) {
    it(`transpile OK: ${name}`, () => {
      const { code, error } = transpileSketch(src);
      expect(error).toBeNull();
      expect(code).not.toBeNull();
    });
  }

  it('Blink Without Delay benar-benar berkedip mengikuti jam virtual', async () => {
    const r = runSketch(okSources['Blink Without Delay (unsigned long)']);
    await flush();
    await driveVirtual(r, 400);
    expect(r.errors).toEqual([]);
    // Interval 100 ms di atas grid tick 16 ms sesi: toggle terjadi di
    // ≈112/224/336 ms virtual (prev reset ke waktu resume, bukan grid
    // ideal) → setelah 400 ms pin sudah ≥3 kali bertukar dan HIGH.
    expect(r.pinChanges()).toBeGreaterThanOrEqual(4); // pinMode + ≥3 toggle
    expect(r.states()['D13']?.high).toBe(true);
    r.stop();
  }, 15000);
});

/* ================= K3 — await menyeluruh: DISANGKAL sebagai bug ================= */

describe('K3 — (await ...) pada fungsi sinkron tidak merusak semantik', () => {
  it('ekspresi matematika bertingkat + fungsi user di dalam ekspresi', async () => {
    const r = runSketch(`int kali(int a, int b) { return a * b; }
void setup() { Serial.begin(9600); }
void loop() {
  int v = min(3, max(1, 2)) + (int)pow(2, 3) + kali(2, 3);
  Serial.println(v);
  delay(30);
}`);
    await flush();
    await driveVirtual(r, 64);
    expect(r.errors).toEqual([]);
    // min(3,max(1,2))=2, pow(2,3)=8, kali(2,3)=6 → 16.
    expect(r.serial()).toContain('16\n');
    r.stop();
  }, 15000);
});

/* ================= K4 — guard jam virtual + batas Serial ================= */

describe('K4 — loop tanpa delay terikat jam virtual', () => {
  it('tanpa advance(): loop berhenti menunggu jam virtual (dulu 112.500 println/300ms)', async () => {
    let calls = 0;
    const { code, error } = transpileSketch(`void setup() { Serial.begin(9600); }
void loop() { Serial.println(millis()); }`);
    expect(error).toBeNull();
    const errors: string[] = [];
    const hooks: RuntimeHooks = {
      onPinStatesChanged: () => {},
      pinVolts: () => 0,
      onSerial: () => {
        calls += 1;
      },
      isPinDead: () => false,
      onError: (m) => errors.push(m),
    };
    const control = startSketchProgram(code!, hooks, UNO_PROFILE);
    await flush(250);
    // Guard virtual membatasi putaran per milidetik virtual; tanpa
    // advance, eksekusi harus parkir di waiter — bukan berputar liar.
    expect(calls).toBeLessThan(1000);
    expect(errors).toEqual([]);
    control.stop();
  }, 10000);

  it('pola millis() non-blocking menembakkan cabang berkala seiring advance()', async () => {
    const r = runSketch(`unsigned long prev = 0;
void setup() { Serial.begin(9600); }
void loop() {
  if (millis() - prev >= 100) { prev = millis(); Serial.println(prev); }
}`);
    await flush();
    await driveVirtual(r, 512);
    const values = r
      .serial()
      .split('\n')
      .filter((s) => s.trim() !== '')
      .map(Number);
    expect(r.errors).toEqual([]);
    expect(values.length).toBeGreaterThanOrEqual(4);
    expect(values[values.length - 1]).toBeGreaterThanOrEqual(400);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
    r.stop();
  }, 15000);

  it('banjir Serial dari loop tanpa delay terpotong per tick', async () => {
    let chars = 0;
    const { code } = transpileSketch(`void setup() {}
void loop() { Serial.println("banjir"); }`);
    const errors: string[] = [];
    const hooks: RuntimeHooks = {
      onPinStatesChanged: () => {},
      pinVolts: () => 0,
      onSerial: (t) => {
        chars += t.length;
      },
      isPinDead: () => false,
      onError: (m) => errors.push(m),
    };
    const control = startSketchProgram(code!, hooks, UNO_PROFILE);
    await flush();
    // 10 tick × budget 2048 + jatah awal 2048 = plafon keras.
    for (let i = 0; i < 10; i++) {
      control.advance(16);
      await flush(3);
    }
    expect(chars).toBeLessThanOrEqual(2048 * 11);
    expect(errors).toEqual([]);
    control.stop();
  }, 10000);
});

/* ================= K5 — resolusi pin sadar board ================= */

describe('K5 — pemetaan pin per board', () => {
  it('Uno: analogRead(0)→A0, analogRead(A0)→A0, digitalWrite(A0)→A0, 13→D13', async () => {
    const r = runSketch(`void setup() { pinMode(A0, OUTPUT); pinMode(13, OUTPUT); }
void loop() { int a = analogRead(0); int b = analogRead(A0); digitalWrite(A0, HIGH); digitalWrite(13, HIGH); delay(20); }`);
    await flush();
    expect(r.errors).toEqual([]);
    expect(r.pinReads).toContain('A0');
    expect(r.pinReads).not.toContain('A34');
    expect(r.states()['A0']?.high).toBe(true);
    expect(r.states()['D13']?.high).toBe(true);
    r.stop();
  });

  it('ESP32: analogRead(34)→D34 dan analogRead(D34)→D34 (dulu A34/AD34)', async () => {
    const r = runSketch(
      `void setup() {}
void loop() { int a = analogRead(34); int b = analogRead(D34); int c = analogRead(36); delay(20); }`,
      profileOf('esp32'),
    );
    await flush();
    expect(r.errors).toEqual([]);
    expect(r.pinReads).toContain('D34');
    expect(r.pinReads).toContain('D36');
    expect(r.pinReads).not.toContain('A34');
    expect(r.pinReads).not.toContain('AD34');
    r.stop();
  });

  it('NodeMCU: analogRead(0)→A0; Pico: analogRead(0)→A0 & digitalWrite(15)→D15', async () => {
    const nm = runSketch(
      `void setup() {} void loop() { int a = analogRead(0); int b = analogRead(A0); delay(20); }`,
      profileOf('nodemcu'),
    );
    await flush();
    expect(nm.errors).toEqual([]);
    expect(nm.pinReads.every((p) => p === 'A0')).toBe(true);
    nm.stop();

    const pico = runSketch(
      `void setup() { pinMode(15, OUTPUT); }
void loop() { int a = analogRead(0); digitalWrite(15, HIGH); delay(20); }`,
      profileOf('pico'),
    );
    await flush();
    expect(pico.errors).toEqual([]);
    expect(pico.pinReads).toContain('A0');
    expect(pico.states()['D15']?.high).toBe(true);
    pico.stop();
  });
});

/* ================= K6 — dirty-check & pull-up-on-write ================= */

describe('K6 — dirty-check PinState', () => {
  it('digitalWrite nilai sama berulang tidak memicu solver ulang', async () => {
    const r = runSketch(`void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delay(20); }`);
    await flush();
    const baseline = r.pinChanges();
    expect(baseline).toBeGreaterThan(0);
    await driveVirtual(r, 200);
    // Sepuluh siklus HIGH yang identik: nol panggilan tambahan.
    expect(r.pinChanges()).toBe(baseline);
    expect(r.errors).toEqual([]);
    r.stop();
  }, 15000);

  it('analogWrite duty sama & pinMode sama juga ter-dedup', async () => {
    const r = runSketch(`void setup() { pinMode(9, OUTPUT); }
void loop() { pinMode(9, OUTPUT); analogWrite(9, 128); delay(20); }`);
    await flush();
    const baseline = r.pinChanges();
    await driveVirtual(r, 200);
    expect(r.pinChanges()).toBe(baseline);
    expect(r.states()['D9']).toEqual({ mode: 'OUTPUT', pwm: 128 });
    r.stop();
  }, 15000);
});

describe('K6 — digitalWrite pada pin INPUT mengaktifkan pull-up (semantik Arduino)', () => {
  it('INPUT + write HIGH → INPUT_PULLUP; write LOW → INPUT lagi', async () => {
    const r = runSketch(`void setup() { pinMode(2, INPUT); }
void loop() { digitalWrite(2, HIGH); delay(20); digitalWrite(2, LOW); delay(20); }`);
    await flush();
    expect(r.states()['D2']?.mode).toBe('INPUT_PULLUP');
    r.advance(20);
    await flush(20);
    expect(r.states()['D2']?.mode).toBe('INPUT');
    expect(r.states()['D2']?.mode).not.toBe('OUTPUT');
    expect(r.errors).toEqual([]);
    r.stop();
  }, 10000);

  it('pin tanpa pinMode eksplisit tetap OUTPUT (perilaku lama dipertahankan)', async () => {
    const r = runSketch(`void setup() {}
void loop() { digitalWrite(13, HIGH); delay(20); }`);
    await flush();
    expect(r.states()['D13']).toEqual({ mode: 'OUTPUT', high: true });
    r.stop();
  });
});
