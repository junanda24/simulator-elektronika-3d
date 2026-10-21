import { LESSONS } from '../features/lessons/curriculum';
import { getBoardDefinition } from '../shared/boards/definitions';
import { useCircuitStore } from '../features/wiring/store/circuitStore';

/**
 * Panel Panduan (mode Lesson): daftar modul kurikulum, materi, pemuat
 * rangkaian/sketch awal, dan checklist assertion yang terisi
 * otomatis (sticky) dari evaluasi store atas snapshot live.
 */
export default function LessonsPanel() {
  const activeLessonId = useCircuitStore((s) => s.activeLessonId);
  const lessonChecks = useCircuitStore((s) => s.lessonChecks);
  const completedLessons = useCircuitStore((s) => s.completedLessons);
  const setActiveLesson = useCircuitStore((s) => s.setActiveLesson);
  const applyStarter = useCircuitStore((s) => s.applyStarter);
  const restartSketch = useCircuitStore((s) => s.restartSketch);

  const active = LESSONS.find((l) => l.id === activeLessonId) ?? null;
  const allDone = active !== null && lessonChecks.length > 0 && lessonChecks.every(Boolean);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!active ? (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-zinc-400">
              {LESSONS.length} modul terstruktur dari LED pertama sampai proyek
              akhir. Selesaikan berurutan atau lompat ke topik yang kamu
              butuhkan.
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              Tantangan: coba cabut kabel resistor dari jalur LED, sambungkan
              anoda langsung ke rail 5V, lalu jalankan lagi — LED akan kelebihan
              arus dan rusak. Buka kartu autopsinya untuk membaca penyebab
              kerusakannya.
            </p>
            {LESSONS.map((lesson, idx) => {
              const done = completedLessons.includes(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setActiveLesson(lesson.id)}
                  className="w-full rounded-lg border border-border-subtle bg-panel-elevated p-3 text-left transition-colors hover:border-zinc-500"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-[13px] font-semibold text-zinc-100">
                      {lesson.title.replace(/^Modul \d+ — /, '')}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        done
                          ? 'border-accent-run/50 text-accent-run'
                          : 'border-border-subtle text-zinc-400'
                      }`}
                    >
                      {done ? 'SELESAI' : 'MULAI'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    Board: {getBoardDefinition(lesson.boardId).name}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setActiveLesson(null)}
              className="text-xs font-medium text-accent-primary hover:underline"
            >
              ← Semua modul
            </button>
            <h3 className="mt-2 text-sm font-bold text-zinc-100">{active.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{active.intro}</p>
            <div className="mt-3 rounded-lg border border-border-subtle bg-panel-elevated p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Tugasmu
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">{active.goal}</p>
            </div>

            {active.starter && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyStarter(active.id)}
                  className="h-8 flex-1 rounded-md bg-accent-primary/15 text-xs font-semibold text-accent-primary transition-colors hover:bg-accent-primary/25"
                >
                  Muat Rangkaian Awal
                </button>
                <button
                  type="button"
                  onClick={restartSketch}
                  className="h-8 flex-1 rounded-md bg-accent-run text-xs font-semibold text-[#032117] transition-colors hover:bg-emerald-400"
                >
                  Jalankan
                </button>
              </div>
            )}

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Daftar Periksa
            </p>
            <ul className="mt-2 space-y-1.5">
              {active.assertions.map((assertion, i) => {
                const done = lessonChecks[i] ?? false;
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs leading-relaxed ${
                      done
                        ? 'border-accent-run/40 bg-accent-run/10 text-zinc-200'
                        : 'border-border-subtle bg-panel-elevated text-zinc-400'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-block size-2 shrink-0 rounded-full ${
                        done ? 'bg-accent-run' : 'bg-zinc-600'
                      }`}
                    />
                    {assertion.label}
                  </li>
                );
              })}
            </ul>

            {allDone && (
              <div className="mt-3 rounded-lg border border-accent-run/50 bg-accent-run/10 p-3">
                <p className="text-[13px] font-semibold text-accent-run">Modul selesai!</p>
                <p className="mt-0.5 text-xs text-zinc-300">
                  Semua butir terpenuhi. Kembali ke daftar dan lanjutkan ke modul berikutnya.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
