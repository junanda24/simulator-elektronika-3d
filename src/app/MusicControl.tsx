import { useEffect, useState, type ChangeEvent } from 'react';
import * as lofi from './lofiEngine';

/**
 * Kontrol musik lofi generatif (pojok kiri bawah, sejajar kapsul
 * kamera di kanan bawah). Musik SELALU mulai dari mati — browser
 * melarang bunyi sebelum gestur pengguna, dan "pernah dinyalakan"
 * tidak disimpan sebagai status; yang diingat hanya volumenya
 * (localStorage `sim3d:music`, lewat lofiEngine). Semua bunyi
 * disintesis WebAudio oleh lofiEngine — tidak ada file audio.
 */
export default function MusicControl() {
  const [playing, setPlaying] = useState<boolean>(() => lofi.isPlaying());
  const [volume, setVolumeState] = useState<number>(() => lofi.getVolume());

  // Komponen ini hidup sepanjang aplikasi, tetapi bila suatu saat
  // dilepas, musik tidak boleh tertinggal berbunyi.
  useEffect(() => {
    return () => {
      lofi.stop();
    };
  }, []);

  const toggle = () => {
    if (playing) {
      lofi.stop();
      setPlaying(false);
    } else {
      setPlaying(lofi.start());
    }
  };

  const onVolume = (e: ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    lofi.setVolume(v);
    setVolumeState(v);
  };

  return (
    <div
      className="hud-enter-up hud-glass pointer-events-auto absolute bottom-3 left-3 z-10 flex h-11 items-center gap-2 rounded-full border border-border-subtle px-2"
      style={{ animationDelay: '260ms' }}
      role="group"
      aria-label="Musik lofi"
    >
      <svg
        viewBox="0 0 24 24"
        className="ml-1 size-4 shrink-0 text-zinc-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? 'Jeda musik lofi' : 'Putar musik lofi'}
        title={playing ? 'Jeda musik lofi' : 'Putar musik lofi'}
        className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors active:scale-[0.97] ${
          playing
            ? 'border-accent-primary text-accent-primary'
            : 'border-border-interactive text-zinc-200 hover:border-accent-primary hover:text-accent-primary'
        }`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-3.5 translate-x-[1px]" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(volume * 100)}
        onChange={onVolume}
        aria-label="Volume musik lofi"
        title="Volume musik lofi"
        className="h-1 w-20 shrink-0 cursor-pointer accent-[#00e5ff] max-[1279px]:w-14"
      />
    </div>
  );
}
