import { describe, expect, it } from 'vitest';
import {
  createThrottledCaller,
  INTERACT_COMMIT_INTERVAL_MS,
  type ThrottleClock,
} from '../throttledCommit';

/** Jam manual: waktu hanya maju saat tes memintanya; timer ditembak eksplisit. */
function makeManualClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: ThrottleClock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    // Tembak semua timer yang jatuh tempo, berurutan waktu.
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= now)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      due[1].fn();
    }
  };
  return { clock, advance, pendingTimers: () => timers.size };
}

describe('createThrottledCaller — commit interact gestur (audit flicker)', () => {
  it('kaden bersama adalah 33 ms (samakan pegas joystick)', () => {
    expect(INTERACT_COMMIT_INTERVAL_MS).toBe(33);
  });

  it('panggilan pertama diteruskan seketika (leading edge)', () => {
    const { clock } = makeManualClock();
    const sent: number[] = [];
    const t = createThrottledCaller<[number]>((v) => sent.push(v), 33, clock);
    t.call(10);
    expect(sent).toEqual([10]);
    expect(t.hasPending()).toBe(false);
  });

  it('ledakan panggilan dalam satu jendela hanya meneruskan nilai TERAKHIR di trailing edge', () => {
    const { clock, advance } = makeManualClock();
    const sent: number[] = [];
    const t = createThrottledCaller<[number]>((v) => sent.push(v), 33, clock);
    t.call(1); // leading @0
    advance(5);
    t.call(2);
    advance(5);
    t.call(3);
    advance(5);
    t.call(4); // terakhir di jendela pertama
    expect(sent).toEqual([1]); // belum ada trailing
    expect(t.hasPending()).toBe(true);
    advance(18); // total 33 ms sejak leading
    expect(sent).toEqual([1, 4]); // hanya nilai terakhir, bukan 2/3
    expect(t.hasPending()).toBe(false);
  });

  it('setelah trailing, jendela baru dihitung dari pengiriman terakhir', () => {
    const { clock, advance } = makeManualClock();
    const sent: number[] = [];
    const t = createThrottledCaller<[number]>((v) => sent.push(v), 33, clock);
    t.call(1);
    advance(10);
    t.call(2);
    advance(23); // trailing 2 terkirim @33
    expect(sent).toEqual([1, 2]);
    t.call(3); // @33: masih dalam jendela dari @33 → menunggu
    expect(sent).toEqual([1, 2]);
    advance(33); // @66: trailing 3
    expect(sent).toEqual([1, 2, 3]);
    advance(100);
    t.call(4); // jendela lama lewat → leading lagi
    expect(sent).toEqual([1, 2, 3, 4]);
  });

  it('flush() meneruskan nilai menunggu SEKARANG (nilai akhir gestur tak hilang)', () => {
    const { clock, advance } = makeManualClock();
    const sent: number[] = [];
    const t = createThrottledCaller<[number]>((v) => sent.push(v), 33, clock);
    t.call(1);
    advance(4);
    t.call(2);
    t.flush();
    expect(sent).toEqual([1, 2]);
    expect(t.hasPending()).toBe(false);
    advance(100); // timer trailing lama tidak menembak ulang
    expect(sent).toEqual([1, 2]);
  });

  it('flush() tanpa nilai menunggu adalah no-op', () => {
    const { clock } = makeManualClock();
    const sent: number[] = [];
    const t = createThrottledCaller<[number]>((v) => sent.push(v), 33, clock);
    t.flush();
    t.call(7);
    t.flush();
    expect(sent).toEqual([7]);
  });

  it('cancel() membuang nilai menunggu dan menghentikan timer', () => {
    const { clock, advance, pendingTimers } = makeManualClock();
    const sent: number[] = [];
    const t = createThrottledCaller<[number]>((v) => sent.push(v), 33, clock);
    t.call(1);
    advance(4);
    t.call(2);
    t.cancel();
    expect(t.hasPending()).toBe(false);
    expect(pendingTimers()).toBe(0);
    advance(100);
    expect(sent).toEqual([1]);
  });

  it('meneruskan banyak argumen apa adanya (patch alphaX/alphaY joystick)', () => {
    const { clock, advance } = makeManualClock();
    const sent: Array<[number, number]> = [];
    const t = createThrottledCaller<[number, number]>(
      (x, y) => sent.push([x, y]),
      33,
      clock,
    );
    t.call(0.1, 0.9);
    advance(2);
    t.call(0.2, 0.8);
    t.flush();
    expect(sent).toEqual([
      [0.1, 0.9],
      [0.2, 0.8],
    ]);
  });
});
