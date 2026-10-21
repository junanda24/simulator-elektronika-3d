import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';

/**
 * Tes transpiler sketch: hasil transpile dijalankan sungguhan dengan
 * `new Function` (persis kontrak runtime) melawan mock __api yang mencatat
 * semua panggilan. delay/guard mock langsung resolve; guard melempar
 * Error('__stop__') setelah melewati batas panggilan agar loop tak hingga
 * bisa dihentikan secara terkendali oleh tes.
 */

interface RecordedCall {
  fn: string;
  args: unknown[];
}

interface MockOptions {
  digitalReadValue?: number;
  analogReadValue?: number;
  /** Guard melempar '__stop__' setelah panggilan ke-(n+1). */
  guardLimit?: number;
}

interface Harness {
  calls: RecordedCall[];
  printed: string[];
  guardCalls: () => number;
  setup: () => Promise<void>;
  loop: () => Promise<void>;
}

function buildHarness(source: string, opts: MockOptions = {}): Harness {
  const result = transpileSketch(source);
  if (result.code === null) {
    throw new Error(`Transpile gagal: ${result.error}`);
  }
  const calls: RecordedCall[] = [];
  const printed: string[] = [];
  let guardCount = 0;
  const guardLimit = opts.guardLimit ?? Number.POSITIVE_INFINITY;

  const record =
    (fn: string) =>
    async (...args: unknown[]) => {
      calls.push({ fn, args });
    };

  const api = {
    pinMode: record('pinMode'),
    digitalWrite: record('digitalWrite'),
    analogWrite: record('analogWrite'),
    digitalRead: async (pin: unknown) => {
      calls.push({ fn: 'digitalRead', args: [pin] });
      return opts.digitalReadValue ?? 1;
    },
    analogRead: async (pin: unknown) => {
      calls.push({ fn: 'analogRead', args: [pin] });
      return opts.analogReadValue ?? 512;
    },
    delay: record('delay'),
    millis: () => 0,
    guard: async () => {
      guardCount++;
      if (guardCount > guardLimit) throw new Error('__stop__');
    },
    Serial: {
      begin: record('Serial.begin'),
      print: async (value: unknown) => {
        printed.push(String(value ?? ''));
      },
      println: async (value: unknown) => {
        printed.push(String(value ?? ''));
      },
    },
    map: (v: number, a: number, b: number, c: number, d: number) =>
      c + ((d - c) * (v - a)) / (b - a),
    constrain: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)),
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
  };

  const factory = new Function('__api', result.code) as (
    apiArg: unknown,
  ) => Promise<{ setup: () => Promise<void>; loop: () => Promise<void> }>;

  // factory mengembalikan { setup, loop } secara sinkron; await agar tahan
  // terhadap perubahan kontrak yang membuatnya async.
  let fns: { setup: () => Promise<void>; loop: () => Promise<void> } | null =
    null;
  const ready = (async () => {
    fns = await factory(api);
  })();

  return {
    calls,
    printed,
    guardCalls: () => guardCount,
    setup: async () => {
      await ready;
      await fns!.setup();
    },
    loop: async () => {
      await ready;
      await fns!.loop();
    },
  };
}

describe('transpileSketch', () => {
  it('a. Blink: pinMode di setup; urutan digitalWrite/delay di loop', async () => {
    const h = buildHarness(`
      void setup() {
        pinMode(13, OUTPUT);
      }
      void loop() {
        digitalWrite(13, HIGH);
        delay(1000);
        digitalWrite(13, LOW);
        delay(1000);
      }
    `);
    await h.setup();
    expect(h.calls).toEqual([{ fn: 'pinMode', args: [13, 'OUTPUT'] }]);
    h.calls.length = 0;
    await h.loop();
    expect(h.calls).toEqual([
      { fn: 'digitalWrite', args: [13, 1] },
      { fn: 'delay', args: [1000] },
      { fn: 'digitalWrite', args: [13, 0] },
      { fn: 'delay', args: [1000] },
    ]);
  });

  it('b. Hitung: variabel global + for + if menulis jumlah 1..10 = 55 ke Serial', async () => {
    const h = buildHarness(`
      int total = 0;
      void setup() {
        Serial.begin(9600);
      }
      void loop() {
        total = 0;
        for (int i = 1; i <= 10; i++) {
          total += i;
        }
        if (total == 55) {
          Serial.println(total);
        }
      }
    `);
    await h.setup();
    await h.loop();
    expect(h.printed).toEqual(['55']);
  });

  it('c. digitalRead & analogRead: nilai mock mengalir ke variabel global', async () => {
    const h = buildHarness(
      `
      int nilaiDigital = 0;
      int nilaiAnalog = 0;
      void setup() {}
      void loop() {
        nilaiDigital = digitalRead(2);
        nilaiAnalog = analogRead(A0);
        Serial.println(nilaiDigital);
        Serial.println(nilaiAnalog);
      }
    `,
      { digitalReadValue: 1, analogReadValue: 512 },
    );
    await h.setup();
    await h.loop();
    expect(h.printed).toEqual(['1', '512']);
  });

  it('d. while(true) tanpa delay: guard menghentikan, bukan hang', async () => {
    const h = buildHarness(
      `
      void setup() {}
      void loop() {
        while (true) {
        }
      }
    `,
      { guardLimit: 50 },
    );
    await h.setup();
    await expect(h.loop()).rejects.toThrow('__stop__');
    expect(h.guardCalls()).toBeGreaterThan(5);
  });

  it('e. Sintaks salah: kurung tak tertutup -> code null, error menyebut Baris', () => {
    const result = transpileSketch(`
      void setup() {
        pinMode(13, OUTPUT;
      }
      void loop() {}
    `);
    expect(result.code).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('Baris 3');
  });

  it('f. A0 diteruskan ke analogRead sebagai string "A0"', async () => {
    const h = buildHarness(`
      void setup() {}
      void loop() {
        analogRead(A0);
      }
    `);
    await h.setup();
    await h.loop();
    const call = h.calls.find((c) => c.fn === 'analogRead');
    expect(call).toBeDefined();
    expect(call!.args[0]).toBe('A0');
  });

  it('g. Fungsi buatan user di-await dan nilai return-nya mengalir', async () => {
    const h = buildHarness(`
      int kali(int a, int b) {
        return a * b;
      }
      void setup() {}
      void loop() {
        Serial.println(kali(6, 7));
      }
    `);
    await h.setup();
    await h.loop();
    expect(h.printed).toEqual(['42']);
  });

  it('h. #define, array, dan literal char bekerja', async () => {
    const h = buildHarness(`
      #define PIN_LED 13
      int nilai[3] = {10, 20, 30};
      char huruf = 'x';
      void setup() {
        pinMode(PIN_LED, OUTPUT);
      }
      void loop() {
        Serial.println(nilai[0] + nilai[1] + nilai[2]);
        Serial.println(huruf);
      }
    `);
    await h.setup();
    expect(h.calls).toEqual([{ fn: 'pinMode', args: [13, 'OUTPUT'] }]);
    await h.loop();
    expect(h.printed).toEqual(['60', 'x']);
  });

  it('i. loop() tidak ditemukan -> error khusus tanpa nomor baris', () => {
    const result = transpileSketch('void setup() {}');
    expect(result.code).toBeNull();
    expect(result.error).toBe('Fungsi loop() tidak ditemukan di sketch.');
  });
});
