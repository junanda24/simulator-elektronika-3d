import { useEffect, useRef, useState } from 'react';
import SketchEditor from '../features/sketch/SketchEditor';
import LessonsPanel from './LessonsPanel';
import { useCircuitStore } from '../features/wiring/store/circuitStore';

/**
 * Right Dock (STYLE_GUIDE §5, lebar 380px): tab Kode Sketch
 * (editor + status pin + tombol upload) dan Serial Monitor.
 */
export default function RightDock() {
  const [tab, setTab] = useState<'kode' | 'serial' | 'panduan'>('kode');
  const sketchCode = useCircuitStore((s) => s.sketchCode);
  const setSketchCode = useCircuitStore((s) => s.setSketchCode);
  const restartSketch = useCircuitStore((s) => s.restartSketch);
  const sketchError = useCircuitStore((s) => s.sketchError);
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

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-border-subtle bg-panel">
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
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'panduan' ? (
        <LessonsPanel />
      ) : tab === 'kode' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <SketchEditor value={sketchCode} onChange={setSketchCode} />
          </div>
          <div className="shrink-0 border-t border-border-subtle p-3">
            {sketchError ? (
              <p className="mb-2 text-xs leading-relaxed text-accent-danger">{sketchError}</p>
            ) : (
              <p className="mb-2 text-xs text-zinc-500">
                {running
                  ? 'Sketch sedang berjalan. Ubah kode lalu upload ulang untuk menerapkan.'
                  : 'Tekan Upload & Jalankan untuk menyalakan board dan menjalankan sketch.'}
              </p>
            )}
            <button
              type="button"
              onClick={restartSketch}
              className="h-8 w-full rounded-md bg-accent-run text-[13px] font-semibold text-[#032117] transition-colors hover:bg-emerald-400"
            >
              Upload &amp; Jalankan
            </button>

            {(pinEntries.length > 0 || deadPins.length > 0 || boardFault) && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
                      className="rounded border border-accent-danger/50 bg-accent-danger/10 px-2 py-0.5 font-mono text-[11px] text-accent-danger"
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
              <span className="text-zinc-600">
                Belum ada keluaran. Serial.println dari sketch akan muncul di sini.
              </span>
            )}
          </pre>
          <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-3 py-2">
            <span className="font-mono text-[11px] text-zinc-500">9600 baud</span>
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
