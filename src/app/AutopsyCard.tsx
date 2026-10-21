import { useCircuitStore } from '../features/wiring/store/circuitStore';
import { getComponentPlugin } from '../shared/components/registry';
import { boardPinWorldPosition, getBoardDefinition } from '../shared/boards/definitions';

/**
 * Kartu Autopsi Kerusakan — panel laporan forensik yang muncul saat
 * solver mendeteksi komponen rusak. Menjelaskan apa yang terjadi,
 * nilai terukur vs batas aman, dan menawarkan penggantian komponen.
 */

/** Format angka ukur: mA → 1 desimal, V → 2 desimal, lainnya apa adanya. */
function formatMeasure(value: number, unit: string): string {
  if (unit === 'mA') return value.toFixed(1);
  if (unit === 'V') return value.toFixed(2);
  return String(value);
}

export default function AutopsyCard() {
  const autopsy = useCircuitStore((s) => s.autopsy);
  const instances = useCircuitStore((s) => s.instances);
  const replaceInstance = useCircuitStore((s) => s.replaceInstance);
  const replaceBoard = useCircuitStore((s) => s.replaceBoard);
  const closeAutopsy = useCircuitStore((s) => s.closeAutopsy);
  const setCameraView = useCircuitStore((s) => s.setCameraView);
  const boardId = useCircuitStore((s) => s.boardId);

  if (!autopsy) return null;

  const { instanceId, report } = autopsy;
  const isBoard = instanceId === null;
  const instance = isBoard ? undefined : instances.find((i) => i.id === instanceId);
  const plugin = instance ? getComponentPlugin(instance.type) : undefined;
  const componentName = isBoard
    ? autopsy.boardPinId
      ? `Board Arduino Uno · Pin ${autopsy.boardPinId}`
      : 'Board Arduino Uno'
    : (plugin?.name ?? instance?.type ?? 'Komponen');

  /** Arahkan kamera tepat ke titik rusak: posisi komponen, atau pin board. */
  const handleFocusDamage = () => {
    let target: [number, number, number] | null = null;
    if (instance) {
      target = [...instance.position] as [number, number, number];
    } else {
      const board = getBoardDefinition(boardId);
      target =
        (autopsy.boardPinId ? boardPinWorldPosition(board, autopsy.boardPinId) : null) ??
        ([...board.origin] as [number, number, number]);
    }
    if (!target) return;
    setCameraView(target, [target[0] + 7, target[1] + 6, target[2] + 8]);
  };

  return (
    <section
      className="absolute bottom-4 right-4 z-20 w-[340px] rounded-xl border border-accent-danger/60 bg-panel-elevated p-4 shadow-2xl"
      role="alert"
      aria-label="Laporan autopsi kerusakan komponen"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 shrink-0 bg-accent-danger" aria-hidden="true" />
        <p className="text-[11px] font-semibold tracking-[0.14em] text-accent-danger">
          LAPORAN AUTOPSI KERUSAKAN
        </p>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{report.ruleId}</span>
      </div>

      <h2 className="mt-2 text-base font-semibold leading-snug text-slate-100">{report.titleId}</h2>

      <p className="mt-1 text-xs text-slate-400">
        {isBoard ? 'Sasaran' : 'Komponen'}:{' '}
        <span className="font-medium text-slate-200">{componentName}</span>
        {instance ? <span className="font-mono text-[11px] text-slate-500"> · {instance.type}</span> : null}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{report.explanationId}</p>

      <div className="mt-3 space-y-1.5 rounded-lg border border-border-subtle bg-panel px-3 py-2.5 font-mono text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-slate-400">Terdeteksi:</span>
          <span className="font-semibold text-accent-danger">
            {formatMeasure(report.measured, report.unit)} {report.unit}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-slate-400">Batas aman:</span>
          <span className="text-slate-200">
            {formatMeasure(report.limit, report.unit)} {report.unit}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleFocusDamage}
        className="mt-4 w-full rounded-lg border border-accent-primary/50 bg-accent-primary/10 px-3 py-2 text-sm font-semibold text-accent-primary transition hover:bg-accent-primary/20"
      >
        Lihat Titik Rusak
      </button>

      <div className="mt-2 flex gap-2">
        {isBoard ? (
          <button
            type="button"
            onClick={() => replaceBoard()}
            className="flex-1 rounded-lg bg-accent-run px-3 py-2 text-sm font-semibold text-[#04150c] transition hover:brightness-110"
          >
            Ganti Board
          </button>
        ) : (
          <button
            type="button"
            onClick={() => instanceId && replaceInstance(instanceId)}
            className="flex-1 rounded-lg bg-accent-run px-3 py-2 text-sm font-semibold text-[#04150c] transition hover:brightness-110"
          >
            Ganti Komponen
          </button>
        )}
        <button
          type="button"
          onClick={() => closeAutopsy()}
          className="rounded-lg border border-border-subtle bg-panel px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
        >
          Tutup
        </button>
      </div>
    </section>
  );
}
