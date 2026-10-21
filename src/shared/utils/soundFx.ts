/**
 * Synthesizer efek suara mekanis & elektrik — Web Audio API murni,
 * TANPA aset audio eksternal. Semua suara disintesis dari osilator dan
 * buffer noise saat runtime.
 *
 * Keamanan: AudioContext dibuat malas (lazy singleton) pada panggilan
 * pertama dan selalu di dalam try/catch. Bila AudioContext tidak tersedia
 * (lingkungan uji jsdom/node, SSR, browser lama) semua fungsi menjadi
 * no-op yang aman — tidak pernah melempar error.
 */

const STORAGE_KEY = 'sim3d:sound';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buzzerOsc: OscillatorNode | null = null;
let buzzerGain: GainNode | null = null;

/** Preferensi suara tersimpan di localStorage; default AKTIF. */
export function isSoundEnabled(): boolean {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return true;
    const raw = ls.getItem(STORAGE_KEY);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    ls?.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* penyimpanan tidak tersedia; abaikan */
  }
  if (!enabled) silenceBuzzer();
}

/** Ambil (atau buat) AudioContext bersama; null bila tidak bisa/tidak boleh bersuara. */
function ensureCtx(): AudioContext | null {
  if (!isSoundEnabled()) return null;
  try {
    if (typeof window === 'undefined') return null;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function silenceBuzzer(): void {
  try {
    if (ctx && buzzerGain) {
      buzzerGain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    }
  } catch {
    /* abaikan */
  }
}

/** Suara komponen menancap ke breadboard: burst noise pendek lewat highpass + klik mekanis. */
export function playSnap(): void {
  const ac = ensureCtx();
  if (!ac || !master) return;
  try {
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.05);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.06);
    // Klik mekanis pendek menyusul burst noise.
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1600;
    const og = ac.createGain();
    og.gain.setValueAtTime(0.001, t);
    og.gain.exponentialRampToValueAtTime(0.08, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    osc.connect(og);
    og.connect(master);
    osc.start(t);
    osc.stop(t + 0.03);
  } catch {
    /* abaikan — suara tidak boleh mengganggu simulasi */
  }
}

/** Klik mekanis pendek (sakelar, sambungan kabel, kontak relay). */
export function playClick(freqHz = 800): void {
  const ac = ensureCtx();
  if (!ac || !master) return;
  try {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freqHz;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + 0.04);
  } catch {
    /* abaikan */
  }
}

/** Letupan komponen terbakar: noise burst lowpass + osilator jatuh 300→60 Hz. */
export function playBurnPop(): void {
  const ac = ensureCtx();
  if (!ac || !master) return;
  try {
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer(ac, 0.2);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.2);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(lp);
    lp.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.21);

    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.25, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(og);
    og.connect(master);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch {
    /* abaikan */
  }
}

/**
 * Nada buzzer aktif berkelanjutan. Memakai SATU osilator square bersama
 * yang tidak pernah di-stop/start ulang — aktivasi hanya mengubah
 * frekuensi dan meramp gain (0.05 aktif, 0 mati) agar tidak berbunyi "klik"
 * setiap kali pin berubah.
 */
export function updateBuzzerTone(freqHz: number, active: boolean): void {
  const ac = ensureCtx();
  if (!ac || !master) return;
  try {
    if (!buzzerOsc || !buzzerGain) {
      buzzerOsc = ac.createOscillator();
      buzzerOsc.type = 'square';
      buzzerOsc.frequency.value = freqHz > 0 ? freqHz : 2400;
      buzzerGain = ac.createGain();
      buzzerGain.gain.value = 0;
      buzzerOsc.connect(buzzerGain);
      buzzerGain.connect(master);
      buzzerOsc.start();
    }
    const t = ac.currentTime;
    if (active) {
      if (freqHz > 0) buzzerOsc.frequency.setTargetAtTime(freqHz, t, 0.01);
      buzzerGain.gain.setTargetAtTime(0.05, t, 0.02);
    } else {
      buzzerGain.gain.setTargetAtTime(0, t, 0.02);
    }
  } catch {
    /* abaikan */
  }
}
