import { describe, expect, it, vi } from 'vitest';

// localStorage deterministik (pola sessionPersistence.test.ts).
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
  CHORD_PROGRESSION,
  DEFAULT_MUSIC_VOLUME,
  LOFI_TEMPO_BPM,
  MELODY_SCALE_MIDI,
  MUSIC_STORAGE_KEY,
  PROGRESSION_BARS,
  STEPS_PER_BAR,
  SWING,
  barDurationSec,
  bassNotesForBar,
  chordAtBar,
  drumHitsForBar,
  getVolume,
  isPlaying,
  melodyForBar,
  midiToFreq,
  readMusicVolume,
  setVolume,
  start,
  stepDurationSec,
  stepOffsetSec,
  stop,
  volumeToGain,
} from '../lofiEngine';

/** PRNG deterministik (mulberry32) untuk tes melodi. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('lofiEngine — data musik murni', () => {
  it('midiToFreq: A4=440, C4≈261,63, F2≈87,31, C2≈65,41', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
    expect(midiToFreq(41)).toBeCloseTo(87.307, 2);
    expect(midiToFreq(36)).toBeCloseTo(65.406, 2);
  });

  it('progresi: 8 bar persis rancangan (ii–V–I–vi + variasi Gm9 & turnaround)', () => {
    expect(PROGRESSION_BARS).toBe(8);
    expect(CHORD_PROGRESSION.map((c) => c.name)).toEqual([
      'Fmaj9',
      'Dm9',
      'Bbmaj9',
      'C13',
      'Fmaj9',
      'Am9',
      'Gm9',
      'C9',
    ]);
  });

  it('semua akor sah: ≥4 nada voicing, semua MIDI di rentang wajar, akar bass rendah', () => {
    for (const chord of CHORD_PROGRESSION) {
      expect(chord.tones.length).toBeGreaterThanOrEqual(4);
      expect(chord.rootMidi).toBeGreaterThanOrEqual(36);
      expect(chord.rootMidi).toBeLessThanOrEqual(48);
      for (const t of chord.tones) {
        expect(t).toBeGreaterThanOrEqual(48);
        expect(t).toBeLessThanOrEqual(72);
        expect(midiToFreq(t)).toBeGreaterThan(100);
      }
    }
    // Voicing pad adalah voicing ROOTLESS khas jazz (akar dibawa bass) —
    // kelas nada tiap bar dikunci persis ke rancangan akornya:
    // Fmaj9 {A,C,E,G} · Dm9 {F,A,C,E} · Bbmaj9 {D,F,A,C} · C13 {E,G,Bb,D} ·
    // Fmaj9 {F,A,C,E} · Am9 {G,B,C,E} · Gm9 {F,A,Bb,D} · C9 {G,Bb,D,E}.
    const expectedClasses = [
      [0, 4, 7, 9],
      [0, 4, 5, 9],
      [0, 2, 5, 9],
      [2, 4, 7, 10],
      [0, 4, 5, 9],
      [0, 4, 7, 11],
      [2, 5, 9, 10],
      [2, 4, 7, 10],
    ];
    CHORD_PROGRESSION.forEach((chord, i) => {
      const classes = chord.tones.map((t) => t % 12).sort((a, b) => a - b);
      expect(classes).toEqual(expectedClasses[i]);
    });
  });

  it('chordAtBar berputar modulo 8 termasuk indeks negatif', () => {
    expect(chordAtBar(0).name).toBe('Fmaj9');
    expect(chordAtBar(8).name).toBe('Fmaj9');
    expect(chordAtBar(9).name).toBe('Dm9');
    expect(chordAtBar(-1).name).toBe('C9');
  });

  it('tempo & grid: 72 BPM → bar ≈3,333 dtk; langkah 16-an ≈0,2083 dtk', () => {
    expect(LOFI_TEMPO_BPM).toBe(72);
    expect(barDurationSec()).toBeCloseTo(10 / 3, 4);
    expect(stepDurationSec()).toBeCloseTo(0.20833, 4);
    expect(STEPS_PER_BAR).toBe(16);
  });

  it('stepOffsetSec: langkah genap tepat di grid, ganjil digeser swing, monoton naik', () => {
    const d = stepDurationSec();
    expect(stepOffsetSec(0)).toBe(0);
    expect(stepOffsetSec(2)).toBeCloseTo(2 * d, 6);
    expect(stepOffsetSec(1)).toBeCloseTo(d * (1 + SWING), 6);
    expect(stepOffsetSec(3)).toBeCloseTo(d * (3 + SWING), 6);
    let prev = -1;
    for (let s = 0; s < STEPS_PER_BAR; s += 1) {
      const off = stepOffsetSec(s);
      expect(off).toBeGreaterThan(prev);
      expect(off).toBeLessThan(barDurationSec());
      prev = off;
    }
  });

  it('drum: snare selalu di 4 & 12, kick mulai di 0, hat di semua langkah genap', () => {
    for (let bar = 0; bar < 8; bar += 1) {
      const hits = drumHitsForBar(bar, () => 0.99);
      const snares = hits.filter((h) => h.kind === 'snare').map((h) => h.step);
      expect(snares).toEqual([4, 12]);
      const kicks = hits.filter((h) => h.kind === 'kick').map((h) => h.step);
      expect(kicks[0]).toBe(0);
      expect(kicks).toContain(10);
      if (bar % 2 === 1) expect(kicks).toContain(7);
      const hats = hits.filter((h) => h.kind === 'hat').map((h) => h.step);
      expect(hats).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
      for (const h of hits) {
        expect(h.step).toBeGreaterThanOrEqual(0);
        expect(h.step).toBeLessThan(16);
        expect(h.velocity).toBeGreaterThan(0);
        expect(h.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('drum: hat hantu langkah 15 hanya bila rng < 0,4', () => {
    const withGhost = drumHitsForBar(0, () => 0);
    expect(withGhost.some((h) => h.kind === 'hat' && h.step === 15)).toBe(true);
    const without = drumHitsForBar(0, () => 0.99);
    expect(without.some((h) => h.step === 15)).toBe(false);
  });

  it('bass: mulai di akar pada langkah 0, semua nada dalam oktaf akar, durasi positif', () => {
    for (let bar = 0; bar < 8; bar += 1) {
      const chord = chordAtBar(bar);
      const notes = bassNotesForBar(bar, chord);
      expect(notes[0]).toMatchObject({ step: 0, midi: chord.rootMidi });
      for (const n of notes) {
        expect(n.midi).toBeGreaterThanOrEqual(chord.rootMidi);
        expect(n.midi).toBeLessThanOrEqual(chord.rootMidi + 12);
        expect(n.durSteps).toBeGreaterThan(0);
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('melodi: rng selalu-gagal → kosong; rng selalu-lolos → ≤4 nada sah', () => {
    const chord = chordAtBar(0);
    expect(melodyForBar(0, chord, () => 0.999)).toEqual([]);
    const notes = melodyForBar(0, chord, () => 0);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.length).toBeLessThanOrEqual(4);
    const allowed = new Set([
      ...MELODY_SCALE_MIDI,
      ...chord.tones.map((t) => t + 12),
    ]);
    for (const n of notes) {
      expect(allowed.has(n.midi)).toBe(true);
      expect([2, 3, 6, 7, 10, 11, 14]).toContain(n.step);
      expect(n.velocity).toBeGreaterThan(0);
      expect(n.velocity).toBeLessThanOrEqual(0.4);
      expect(n.durSteps).toBeGreaterThanOrEqual(1);
      expect(n.durSteps).toBeLessThanOrEqual(3);
    }
  });

  it('melodi deterministik untuk rng ber-seed sama', () => {
    const chord = chordAtBar(3);
    const a = melodyForBar(3, chord, mulberry32(42));
    const b = melodyForBar(3, chord, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('volumeToGain: 0→0, 1→0,9, monoton, terjepit di luar rentang', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBeCloseTo(0.9, 6);
    expect(volumeToGain(0.5)).toBeCloseTo(0.225, 6);
    expect(volumeToGain(2)).toBeCloseTo(0.9, 6);
    expect(volumeToGain(-1)).toBe(0);
  });
});

describe('lofiEngine — persistensi volume & keamanan tanpa AudioContext', () => {
  it('bawaan 0,7 bila belum ada simpanan', () => {
    mem.clear();
    expect(readMusicVolume()).toBe(DEFAULT_MUSIC_VOLUME);
  });

  it('setVolume menyimpan ke sim3d:music dan terbaca kembali; nilai dijepit 0..1', () => {
    setVolume(0.5);
    expect(mem.get(MUSIC_STORAGE_KEY)).toBe('0.5');
    expect(readMusicVolume()).toBe(0.5);
    expect(getVolume()).toBe(0.5);
    setVolume(2);
    expect(readMusicVolume()).toBe(1);
    setVolume(-0.5);
    expect(readMusicVolume()).toBe(0);
  });

  it('simpanan rusak (bukan angka) jatuh ke bawaan, bukan NaN', () => {
    mem.set(MUSIC_STORAGE_KEY, 'bukan-angka');
    expect(readMusicVolume()).toBe(DEFAULT_MUSIC_VOLUME);
    mem.delete(MUSIC_STORAGE_KEY);
    setVolume(0.7);
  });

  it('tanpa AudioContext (node env): start() false, isPlaying() false, stop() tidak melempar', () => {
    expect(() => stop()).not.toThrow();
    expect(start()).toBe(false);
    expect(isPlaying()).toBe(false);
    expect(() => setVolume(0.3)).not.toThrow();
    expect(getVolume()).toBe(0.3);
    setVolume(0.7);
  });

  it('modul MusicControl bisa diimpor dengan aman di node env (tanpa DOM/AudioContext)', async () => {
    const mod = await import('../MusicControl');
    expect(typeof mod.default).toBe('function');
  });
});
