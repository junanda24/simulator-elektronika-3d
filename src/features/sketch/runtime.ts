import type { BoardProfile, PinMode, PinState } from '../../shared/types';
import { UNO_PROFILE } from '../../shared/boards/profiles';

/**
 * Runtime sketch Arduino — menjalankan hasil transpile (transpiler.ts)
 * dengan jam virtual yang digerakkan sesi simulasi lewat advance().
 *
 * Semantik: pinMode/digitalWrite/analogWrite mengubah PinState lalu
 * memberi tahu sesi (lewat onPinStatesChanged) agar solver menghitung
 * ulang secara SINKRON — jadi digitalRead/analogRead tepat setelah tulis
 * membaca tegangan rangkaian terbaru, seperti board asli.
 */

export interface RuntimeHooks {
  onPinStatesChanged: () => void;
  /** Tegangan net sebuah pin dari solusi solver terakhir. */
  pinVolts: (pinId: string) => number;
  onSerial: (text: string) => void;
  isPinDead: (pinId: string) => boolean;
  onError: (message: string) => void;
  /**
   * Baris sumber (1-based) yang mulai dieksekusi — dipanggil kode hasil
   * transpile lewat builtin `__line(n)` di setiap batas pernyataan.
   * Opsional: sesi yang tidak peduli sorot baris boleh tidak mengisinya.
   */
  onLine?: (line: number) => void;
}

export interface SketchControl {
  /** Majukan jam virtual; menyelesaikan delay() yang jatuh tempo. */
  advance: (deltaMs: number) => void;
  stop: () => void;
  isStopped: () => boolean;
  getPinStates: () => Record<string, PinState>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pin digital ditulis sebagai angka (13) atau id ('D13'/'A0'). */
function digitalPinId(pin: unknown): string {
  if (typeof pin === 'number') return `D${pin}`;
  return String(pin);
}

/** analogRead memakai penomoran analog: 0 → 'A0'. */
function analogPinId(pin: unknown): string {
  if (typeof pin === 'number') return `A${pin}`;
  return String(pin);
}

/**
 * Terjemahkan error runtime JavaScript menjadi pesan Bahasa Indonesia
 * yang bisa dimengerti pemula. Kasus terpenting: transpiler menjadikan
 * deklarasi library tak dikenal (Servo, DHT, LiquidCrystal, ...) sebagai
 * `null`; memanggil method-nya melempar "Cannot read properties of null"
 * yang tidak berarti apa-apa bagi siswa — jelaskan sebab & obatnya.
 * Pesan mentah tetap disertakan sebagai detail teknis.
 */
export function explainSketchError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/Cannot read propert(?:y|ies) of (?:null|undefined)/.test(raw)) {
    const fn = /reading '([^']+)'/.exec(raw)?.[1];
    const call = fn ? `Fungsi '${fn}'` : 'Sebuah fungsi';
    return (
      `${call} dipanggil pada objek library yang belum didukung simulator ` +
      `(Servo, DHT, LCD, dan sejenisnya masih kosong/null di simulator), ` +
      `jadi sketch berhenti. Sementara ini pakai fungsi bawaan dasar dulu: ` +
      `pinMode, digitalWrite, analogWrite, digitalRead, analogRead, Serial, ` +
      `delay, millis. (Detail teknis: ${raw})`
    );
  }

  const notDefined = /(\w+) is not defined/.exec(raw);
  if (notDefined) {
    return (
      `Nama '${notDefined[1]}' tidak dikenal — periksa lagi ejaannya dan ` +
      `pastikan variabel/fungsi itu sudah dideklarasikan sebelum dipakai. ` +
      `Sketch berhenti. (Detail teknis: ${raw})`
    );
  }

  const notFunction = /([\w.]+) is not a function/.exec(raw);
  if (notFunction) {
    return (
      `'${notFunction[1]}' bukan fungsi yang bisa dipanggil di simulator — ` +
      `kemungkinan itu objek library yang belum didukung (Servo, DHT, LCD, ` +
      `dan sejenisnya masih kosong/null). Sketch berhenti. ` +
      `(Detail teknis: ${raw})`
    );
  }

  return `Sketch berhenti karena error: ${raw}`;
}

/** Format cetak Serial ala Arduino: float selalu 2 desimal. */
function formatSerialValue(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value === undefined || value === null) return '';
  return String(value);
}

