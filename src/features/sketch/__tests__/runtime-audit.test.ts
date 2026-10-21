import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';
import { explainSketchError, startSketchProgram, type RuntimeHooks } from '../runtime';
import { UNO_PROFILE } from '../../../shared/boards/profiles';

/**
 * Audit robustness runtime: sketch yang memanggil method objek library
 * tak dikenal (ditranspilasi menjadi null) tidak boleh mati diam-diam
 * atau spam error — harus berhenti rapi dengan SATU pesan Bahasa
 * Indonesia yang bisa dimengerti pemula.
 */

async function waitFor(check: () => boolean, timeoutMs = 4000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return check();
}

function makeHooks(errors: string[], onPins?: () => void): RuntimeHooks {
  return {
    onPinStatesChanged: () => onPins?.(),
    pinVolts: () => 0,
    onSerial: () => {},
    isPinDead: () => false,
    onError: (message) => errors.push(message),
  };
}

const SERVO_SKETCH = `#include <Servo.h>
Servo myservo;

void setup() {
  myservo.attach(9);
}

void loop() {
  myservo.write(90);
  delay(100);
}
`;

describe('runtime — objek library null', () => {
  it('Servo: error Bahasa Indonesia, tepat sekali, sketch berhenti', async () => {
    const { code, error } = transpileSketch(SERVO_SKETCH);
    expect(error).toBeNull();
    expect(code).not.toBeNull();

    const errors: string[] = [];
    const control = startSketchProgram(code!, makeHooks(errors), UNO_PROFILE);
    expect(await waitFor(() => errors.length >= 1)).toBe(true);

    // Majukan waktu & beri kesempatan loop berjalan lagi: error TIDAK
    // boleh bertambah (program sudah berhenti, bukan spam tiap loop).
    control.advance(1000);
    await new Promise((r) => setTimeout(r, 200));
    control.advance(1000);
    await new Promise((r) => setTimeout(r, 100));
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/belum didukung simulator/);
    expect(errors[0]).toMatch(/attach/);
    control.stop();
  }, 10000);

  it('sketch normal tanpa library: berjalan tanpa error', async () => {
    const source = `void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
}

void loop() {
  delay(50);
}
`;
    const { code, error } = transpileSketch(source);
    expect(error).toBeNull();
    const errors: string[] = [];
    let pinChanges = 0;
    const control = startSketchProgram(
      code!,
      makeHooks(errors, () => {
        pinChanges += 1;
      }),
      UNO_PROFILE,
    );
    expect(await waitFor(() => pinChanges > 0)).toBe(true);
    control.advance(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(errors).toEqual([]);
    expect(control.getPinStates()['D13']?.high).toBe(true);
    control.stop();
  }, 10000);
});

describe('explainSketchError', () => {
  it('memetakan pola error umum ke Bahasa Indonesia', () => {
    expect(
      explainSketchError(new TypeError("Cannot read properties of null (reading 'readTemperature')")),
    ).toMatch(/belum didukung simulator/);
    expect(explainSketchError(new ReferenceError('suhu is not defined'))).toMatch(
      /tidak dikenal/,
    );
    expect(explainSketchError(new Error('led is not a function'))).toMatch(
      /bukan fungsi/,
    );
    expect(explainSketchError(new Error('ledakan acak'))).toMatch(
      /Sketch berhenti karena error: ledakan acak/,
    );
  });
});
