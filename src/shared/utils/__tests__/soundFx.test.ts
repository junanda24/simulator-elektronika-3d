import { describe, expect, it, vi } from 'vitest';

// localStorage deterministik untuk uji persistensi — lingkungan node
// tidak selalu menyediakannya, dan hasil uji tidak boleh bergantung padanya.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => {
    mem.clear();
  },
  key: () => null,
  length: 0,
});

import {
  isSoundEnabled,
  playBurnPop,
  playClick,
  playSnap,
  setSoundEnabled,
  updateBuzzerTone,
} from '../soundFx';

describe('soundFx — aman tanpa AudioContext (jsdom/node)', () => {
  it('semua fungsi bisa dipanggil tanpa throw', () => {
    expect(() => playSnap()).not.toThrow();
    expect(() => playClick()).not.toThrow();
    expect(() => playClick(1200)).not.toThrow();
    expect(() => playBurnPop()).not.toThrow();
    expect(() => updateBuzzerTone(2400, true)).not.toThrow();
    expect(() => updateBuzzerTone(2400, false)).not.toThrow();
  });
});

describe('soundFx — persistensi preferensi suara', () => {
  it('default aktif; setSoundEnabled tersimpan di localStorage sim3d:sound', () => {
    mem.clear();
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    expect(mem.get('sim3d:sound')).toBe('0');
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    expect(mem.get('sim3d:sound')).toBe('1');
  });

  it('saat suara mati, semua fungsi putar tetap no-op yang aman', () => {
    setSoundEnabled(false);
    expect(() => {
      playSnap();
      playClick();
      playBurnPop();
      updateBuzzerTone(2400, true);
      updateBuzzerTone(2400, false);
    }).not.toThrow();
    setSoundEnabled(true);
  });
});
