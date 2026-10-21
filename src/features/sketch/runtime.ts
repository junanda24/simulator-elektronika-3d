import type { BoardProfile, PinMode, PinState } from '../../shared/types';
import { UNO_PROFILE } from '../../shared/boards/profiles';
import { getBoardDefinition } from '../../shared/boards/definitions';

/**
 * Runtime sketch Arduino — menjalankan hasil transpile (transpiler.ts)
 * dengan jam virtual yang digerakkan sesi simulasi lewat advance().
 *
 * Semantik: pinMode/digitalWrite/analogWrite mengubah PinState lalu
 * memberi tahu sesi (lewat onPinStatesChanged) agar solver menghitung
 * ulang secara SINKRON — jadi digitalRead/analogRead tepat setelah tulis
 * membaca tegangan rangkaian terbaru, seperti board asli.
 *
 * Audit P1 (2026-10-21): resolusi pin sadar board aktif (createPinResolver),
 * dirty-check PinState sebelum memicu solver, digitalWrite pada pin
 * INPUT mengaktifkan INPUT_PULLUP ala Arduino, guard() terikat jam
 * virtual, dan emisi Serial dibatasi per tick.
 *
 * HC-SR04 (2026-10-21): runtime memelihara JAM LOGIS sketch di samping
 * jam dinding sesi — jam logis maju tepat sebesar tenggat tidur yang
 * selesai (bukan sebesar lompatan tick ±16 ms yang menyelesaikannya).
 * Setiap penulisan pin dilaporkan ke sesi dengan stempel jam logis µs,
 * sehingga sesi bisa mengukur lebar pulsa TRIG secara eksak (≥10 µs)
 * dan menjadwalkan ECHO secara analitik. pulseIn() memakai jam yang
 * sama: sesi menghitung lebar + lama blokir dari jadwalnya, runtime
 * memajukan jam logis sebesar lama blokir itu — angka pulseIn EKSAK
 * (jarak × 58 µs), bukan kuantisasi tick (±16 ms ≈ ±275 cm bila polling).
 */

