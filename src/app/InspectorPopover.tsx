import { memo } from 'react';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { selectInspectorView } from './inspectorFormat';

const capsuleShadow =
  'shadow-[0_8px_32px_rgb(0_0_0/0.45),0_2px_8px_rgb(0_0_0/0.4)]';

/**
 * Popover inspektor komponen terpilih (nama, Status, daftar arus, tombol
 * Ganti/Hapus). Sengaja komponen terpisah + memo + langganan store sempit
 * lewat selectInspectorView: render ulang App (mis. snapshot solver 60×/
 * detik selama drag slider gizmo) TIDAK mengecat ulang popover ini —
 * ia hanya berubah bila data tampilnya sendiri berubah pada presisi
 * 0,1 mA, atau status rusak berbalik (seketika). Elemen hud-pop ter-mount
 * hanya saat seleksi muncul dari kosong, jadi animasi masuk tidak pernah
 * terpicu ulang oleh render induk.
 */
function InspectorPopover() {
  const view = useCircuitStore((s) => selectInspectorView(s));
  const removeInstance = useCircuitStore((s) => s.removeInstance);
  const replaceInstance = useCircuitStore((s) => s.replaceInstance);

  if (!view) return null;

  return (
    <div
      className={`hud-pop pointer-events-auto w-full rounded-2xl border border-border-subtle bg-panel/95 p-3 ${capsuleShadow}`}
    >
      <h3 className="text-[13px] font-semibold text-zinc-100">{view.name}</h3>
      <p className="mt-1 text-xs text-zinc-400">
        Status:{' '}
        {view.isDamaged ? (
          <span className="font-semibold text-accent-danger">Rusak</span>
        ) : (
          <span className="text-accent-run">Normal</span>
        )}
      </p>
      {view.currents.map((row) => (
        <p key={row.key} className="mt-0.5 font-mono text-[11px] text-zinc-400">
          Arus {row.key}: {row.text} mA
        </p>
      ))}
      <div className="mt-2.5 flex gap-2">
        {view.isDamaged && (
          <button
            type="button"
            onClick={() => replaceInstance(view.id)}
            className="h-7 flex-1 rounded-lg bg-accent-run text-xs font-semibold text-[#032117] transition-transform active:scale-[0.97]"
          >
            Ganti Komponen
          </button>
        )}
        <button
          type="button"
          onClick={() => removeInstance(view.id)}
          className="h-7 flex-1 rounded-lg border border-border-interactive text-xs font-medium text-zinc-200 transition-colors hover:border-accent-danger hover:text-red-200 active:scale-[0.97]"
        >
          Hapus Komponen
        </button>
      </div>
    </div>
  );
}

export default memo(InspectorPopover);
