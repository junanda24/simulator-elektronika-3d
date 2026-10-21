/**
 * Mesin musik jazz lofi GENERATIF — Web Audio API murni, TANPA file
 * audio eksternal dan tanpa dependensi baru. Seluruh bunyi disintesis
 * di browser saat runtime: pad akor bergaya Rhodes, bass sub lembut,
 * drum lofi (kick/snare/hat dari osilator + noise terfilter), melodi
 * pentatonik probabilistik, dan desis vinyl (crackle) sangat pelan.
 *
 * Keputusan produk: musik generatif dipilih agar tidak ada risiko
 * tautan mati, iklan, atau lagu berhak cipta — progresi akor ditulis
 * sendiri di sini sebagai DATA MURNI (bisa dites di node env tanpa
 * AudioContext), lapisan WebAudio hanya menerjemahkannya jadi bunyi.
 *
 * Keamanan mengikuti pola soundFx: AudioContext dibuat malas (lazy
 * singleton milik engine ini, terpisah dari soundFx), semua akses di
 * dalam try/catch, dan tanpa AudioContext semua fungsi menjadi no-op
 * yang aman. Musik SELALU mulai dari mati (kebijakan autoplay browser
 * melarang bunyi sebelum gestur pengguna) — yang diingat antar sesi
 * hanya volumenya (kunci `sim3d:music`, pola uiSettings).
 */

// ---------------------------------------------------------------------
// Lapisan data murni — teori musik & pola (dites tanpa AudioContext)
// ---------------------------------------------------------------------

/** Tempo lofi: 72 BPM, 4 ketukan per bar, grid 16 langkah per bar. */
export const LOFI_TEMPO_BPM = 72;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BAR = 16;
/** Langkah ganjil digeser mundur sebesar fraksi ini dari satu langkah. */
export const SWING = 0.16;

export const MUSIC_STORAGE_KEY = 'sim3d:music';
export const DEFAULT_MUSIC_VOLUME = 0.7;

/** Frekuensi dari nomor nada MIDI (A4 = 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function secondsPerBeat(bpm: number = LOFI_TEMPO_BPM): number {
  return 60 / bpm;
}

export function stepDurationSec(bpm: number = LOFI_TEMPO_BPM): number {
  return secondsPerBeat(bpm) / 4;
}

export function barDurationSec(bpm: number = LOFI_TEMPO_BPM): number {
  return secondsPerBeat(bpm) * BEATS_PER_BAR;
}

/**
 * Offset waktu (detik dari awal bar) untuk langkah ke-`step`, dengan
 * swing: langkah ganjil (off-beat 16-an) dimainkan sedikit terlambat.
 */
export function stepOffsetSec(step: number, bpm: number = LOFI_TEMPO_BPM): number {
  const stepDur = stepDurationSec(bpm);
  return step * stepDur + (step % 2 === 1 ? SWING * stepDur : 0);
}

export interface LofiChord {
  /** Nama akor untuk manusia (dan kunci desain di tes). */
  name: string;
  /** Nada MIDI akar untuk bass (oktaf rendah, 36–46). */
  rootMidi: number;
  /** Voicing pad Rhodes (nada MIDI, rentang tengah 50–67). */
  tones: number[];
}

/**
 * Progresi 8 bar di F mayor — tulang punggungnya ii–V–I–vi dengan
 * variasi agar tidak monoton: putaran pertama Fmaj9–Dm9–Bbmaj9–C13,
 * putaran kedua mengganti Dm9 kedua dengan Gm9 dan menutup dengan
 * voicing C9 yang lebih tinggi (turnaround terangkat).
 */
export const CHORD_PROGRESSION: LofiChord[] = [
  { name: 'Fmaj9', rootMidi: 41, tones: [57, 60, 64, 67] },
  { name: 'Dm9', rootMidi: 38, tones: [53, 57, 60, 64] },
  { name: 'Bbmaj9', rootMidi: 46, tones: [50, 53, 57, 60] },
  { name: 'C13', rootMidi: 36, tones: [52, 55, 58, 62] },
  { name: 'Fmaj9', rootMidi: 41, tones: [53, 57, 60, 64] },
  { name: 'Am9', rootMidi: 45, tones: [55, 59, 60, 64] },
  { name: 'Gm9', rootMidi: 43, tones: [53, 57, 58, 62] },
  { name: 'C9', rootMidi: 36, tones: [55, 58, 62, 64] },
];