export interface RuntimeHooks {
  /**
   * State pin berubah; argumen = stempel waktu virtual (µs, jam logis
   * sketch) saat penulisan terjadi — sesi memakainya untuk mengukur
   * lebar pulsa (TRIG HC-SR04) dan menjadwalkan perangkat waktu.
   */
  onPinStatesChanged: (nowUs: number) => void;
  /** Tegangan net sebuah pin dari solusi solver terakhir. */
  pinVolts: (pinId: string) => number;
  onSerial: (text: string) => void;
  isPinDead: (pinId: string) => boolean;
  onError: (message: string) => void;
  /**
   * Pengukuran pulsa ANALITIK oleh sesi (HC-SR04): diberi pin, level,
   * timeout, dan waktu logis sekarang (µs); mengembalikan lebar pulsa
   * (µs; 0 = timeout) dan lama virtual yang benar-benar terblokir.
   * null = tidak ada perangkat penjadwal pada pin itu (runtime memakai
   * semantik Arduino polos: tunggu timeout penuh, hasil 0).
   */
  pulseIn?: (
    pinId: string,
    level: number,
    timeoutUs: number,
    nowUs: number,
  ) => { widthUs: number; blockedUs: number } | null;
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

/**
 * Batas putaran sibuk per 1 ms virtual (audit P1 K4): guard() yang
 * disisipkan transpiler di awal loop() dan setiap body perulangan tidur
 * 1 ms virtual setelah sejumlah ini — cukup longgar untuk loop hitung
 * yang sah, cukup ketat agar loop tanpa delay tidak membakar CPU.
 */
const GUARD_CALLS_PER_VIRTUAL_MS = 250;

/**
 * Batas karakter Serial per tick sesi (advance) — audit P1 K4. Sketch
 * normal (cetak berkala dengan delay) tidak pernah menyentuhnya; loop
 * tanpa delay yang mencetak terus-menerus terpotong di sini, bukan di
 * buffer sesi / UI.
 */
const SERIAL_BUDGET_PER_TICK = 2048;

/**
 * Resolusi pin SADAR BOARD (audit P1 K5). Runtime menerima BoardProfile
 * board aktif dari sesi; daftar id pin diambil dari definisi board itu.
 *
 * Aturan:
 * - Angka untuk pin analog: pilih `A<n>` bila board punya pin itu,
 *   selain itu `D<n>` bila ada — analogRead(34) di ESP32 menjadi 'D34'
 *   (pin ADC ESP32 memang bernama D34/D35/D36/D39), BUKAN 'A34' yang
 *   tidak ada. Di Uno/NodeMCU/Pico angka analog tetap 'A<n>'.
 * - Angka untuk pin digital: pilih `D<n>` bila ada, selain itu `A<n>`
 *   (pin analog Uno sah dipakai sebagai pin digital).
 * - String: id yang persis ada di board dipakai apa adanya ('A0' untuk
 *   digitalWrite di Uno tetap 'A0' — klaim 'DA0' tidak terbukti pada
 *   kode ini); string angka ('34') diperlakukan seperti angka; string
 *   lain diteruskan (huruf besar dinormalisasi bila cocok dengan board).
 */
function createPinResolver(profile: BoardProfile): (
  pin: unknown,
  kind: 'digital' | 'analog',
) => string {
  const boardPinIds = new Set(
    getBoardDefinition(profile.id).pins.map((p) => p.id),
  );
  const fromNumber = (n: number, kind: 'digital' | 'analog'): string => {
    const d = `D${n}`;
    const a = `A${n}`;
    if (kind === 'analog') {
      if (boardPinIds.has(a)) return a;
      if (boardPinIds.has(d)) return d;
      return a;
    }
    if (boardPinIds.has(d)) return d;
    if (boardPinIds.has(a)) return a;
    return d;
  };
  return (pin, kind) => {
    if (typeof pin === 'number' && Number.isFinite(pin)) {
      return fromNumber(Math.trunc(pin), kind);
    }
    const raw = String(pin).trim();
    if (boardPinIds.has(raw)) return raw;
    const upper = raw.toUpperCase();
    if (boardPinIds.has(upper)) return upper;
    if (/^\d+$/.test(raw)) return fromNumber(Number(raw), kind);
    return raw;
  };
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
  /**
   * Jam logis sketch (ms): waktu sebagaimana dialami kode yang sedang
   * berjalan. Ia maju HANYA lewat penyelesaian tidur, dan tepat sebesar
   * tenggat tidur itu — dua penulisan pin yang dipisahkan
   * delayMicroseconds(10) selalu berjarak tepat 10 µs di jam ini,
   * seberapa pun kasar lompatan tick sesi yang membangunkannya.
   */
  let logicalNowMs = 0;
  let waiters: Array<{ at: number; resolve: () => void }> = [];
  let guardCalls = 0;
  let serialBudget = SERIAL_BUDGET_PER_TICK;

  const resolvePin = createPinResolver(profile);
  const digitalPinId = (pin: unknown) => resolvePin(pin, 'digital');
  const analogPinId = (pin: unknown) => resolvePin(pin, 'analog');

  /**
   * Tidur sampai jam LOGIS mencapai logicalNowMs + ms (mekanisme delay).
   * Tenggat diuji terhadap jam dinding di advance(); saat waiter selesai,
   * jam logis dipasang tepat ke tenggatnya lewat rantai promise — jadi
   * kode yang terbangun selalu melihat waktu yang ia minta, dan
   * penulisan pin berikutnya terstempel eksak.
   */
  const sleepVirtual = (ms: number): Promise<void> => {
    if (stopped || ms === 0) return Promise.resolve();
    const at = logicalNowMs + ms;
    return new Promise<void>((resolve) => {
      waiters.push({ at, resolve });
    }).then(() => {
      logicalNowMs = at;
    });
  };

  /** Beri tahu sesi bahwa state pin berubah, lengkap dengan stempel µs logis. */
  const notifyPinStatesChanged = () => {
    hooks.onPinStatesChanged(Math.round(logicalNowMs * 1000));
  };

  /** Emisi Serial dibatasi per tick sesi agar loop tanpa delay tidak membanjiri UI. */
  const emitSerial = (text: string) => {
    if (!text || serialBudget <= 0) return;
    const slice =
      text.length > serialBudget ? text.slice(0, serialBudget) : text;
    serialBudget -= slice.length;
    hooks.onSerial(slice);
  };

  const samePinState = (a: PinState | undefined, b: PinState): boolean =>
    a !== undefined &&
    a.mode === b.mode &&
    a.high === b.high &&
    a.pwm === b.pwm;

  const writePin = (pinId: string, state: PinState) => {
    if (hooks.isPinDead(pinId)) return; // pin mati tidak merespons lagi
    // Dirty-check (audit P1 K6): state identik tidak memicu solver ulang.
    if (samePinState(pinStates[pinId], state)) return;
    pinStates[pinId] = state;
    notifyPinStatesChanged();
  };

  const api = {
    pinMode(pin: unknown, mode: unknown) {
      const pinId = digitalPinId(pin);
      if (hooks.isPinDead(pinId)) return;
      const nextMode = String(mode) as PinMode;
      const prev = pinStates[pinId];
      // Dirty-check (K6): mode yang sama tidak memicu solver ulang.
      // pinMode hanya mengubah mode — level/PWM tersimpan dipertahankan,
      // seperti register PORT pada hardware asli yang tidak dibersihkan
      // oleh perubahan DDR/pinMode.
      if (prev && prev.mode === nextMode) return;
      pinStates[pinId] = prev ? { ...prev, mode: nextMode } : { mode: nextMode };
      notifyPinStatesChanged();
    },
    digitalWrite(pin: unknown, value: unknown) {
      const pinId = digitalPinId(pin);
      const isHigh = Number(value) !== 0;
      const current = pinStates[pinId];
      // Semantik Arduino asli (audit P1 K6): menulis HIGH ke pin yang
      // secara eksplisit ber-mode INPUT mengaktifkan pull-up internal
      // (mode menjadi INPUT_PULLUP); menulis LOW menonaktifkannya.
      // Pin tanpa pinMode eksplisit / ber-mode OUTPUT tetap berperilaku
      // seperti sebelumnya (OUTPUT) agar sketch pemula tetap jalan.
      if (current && (current.mode === 'INPUT' || current.mode === 'INPUT_PULLUP')) {
        writePin(pinId, { mode: isHigh ? 'INPUT_PULLUP' : 'INPUT' });
        return;
      }
      writePin(pinId, { mode: 'OUTPUT', high: isHigh });
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
    /**
     * pulseIn(pin, level, timeout?) — semantik Arduino, dihitung
     * ANALITIK oleh sesi dari jadwal perangkat (HC-SR04): sesi tahu
     * persis kapan pulsa ECHO naik/turun, jadi lebar yang dikembalikan
     * eksak (jarak × 58 µs) dan jam logis maju sebesar waktu blokir
     * yang sebenarnya (atau timeout penuh bila pulsa tak pernah
     * selesai — hasil 0, persis board asli). Timeout bawaan Arduino
     * 1 detik. BUKAN polling digitalRead: polling akan terkuantisasi
     * tick sesi (±16 ms ≈ ±275 cm) dan itu kebohongan ukur.
     */
    async pulseIn(pin: unknown, level: unknown, timeout?: unknown) {
      const pinId = digitalPinId(pin);
      const targetLevel = Number(level) !== 0 ? 1 : 0;
      const timeoutUs =
        timeout === undefined
          ? 1_000_000
          : Math.max(0, Math.round(Number(timeout) || 0));
      const nowUs = Math.round(logicalNowMs * 1000);
      const measured = hooks.pulseIn?.(pinId, targetLevel, timeoutUs, nowUs);
      const widthUs = measured ? measured.widthUs : 0;
      const blockedUs = measured ? measured.blockedUs : timeoutUs;
      if (blockedUs > 0) await sleepVirtual(blockedUs / 1000);
      return widthUs;
    },
    delay(ms: unknown) {
      return sleepVirtual(Math.max(0, Number(ms) || 0));
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
    /**
     * LOOP_GUARD dari transpiler (audit P1 K4): dulu menyerah lewat
     * setTimeout(0) setiap 1000 panggilan — lepas dari jam virtual,
     * sehingga loop() tanpa delay() berputar ±375 ribu kali/detik nyata
     * sementara millis() membeku di antara tick sesi dan Serial
     * membanjiri buffer (terukur: 112.500 println dalam 300 ms tanpa
     * advance). Sekarang guard MENGANTRE ke mekanisme tunggu virtual
     * yang sama dengan delay(): setelah GUARD_CALLS_PER_VIRTUAL_MS
     * panggilan, eksekusi tidur 1 ms virtual — loop sibuk hanya bisa
     * maju secepat jam simulasi, dan pola millis() non-blocking bekerja
     * tanpa membakar CPU. Semantik delay()/millis() tidak berubah.
     */
    async guard() {
      if (stopped) {
        // Setelah stop, waiter virtual langsung resolve; jaga agar loop
        // liar pasca-stop tetap menyerah ke event loop, bukan microtask.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        return;
      }
      guardCalls += 1;
      if (guardCalls >= GUARD_CALLS_PER_VIRTUAL_MS) {
        guardCalls = 0;
        await sleepVirtual(1);
      }
    },
    Serial: {
      begin() {
        /* baud rate tidak berpengaruh di simulator */
      },
      print(value: unknown) {
        emitSerial(formatSerialValue(value));
      },
      println(value: unknown = '') {
        emitSerial(`${formatSerialValue(value)}\n`);
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
      serialBudget = SERIAL_BUDGET_PER_TICK;
      // Tenggat waiter memakai jam logis; selesaikan berurutan tenggat
      // agar rantai promise memasang jam logis secara monoton.
      const due = waiters
        .filter((w) => w.at <= virtualNow)
        .sort((a, b) => a.at - b.at);
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
