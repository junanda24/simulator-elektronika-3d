import { useEffect, useRef, useState } from 'react';
import SketchEditor from '../features/sketch/SketchEditor';
import LessonsPanel from './LessonsPanel';
import { useCircuitStore } from '../features/wiring/store/circuitStore';

/**
 * Right Dock (STYLE_GUIDE §5, lebar 380px dari kontainer App): panel
 * melayang SOLID (bukan glass) berisi tab Kode Sketch (editor + status
 * pin + tombol Jalankan Ulang) dan Serial Monitor.
 *
 * Error sketch ditampilkan sebagai banner lengket di bawah tab dan
 * terlihat dari SEMUA tab — pengguna yang menekan Jalankan dari header
 * harus langsung tahu sketch-nya berhenti dan kenapa, tanpa membuka
 * tab tertentu.
 */
export default function RightDock() {
  const [tab, setTab] = useState<'kode' | 'serial' | 'panduan'>('kode');
  const sketchCode = useCircuitStore((s) => s.sketchCode);
  const setSketchCode = useCircuitStore((s) => s.setSketchCode);
  const restartSketch = useCircuitStore((s) => s.restartSketch);
  const sketchError = useCircuitStore((s) => s.sketchError);
  const currentLine = useCircuitStore((s) => s.currentLine);
  const serialText = useCircuitStore((s) => s.serialText);
  const clearSerial = useCircuitStore((s) => s.clearSerial);
  const running = useCircuitStore((s) => s.running);
  const pinStates = useCircuitStore((s) => s.pinStates);
  const deadPins = useCircuitStore((s) => s.deadPins);
  const boardFault = useCircuitStore((s) => s.boardFault);
  const replaceBoard = useCircuitStore((s) => s.replaceBoard);

  const serialRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = serialRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [serialText, tab]);

  const pinEntries = Object.entries(pinStates);

  // Baris yang disebut pesan error ("Baris 3: …") — editor menggambar
  // latar merah tipis pada baris itu agar kesalahan mudah ditemukan.
  const errorLineMatch = sketchError ? /Baris\s+(\d+)/.exec(sketchError) : null;
  const errorLine = errorLineMatch ? Number(errorLineMatch[1]) : null;

  return (
    <aside className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border-subtle bg-panel shadow-[0_8px_32px_rgb(0_0_0/0.45),0_2px_8px_rgb(0_0_0/0.4)]">
      <div className="flex h-10 shrink-0 items-stretch border-b border-border-subtle">
        {(
          [
            { id: 'kode', label: 'Kode Sketch' },
            { id: 'serial', label: 'Serial Monitor' },
            { id: 'panduan', label: 'Panduan' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 text-[13px] font-medium transition-colors ${
              tab === t.id
                ? 'border-b-2 border-accent-primary text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sketchError && (
        <button
          type="button"
          role="alert"
          onClick={() => setTab('kode')}
          title="Klik untuk membuka editor dan melihat baris yang salah"
          className="mx-3 mt-3 flex shrink-0 items-start gap-2 rounded-md border border-accent-danger/50 bg-accent-danger/10 p-2.5 text-left transition-colors hover:bg-accent-danger/15"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="mt-px size-4 shrink-0 text-accent-danger"
            aria-hidden="true"
          >
            <path d="M12 3 2.5 21h19L12 3z" />
            <path d="M12 10v5" strokeLinecap="round" />
            <circle cx="12" cy="18" r="0.4" fill="currentColor" />
          </svg>
          <span className="text-xs leading-relaxed text-red-200">{sketchError}</span>
        </button>
      )}

      {tab === 'panduan' ? (
        <LessonsPanel />
      ) : tab === 'kode' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <SketchEditor value={sketchCode} onChange={setSketchCode} errorLine={errorLine} execLine={currentLine} />
          </div>
          <div className="shrink-0 border-t border-border-subtle p-3">
            <p className="mb-2 text-xs leading-relaxed text-zinc-400">
              {running
                ? 'Sketch berjalan. Ubah kode, lalu tekan Jalankan Ulang untuk menerapkan.'
                : 'Tekan Jalankan untuk menyalakan board dan menjalankan sketch.'}
            </p>
            <button
              type="button"
              onClick={(e) => {
                restartSketch();
                // Lepas fokus tombol: bila fokus tertinggal di sini, menekan
                // Space untuk jalan/berhenti akan "mengklik" tombol ini lagi
                // (aktivasi Space pada button) dan membatalkan perintah user.
                e.currentTarget.blur();
              }}
              className="h-8 w-full rounded-md border border-border-subtle text-[13px] font-medium text-zinc-200 transition-colors hover:border-zinc-500"
            >
              Jalankan Ulang
            </button>

            {(pinEntries.length > 0 || deadPins.length > 0 || boardFault) && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Status Pin
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {pinEntries.map(([pinId, state]) => (
                    <span
                      key={pinId}
                      className="rounded border border-border-subtle bg-panel-elevated px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                    >
                      {pinId} · {state.mode}
                      {state.mode === 'OUTPUT' &&
                        (state.pwm !== undefined
                          ? ` · PWM ${state.pwm}`
                          : state.high
                            ? ' · HIGH'
                            : ' · LOW')}
                    </span>
                  ))}
                  {deadPins.map((pinId) => (
                    <span
                      key={pinId}
                      className="rounded border border-accent-danger/50 bg-accent-danger/10 px-2 py-0.5 font-mono text-[11px] text-red-200"
                    >
                      {pinId} · MATI
                    </span>
                  ))}
                </div>
                {(deadPins.length > 0 || boardFault) && (
                  <button
                    type="button"
                    onClick={replaceBoard}
                    className="mt-2 h-7 w-full rounded-md border border-border-subtle text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500"
                  >
                    Ganti Board (perbaiki kerusakan)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <pre
            ref={serialRef}
            className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-zinc-300"
          >
            {serialText || (
              <span className="text-zinc-400">
                Belum ada keluaran. Serial.println dari sketch akan muncul di sini.
              </span>
            )}
          </pre>
          <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-3 py-2">
            <span className="font-mono text-[11px] text-zinc-400">9600 baud</span>
            <button
              type="button"
              onClick={clearSerial}
              className="h-7 rounded-md border border-border-subtle px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500"
            >
              Bersihkan
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