export function startSketchProgram(
  transpiledCode: string,
  hooks: RuntimeHooks,
  profile: BoardProfile = UNO_PROFILE,
): SketchControl {
  const pinStates: Record<string, PinState> = {};
  let stopped = false;
  let virtualNow = 0;
  let waiters: Array<{ at: number; resolve: () => void }> = [];
  let guardCalls = 0;

  const writePin = (pinId: string, state: PinState) => {
    if (hooks.isPinDead(pinId)) return; // pin mati tidak merespons lagi
    pinStates[pinId] = state;
    hooks.onPinStatesChanged();
  };

  const api = {
    pinMode(pin: unknown, mode: unknown) {
      const pinId = digitalPinId(pin);
      if (hooks.isPinDead(pinId)) return;
      pinStates[pinId] = { mode: String(mode) as PinMode };
      hooks.onPinStatesChanged();
    },
    digitalWrite(pin: unknown, value: unknown) {
      writePin(digitalPinId(pin), { mode: 'OUTPUT', high: Number(value) !== 0 });
    },
    analogWrite(pin: unknown, duty: unknown) {
      const pwm = clamp(Math.round(Number(duty) || 0), 0, 255);
      writePin(digitalPinId(pin), { mode: 'OUTPUT', pwm });
    },
    digitalRead(pin: unknown) {
      const volts = hooks.pinVolts(digitalPinId(pin));
      return volts >= profile.digitalThresholdVolts ? 1 : 0;
    },
    analogRead(pin: unknown) {
      const volts = hooks.pinVolts(analogPinId(pin));
      const maxCount = 2 ** profile.adcBits - 1;
      return Math.round(clamp(volts / profile.adcRefVolts, 0, 1) * maxCount);
    },
    delay(ms: unknown) {
      const duration = Math.max(0, Number(ms) || 0);
      if (stopped || duration === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        waiters.push({ at: virtualNow + duration, resolve });
      });
    },
    millis() {
      return Math.floor(virtualNow);
    },
    /**
     * Penanda baris eksekusi dari transpiler (`__line(n);` sebelum tiap
     * pernyataan). Sinkron dan murah: hanya meneruskan ke hooks sesi.
     */
    __line(line: number) {
      hooks.onLine?.(line);
    },
    /** LOOP_GUARD dari transpiler: serahkan kendali berkala agar worker tidak membeku. */
    async guard() {
      guardCalls += 1;
      if (guardCalls % 1000 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    },
    Serial: {
      begin() {
        /* baud rate tidak berpengaruh di simulator */
      },
      print(value: unknown) {
        hooks.onSerial(formatSerialValue(value));
      },
      println(value: unknown = '') {
        hooks.onSerial(`${formatSerialValue(value)}\n`);
      },
      available() {
        return 0;
      },
      read() {
        return -1;
      },
    },
    // Arduino memetakan dengan aritmetika long: hasilnya bilangan bulat
    // yang DIPOTONG (bukan dibulatkan) — disamakan agar angka yang
    // tercetak di Serial cocok dengan board asli.
    map: (x: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
      Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin),
    constrain: (x: number, min: number, max: number) => clamp(x, min, max),
    min: Math.min,
    max: Math.max,
    abs: Math.abs,
  };

  void (async () => {
    try {
      const factory = new Function('__api', transpiledCode) as (
        apiArg: typeof api,
      ) => Promise<{
        setup: () => Promise<void>;
        loop: () => Promise<void>;
      }>;
      const program = await factory(api);
      if (!program || typeof program.setup !== 'function' || typeof program.loop !== 'function') {
        throw new Error('Sketch tidak menghasilkan fungsi setup() dan loop() yang valid.');
      }
      await program.setup();
      while (!stopped) {
        await program.loop();
        await api.guard();
      }
    } catch (error) {
      if (!stopped) {
        hooks.onError(explainSketchError(error));
      }
    }
  })();

  return {
    advance(deltaMs: number) {
      virtualNow += deltaMs;
      const due = waiters.filter((w) => w.at <= virtualNow);
      waiters = waiters.filter((w) => w.at > virtualNow);
      for (const waiter of due) waiter.resolve();
    },
    stop() {
      stopped = true;
      const pending = waiters;
      waiters = [];
      for (const waiter of pending) waiter.resolve();
    },
    isStopped: () => stopped,
    getPinStates: () => pinStates,
  };
}
