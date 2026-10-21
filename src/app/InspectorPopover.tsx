import { memo, useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { selectInspectorView } from './inspectorFormat';
import { useExitPresence } from './useExitPresence';

const capsuleShadow =
  'shadow-[0_8px_32px_rgb(0_0_0/0.45),0_2px_8px_rgb(0_0_0/0.4)]';

/**
 * Daftar detail yang lebih panjang dari ini tampil TERLIPAT secara bawaan
 * (kasus Display 7-Segment: 8 baris arus menyemak panel); yang pendek
 * tampil terbuka. Ambang ini hanya aturan bawaan — pilihan lipat user
 * untuk komponen yang sedang terpilih selalu menang (lihat toggle di
 * bawah).
 */
const LONG_DETAIL_ROWS = 4;

/**
 * Popover inspektor komponen terpilih (nama, Status, daftar arus, tombol
 * Ganti/Hapus). Sengaja komponen terpisah + memo + langganan store sempit
 * lewat selectInspectorView: render ulang App (mis. snapshot solver 60×/
 * detik selama drag slider gizmo) TIDAK mengecat ulang popover ini —
 * ia hanya berubah bila data tampilnya sendiri berubah pada presisi
 * 0,1 mA, atau status rusak berbalik (seketika). Elemen hud-pop ter-mount
 * hanya saat seleksi muncul dari kosong, jadi animasi masuk tidak pernah
 * terpicu ulang oleh render induk.
 *
 * Daftar arus hidup di bagian lipat "Detail pengukuran" (.hud-collapse):
 * kepala popover (nama + Status + tombol Ganti/Hapus) selalu tampil,
 * detail bisa disembunyikan/dibuka user. Keadaan lipat adalah state lokal
 * yang terkunci ke id komponen: berganti komponen = kembali ke aturan
 * bawaan di atas untuk komponen baru (pilihan lama tidak bocor lintas
 * komponen).
 *
 * Keluar: useExitPresence menahan mount 150ms dengan kelas .hud-exit
 * memakai data tampil terakhir (lastView) — seleksi hilang tidak lagi
 * memotong popover secara mendadak. Selama exit pointer-events mati
 * agar klik meneruskan ke kanvas seketika.
 */
function InspectorPopover() {
  const view = useCircuitStore((s) => selectInspectorView(s));
  const removeInstance = useCircuitStore((s) => s.removeInstance);
  const replaceInstance = useCircuitStore((s) => s.replaceInstance);
  const { mounted, exiting } = useExitPresence(view !== null, 150);
  const lastViewRef = useRef(view);
  useEffect(() => {
    if (view) lastViewRef.current = view;
  }, [view]);
  const shown = view ?? lastViewRef.current;
  /** Pilihan lipat eksplisit user, terkunci ke id komponen terpilih. */
  const [foldChoice, setFoldChoice] = useState<{ id: string; open: boolean } | null>(null);

  if (!mounted || !shown) return null;
  const display = shown;

  const hasDetail = display.currents.length > 0;
  const detailOpen =
    foldChoice && foldChoice.id === display.id
      ? foldChoice.open
      : display.currents.length <= LONG_DETAIL_ROWS;

  return (
    <div
      className={`hud-pop w-full rounded-2xl border border-border-subtle bg-panel/95 p-3 ${capsuleShadow} ${
        exiting ? 'hud-exit pointer-events-none' : 'pointer-events-auto'
      }`}
    >
      <h3 className="text-[13px] font-semibold text-zinc-100">{display.name}</h3>
      <p className="mt-1 text-xs text-zinc-400">
        Status:{' '}
        {display.isDamaged ? (
          <span className="font-semibold text-accent-danger">Rusak</span>
        ) : (
          <span className="text-accent-run">Normal</span>
        )}
      </p>
      {hasDetail && (
        <>
          <button
            type="button"
            aria-expanded={detailOpen}
            aria-controls="inspector-detail"
            onClick={() => setFoldChoice({ id: display.id, open: !detailOpen })}
            className="hud-collapse-toggle mt-2 flex h-6 w-full items-center justify-between text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <span>Detail pengukuran</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div id="inspector-detail" className="hud-collapse" data-open={detailOpen}>
            <div>
              {display.currents.map((row) => (
                <p key={row.key} className="mt-0.5 font-mono text-[11px] text-zinc-400">
                  Arus {row.key}: {row.text} mA
                </p>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="mt-2.5 flex gap-2">
        {display.isDamaged && (
          <button
            type="button"
            onClick={() => replaceInstance(display.id)}
            className="h-7 flex-1 rounded-lg bg-accent-run text-xs font-semibold text-[#032117] transition-transform active:scale-[0.97]"
          >
            Ganti Komponen
          </button>
        )}
        <button
          type="button"
          onClick={() => removeInstance(display.id)}
          className="h-7 flex-1 rounded-lg border border-border-interactive text-xs font-medium text-zinc-200 transition-colors hover:border-accent-danger hover:text-red-200 active:scale-[0.97]"
        >
          Hapus Komponen
        </button>
      </div>
    </div>
  );
}

export default memo(InspectorPopover);
