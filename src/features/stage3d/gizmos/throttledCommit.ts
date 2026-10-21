/**
 * Commit interact ter-throttle (pola bersama semua gestur kontinu 3D).
 *
 * Konteks: satu panggilan `interact` di store = objek instance baru +
 * `syncSim` (putaran penuh worker: setCircuit → solve → snapshot →
 * applySnapshot). Penulis gestur mentah (pointermove tanpa batas)
 * membanjiri rantai itu 60–120×/detik — solver kewalahan dan panel
 * gizmo yang sedang dipakai ikut berkedip karena render ulang tanpa
 * henti (lihat SensorGizmo3D & audit flicker 2026-10-21).
 *
 * Semantik pemanggil ter-throttle di sini:
 * - panggilan pertama setelah jendela diam langsung diteruskan
 *   (leading edge — respons terasa seketika),
 * - panggilan berikutnya di dalam jendela `intervalMs` hanya menyimpan
 *   nilai TERAKHIR (trailing state),
 * - begitu jendela berakhir, nilai terakhir diteruskan bila ada yang
 *   menunggu (trailing edge — simulasi tetap live selama gestur),
 * - `flush()` meneruskan nilai menunggu SEKARANG (dipakai saat gestur
 *   selesai, supaya nilai akhir tidak pernah tertinggal/hilang),
 * - `cancel()` membuang nilai menunggu dan menghentikan timer
 *   (dipakai saat komponen unmount).
 *
 * Jam dapat disuntik (`now`, `setTimeout`, `clearTimeout`) agar logika
 * ini bisa dites murni tanpa browser dan tanpa fake-timer global.
 */
export interface ThrottledCaller<TArgs extends unknown[]> {
  call: (...args: TArgs) => void;
  flush: () => void;
  cancel: () => void;
  /** Apakah ada nilai trailing yang belum diteruskan. */
  hasPending: () => boolean;
}

export interface ThrottleClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const systemClock: ThrottleClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createThrottledCaller<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  intervalMs: number,
  clock: ThrottleClock = systemClock,
): ThrottledCaller<TArgs> {
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let pending: TArgs | null = null;
  let timer: unknown = null;

  const clearTimer = () => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
  };

  const sendPending = () => {
    clearTimer();
    if (pending === null) return;
    const args = pending;
    pending = null;
    lastSentAt = clock.now();
    fn(...args);
  };

  const call = (...args: TArgs) => {
    const now = clock.now();
    const elapsed = now - lastSentAt;
    if (elapsed >= intervalMs) {
      // Leading edge: jendela sudah lewat — kirim sekarang. Timer lama
      // (bila masih ada karena jam bergerak mundur) dibersihkan, dan
      // nilai pending yang lebih tua dibuang demi nilai terbaru ini.
      clearTimer();
      pending = null;
      lastSentAt = now;
      fn(...args);
      return;
    }
    pending = args;
    if (timer === null) {
      timer = clock.setTimeout(sendPending, intervalMs - elapsed);
    }
  };

  return {
    call,
    flush: sendPending,
    cancel: () => {
      clearTimer();
      pending = null;
    },
    hasPending: () => pending !== null,
  };
}

/** Kaden commit interact selama gestur kontinu — sama dengan kaden
 * pegas joystick yang sudah terbukti terasa live tanpa membanjiri
 * solver (±33 ms ≈ 30×/detik). */
export const INTERACT_COMMIT_INTERVAL_MS = 33;