export const PROGRESSION_BARS = CHORD_PROGRESSION.length;

export function chordAtBar(barIndex: number): LofiChord {
  const n = CHORD_PROGRESSION.length;
  return CHORD_PROGRESSION[((barIndex % n) + n) % n];
}

/** Tangga melodi: pentatonik F mayor + nada warna E (nada ke-7). */
export const MELODY_SCALE_MIDI: number[] = [65, 67, 69, 72, 74, 76, 77];

export type DrumKind = 'kick' | 'snare' | 'hat';

export interface DrumHit {
  step: number;
  kind: DrumKind;
  velocity: number;
}

/**
 * Pola drum satu bar. Kick malas khas lofi (ketukan 1, lalu sinkop di
 * langkah 7 pada bar ganjil dan/atau 10), snare kuas di 4 & 12, hat di
 * semua langkah genap dengan aksen bergantian, plus hat hantu di
 * langkah 15 bila rng berpihak (< 0,4). Deterministik selain hat hantu.
 */
export function drumHitsForBar(barIndex: number, rng: () => number = Math.random): DrumHit[] {
  const hits: DrumHit[] = [];
  hits.push({ step: 0, kind: 'kick', velocity: 0.9 });
  if (barIndex % 2 === 1) hits.push({ step: 7, kind: 'kick', velocity: 0.7 });
  hits.push({ step: 10, kind: 'kick', velocity: 0.75 });
  hits.push({ step: 4, kind: 'snare', velocity: 0.55 });
  hits.push({ step: 12, kind: 'snare', velocity: 0.6 });
  for (let step = 0; step < STEPS_PER_BAR; step += 2) {
    hits.push({ step, kind: 'hat', velocity: step % 4 === 0 ? 0.3 : 0.18 });
  }
  if (rng() < 0.4) hits.push({ step: 15, kind: 'hat', velocity: 0.13 });
  return hits.sort((a, b) => a.step - b.step);
}

export interface BassNote {
  step: number;
  midi: number;
  durSteps: number;
  velocity: number;
}

/** Bass: akar panjang di awal bar, fifth pendek menyusul, ekor akar di bar ganjil. */
export function bassNotesForBar(barIndex: number, chord: LofiChord): BassNote[] {
  const notes: BassNote[] = [
    { step: 0, midi: chord.rootMidi, durSteps: 6, velocity: 0.8 },
    { step: 10, midi: chord.rootMidi + 7, durSteps: 2, velocity: 0.45 },
  ];
  if (barIndex % 2 === 1) {
    notes.push({ step: 14, midi: chord.rootMidi, durSteps: 1, velocity: 0.35 });
  }
  return notes;
}

export interface MelodyNote {
  step: number;
  midi: number;
  durSteps: number;
  velocity: number;
}

/** Posisi langkah yang boleh diisi melodi (menghindari tabrakan snare di 4 & 12). */
const MELODY_CANDIDATE_STEPS = [2, 3, 6, 7, 10, 11, 14];

/**
 * Melodi pentatonik lembut di atas satu bar: tiap posisi kandidat
 * terisi dengan peluang 0,34; nada dipilih dari gabungan nada akor
 * satu oktaf di atas voicing pad + tangga melodi (nada akor berbobot
 * ganda agar melodi terasa "mendarat" di harmoni). Maksimal 4 nada
 * per bar, velocity rendah. Murni & deterministik untuk rng tertentu.
 */
export function melodyForBar(
  barIndex: number,
  chord: LofiChord,
  rng: () => number = Math.random,
): MelodyNote[] {
  const pool: number[] = [
    ...MELODY_SCALE_MIDI,
    ...chord.tones.map((t) => t + 12),
    ...chord.tones.map((t) => t + 12),
  ];
  void barIndex; // variasi antar bar datang dari akor & rng, bukan indeks
  const notes: MelodyNote[] = [];
  for (const step of MELODY_CANDIDATE_STEPS) {
    if (notes.length >= 4) break;
    if (rng() >= 0.34) continue;
    const midi = pool[Math.floor(rng() * pool.length)];
    const durSteps = 1 + Math.floor(rng() * 3);
    const velocity = 0.16 + rng() * 0.2;
    notes.push({ step, midi, durSteps, velocity });
  }
  return notes;
}

