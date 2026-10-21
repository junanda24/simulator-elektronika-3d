import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';
import {
  startSketchProgram,
  type RuntimeHooks,
  type SketchControl,
} from '../runtime';

/**
 * Runtime — jam logis + pulseIn analitik (gelombang HC-SR04).
 *
 * Premis yang dikunci: penulisan pin terstempel waktu LOGIS sketch
 * (tenggat tidur), bukan waktu dinding tick — dua write dipisahkan
 * delayMicroseconds(10) selalu berjarak tepat 10 µs. Di atas itulah
 * sesi mengukur TRIG dan menjadwalkan ECHO secara eksak.
 */

interface Harness {
  control: SketchControl;
  stamps: number[];
  serial: () => string;
  error: () => string | null;
}

function runSketch(
  source: string,
  hooksExtra: Partial<RuntimeHooks> = {},
): Harness {
  const { code, error } = transpileSketch(source);
  if (error || !code) throw new Error(`transpile gagal: ${error}`);
  const stamps: number[] = [];
  let serialText = '';
  let errorText: string | null = null;
  const hooks: RuntimeHooks = {
    onPinStatesChanged: (nowUs) => {
      stamps.push(nowUs);
    },
    pinVolts: () => 0,
    onSerial: (text) => {
      serialText += text;
    },
    isPinDead: () => false,
    onError: (message) => {
      errorText = message;
    },
    ...hooksExtra,
  };
  const control = startSketchProgram(code, hooks);
  return {
    control,
    stamps,
    serial: () => serialText,
    error: () => errorText,
  };
}

/** Gerakkan jam dinding sesi beberapa tick sambil menguras microtask. */
async function pump(control: SketchControl, ticks = 12, stepMs = 16): Promise<void> {
  for (let i = 0; i < ticks; i += 1) {
    control.advance(stepMs);
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('runtime — stempel logis penulisan pin', () => {
  it('pulsa TRIG 2 µs + 10 µs terstempel eksak (2 dan 12 µs)', async () => {
    const h = runSketch(`
void setup() { pinMode(7, OUTPUT); }
void loop() {
  digitalWrite(7, LOW);
  delayMicroseconds(2);
  digitalWrite(7, HIGH);
  delayMicroseconds(10);
  digitalWrite(7, LOW);
  delay(100000);
}`);
    await pump(h.control);
    // pinMode (0), LOW (0), HIGH (2), LOW (12) — tenggat, bukan tick.
    expect(h.stamps).toEqual([0, 0, 2, 12]);
    expect(h.error()).toBeNull();
    h.control.stop();
  });
});

describe('runtime — pulseIn analitik', () => {
  it('mengembalikan lebar dari hook sesi dan jam logis maju sebesar blockedUs', async () => {
    const h = runSketch(
      `
void setup() { pinMode(13, OUTPUT); Serial.begin(9600); }
void loop() {
  long d = pulseIn(6, HIGH);
  digitalWrite(13, HIGH);
  Serial.println(d);
  delay(100000);
}`,
      { pulseIn: () => ({ widthUs: 5800, blockedUs: 6050 }) },
    );
    await pump(h.control);
    expect(h.serial()).toContain('5800');
    // Write sesudah pulseIn terstempel tepat 6050 µs (250 jeda + 5800 lebar).
    expect(h.stamps).toContain(6050);
    expect(h.error()).toBeNull();
    h.control.stop();
  });

  it('tanpa perangkat pada pin: hasil 0 dan jam maju sejumlah timeout eksplisit', async () => {
    const h = runSketch(`
void setup() { pinMode(13, OUTPUT); Serial.begin(9600); }
void loop() {
  long d = pulseIn(6, HIGH, 30000);
  digitalWrite(13, HIGH);
  Serial.println(d);
  delay(100000);
}`);
    await pump(h.control);
    expect(h.serial()).toContain('0');
    expect(h.stamps).toContain(30000);
    expect(h.error()).toBeNull();
    h.control.stop();
  });

  it('timeout bawaan Arduino 1 detik bila argumen tidak diberikan', async () => {
    const h = runSketch(`
void setup() { pinMode(13, OUTPUT); }
void loop() {
  long d = pulseIn(6, HIGH);
  digitalWrite(13, HIGH);
  delay(100000);
}`);
    // Satu lompatan dinding besar menyelesaikan tidur timeout sekaligus.
    h.control.advance(1100);
    await new Promise((r) => setTimeout(r, 0));
    await pump(h.control, 3);
    expect(h.stamps).toContain(1_000_000);
    expect(h.error()).toBeNull();
    h.control.stop();
  });
});