/** Kurva volume terasa (kuadratik) ke gain master: 0..1 → 0..0,9. */
export function volumeToGain(volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return v * v * 0.9;
}

// ---------------------------------------------------------------------
// Persistensi preferensi volume (pola uiSettings: aman dari throw)
// ---------------------------------------------------------------------

function storageOrNull(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

/** Volume tersimpan; bawaan 0,7. Nilai rusak/di luar rentang → bawaan/terjepit. */
export function readMusicVolume(): number {
  try {
    const raw = storageOrNull()?.getItem(MUSIC_STORAGE_KEY);
    if (raw === null || raw === undefined) return DEFAULT_MUSIC_VOLUME;
    const v = Number.parseFloat(raw);
    if (!Number.isFinite(v)) return DEFAULT_MUSIC_VOLUME;
    return Math.min(1, Math.max(0, v));
  } catch {
    return DEFAULT_MUSIC_VOLUME;
  }
}

export function writeMusicVolume(volume: number): void {
  try {
    const v = Math.min(1, Math.max(0, volume));
    storageOrNull()?.setItem(MUSIC_STORAGE_KEY, String(v));
  } catch {
    // storage tidak tersedia — volume cukup hidup di sesi ini
  }
}

// ---------------------------------------------------------------------
// Lapisan WebAudio — menerjemahkan data di atas menjadi bunyi
// ---------------------------------------------------------------------

const SCHEDULER_TICK_MS = 25;
const SCHEDULER_LOOKAHEAD_S = 0.12;

let ctx: AudioContext | null = null;
let inputBus: GainNode | null = null; // semua suara masuk ke sini
let volumeGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let crackleSource: AudioBufferSourceNode | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let playing = false;
let currentBar = 0;
let nextBarTime = 0;
let volume = readMusicVolume();
const activeSources = new Set<AudioScheduledSourceNode>();

function trackSource(src: AudioScheduledSourceNode): void {
  activeSources.add(src);
  src.onended = () => {
    activeSources.delete(src);
  };
}

function makeNoiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Buffer desis vinyl 3 detik: hiss sangat pelan + letupan (pop) acak
 * yang meluruh cepat. Murni audio — tidak ada pola visual apa pun.
 */
function makeCrackleBuffer(ac: AudioContext): AudioBuffer {
  const seconds = 3;
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.012;
  let pos = Math.floor(Math.random() * ac.sampleRate * 0.4);
  while (pos < length) {
    const amp = 0.08 + Math.random() * 0.22;
    const decay = 12 + Math.floor(Math.random() * 40);
    const sign = Math.random() < 0.5 ? -1 : 1;
    for (let j = 0; j < decay && pos + j < length; j += 1) {
      data[pos + j] += sign * amp * (1 - j / decay);
    }
    pos += Math.floor(ac.sampleRate * (0.08 + Math.random() * 0.6));
  }
  return buffer;
}

/** Impulse reverb buatan sendiri: noise stereo meluruh eksponensial ±1,7 dtk. */
function makeImpulseResponse(ac: AudioContext): AudioBuffer {
  const seconds = 1.7;
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
    }
  }
  return buffer;
}

/** Bangun graf master sekali: volume → lowpass lembut → (dry + reverb) → kompressor → tujuan. */
function buildGraph(ac: AudioContext): void {
  volumeGain = ac.createGain();
  volumeGain.gain.value = volumeToGain(volume);

  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 7200;
  tone.Q.value = 0.4;

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.24;

  const dry = ac.createGain();
  dry.gain.value = 0.92;

  const convolver = ac.createConvolver();
  convolver.buffer = makeImpulseResponse(ac);
  const wet = ac.createGain();
  wet.gain.value = 0.16;

  volumeGain.connect(tone);
  tone.connect(dry);
  dry.connect(comp);
  tone.connect(convolver);
  convolver.connect(wet);
  wet.connect(comp);
  comp.connect(ac.destination);

  inputBus = volumeGain;
  noiseBuffer = makeNoiseBuffer(ac, 1);
}

function ensureCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      buildGraph(ctx);
    }
    return ctx;
  } catch {
    return null;
  }
}

// --- Suara per instrumen (semua masuk ke inputBus) --------------------

function playPadTone(freq: number, t: number, dur: number, vel: number): void {
  if (!ctx || !inputBus) return;
  const ac = ctx;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1600;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.35);
  g.gain.setValueAtTime(vel, t + Math.max(0.35, dur - 0.4));
  g.gain.linearRampToValueAtTime(0, t + dur + 0.5);
  lp.connect(g);
  g.connect(inputBus);
  // Rhodes-ish: triangle sedikit detune dua arah + sine oktaf pelan.
  for (const [type, mult, detune, level] of [
    ['triangle', 1, -6, 1],
    ['triangle', 1, 6, 0.7],
    ['sine', 2, 0, 0.22],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq * mult;
    osc.detune.value = detune;
    const og = ac.createGain();
    og.gain.value = level;
    osc.connect(og);
    og.connect(lp);
    osc.start(t);
    osc.stop(t + dur + 0.6);
    trackSource(osc);
  }
}

function playBass(freq: number, t: number, dur: number, vel: number): void {
  if (!ctx || !inputBus) return;
  const ac = ctx;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(inputBus);
  for (const [type, level] of [
    ['sine', 1],
    ['triangle', 0.35],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const og = ac.createGain();
    og.gain.value = level;
    osc.connect(og);
    og.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    trackSource(osc);
  }
}

function playMelody(freq: number, t: number, dur: number, vel: number): void {
  if (!ctx || !inputBus) return;
  const ac = ctx;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  lp.connect(g);
  g.connect(inputBus);
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(lp);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  trackSource(osc);
  const osc2 = ac.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = freq;
  const og2 = ac.createGain();
  og2.gain.value = 0.3;
  osc2.connect(og2);
  og2.connect(lp);
  osc2.start(t);
  osc2.stop(t + dur + 0.05);
  trackSource(osc2);
}

function noiseSrc(): AudioBufferSourceNode | null {
  if (!ctx || !noiseBuffer) return null;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

function playKick(t: number, vel: number): void {
  if (!ctx || !inputBus) return;
  const ac = ctx;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(115, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.1);
  const g = ac.createGain();
  g.gain.setValueAtTime(vel * 0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  osc.connect(g);
  g.connect(inputBus);
  osc.start(t);
  osc.stop(t + 0.26);
  trackSource(osc);
}

function playSnare(t: number, vel: number): void {
  if (!ctx || !inputBus) return;
  const ac = ctx;
  const src = noiseSrc();
  if (src) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.setValueAtTime(vel * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(bp);
    bp.connect(g);
    g.connect(inputBus);
    src.start(t);
    src.stop(t + 0.18);
    trackSource(src);
  }
  const body = ac.createOscillator();
  body.type = 'triangle';
  body.frequency.value = 190;
  const bg = ac.createGain();
  bg.gain.setValueAtTime(vel * 0.22, t);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  body.connect(bg);
  bg.connect(inputBus);
  body.start(t);
  body.stop(t + 0.09);
  trackSource(body);
}

function playHat(t: number, vel: number): void {
  if (!ctx || !inputBus) return;
  const ac = ctx;
  const src = noiseSrc();
  if (!src) return;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 8200;
  const g = ac.createGain();
  g.gain.setValueAtTime(vel * 0.32, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  src.connect(hp);
  hp.connect(g);
  g.connect(inputBus);
  src.start(t);
  src.stop(t + 0.05);
  trackSource(src);
}

// --- Penjadwal ---------------------------------------------------------

function scheduleBar(barIndex: number, barStart: number): void {
  const chord = chordAtBar(barIndex);
  const barDur = barDurationSec();
  // Pad akor: semua nada, sedikit strum (jarak 18 ms per nada).
  chord.tones.forEach((midi, i) => {
    playPadTone(midiToFreq(midi), barStart + i * 0.018, barDur, 0.115);
  });
  for (const note of bassNotesForBar(barIndex, chord)) {
    playBass(
      midiToFreq(note.midi),
      barStart + stepOffsetSec(note.step),
      note.durSteps * stepDurationSec(),
      note.velocity,
    );
  }
  for (const hit of drumHitsForBar(barIndex)) {
    const jitter = (Math.random() - 0.5) * 0.014;
    const t = barStart + stepOffsetSec(hit.step) + jitter;
    if (hit.kind === 'kick') playKick(t, hit.velocity);
    else if (hit.kind === 'snare') playSnare(t, hit.velocity);
    else playHat(t, hit.velocity);
  }
  for (const note of melodyForBar(barIndex, chord)) {
    const jitter = (Math.random() - 0.5) * 0.012;
    playMelody(
      midiToFreq(note.midi),
      barStart + stepOffsetSec(note.step) + jitter,
      note.durSteps * stepDurationSec(),
      note.velocity,
    );
  }
}

function schedulerTick(): void {
  if (!ctx || !playing) return;
  while (nextBarTime < ctx.currentTime + SCHEDULER_LOOKAHEAD_S) {
    scheduleBar(currentBar, nextBarTime);
    nextBarTime += barDurationSec();
    currentBar = (currentBar + 1) % PROGRESSION_BARS;
  }
}

function startCrackle(): void {
  if (!ctx || !inputBus) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = makeCrackleBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3800;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(lp);
    lp.connect(g);
    g.connect(inputBus);
    src.start();
    crackleSource = src;
  } catch {
    // desis vinyl gagal dibuat — musik tetap jalan tanpanya
  }
}

function stopAllVoices(): void {
  for (const src of [...activeSources]) {
    try {
      src.stop();
    } catch {
      // sudah berhenti — abaikan
    }
    try {
      src.disconnect();
    } catch {
      // abaikan
    }
  }
  activeSources.clear();
  if (crackleSource) {
    try {
      crackleSource.stop();
    } catch {
      // abaikan
    }
    try {
      crackleSource.disconnect();
    } catch {
      // abaikan
    }
    crackleSource = null;
  }
}

// --- API publik --------------------------------------------------------

/**
 * Mulai musik. Mengembalikan true bila benar-benar berbunyi. Aman
 * dipanggil berulang (panggilan kedua saat sudah main = no-op) dan
 * aman di lingkungan tanpa AudioContext (mengembalikan false).
 */
export function start(): boolean {
  const ac = ensureCtx();
  if (!ac || !inputBus) return false;
  if (playing) return true;
  try {
    void ac.resume();
    startCrackle();
    currentBar = 0;
    nextBarTime = ac.currentTime + 0.06;
    playing = true;
    schedulerTick();
    schedulerTimer = setInterval(schedulerTick, SCHEDULER_TICK_MS);
    return true;
  } catch {
    playing = false;
    return false;
  }
}

/** Hentikan musik: semua suara berhenti, konteks ditangguhkan (dipakai ulang nanti). */
export function stop(): void {
  if (schedulerTimer !== null) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  playing = false;
  stopAllVoices();
  if (ctx) {
    const ac = ctx;
    // Tangguhkan setelah suara benar-benar padam agar tidak terpotong kasar.
    setTimeout(() => {
      if (!playing && ctx === ac) void ac.suspend().catch(() => undefined);
    }, 120);
  }
}

export function isPlaying(): boolean {
  return playing;
}

/** Atur volume 0..1 (dijepit) dan simpan sebagai preferensi. */
export function setVolume(next: number): void {
  volume = Math.min(1, Math.max(0, Number.isFinite(next) ? next : DEFAULT_MUSIC_VOLUME));
  writeMusicVolume(volume);
  if (ctx && volumeGain) {
    try {
      volumeGain.gain.setTargetAtTime(volumeToGain(volume), ctx.currentTime, 0.05);
    } catch {
      // abaikan — nilai volume tetap tersimpan untuk sesi bunyi berikutnya
    }
  }
}

export function getVolume(): number {
  return volume;
}
