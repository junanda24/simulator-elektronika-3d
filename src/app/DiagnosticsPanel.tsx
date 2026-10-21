import { useEffect, useState } from 'react';
import {
  getSimRecoveryLog,
  setSimRecoveryListener,
  type SimRecoveryEntry,
  type SimRecoveryOutcome,
  type SimRecoveryReason,
} from '../features/simulation/worker/bridge';
import {
  clearErrorLog,
  defaultHealthCheckDeps,
  formatErrorLog,
  readErrorLog,
  runHealthChecks,
  type ErrorLogEntry,
  type HealthCheckResult,
} from './diagnostics';

/**
 * Panel "Periksa Kesehatan" di popover bantuan (self-healing,
 * 2026-10-21): menjalankan pemeriksaan NYATA (ping bridge, solve
 * rangkaian acuan, probe penyimpanan, probe WebGL) dan melaporkan
 * status per item dengan bahasa sederhana. Di bawahnya: riwayat
 * pemulihan otomatis mesin simulasi (dari log bridge) dan log error
 * lokal terakhir (kunci `sim3d:errorlog`) yang bisa disalin untuk
 * laporan bug atau dibersihkan.
 */

const REASON_LABEL: Record<SimRecoveryReason, string> = {
  'worker-error': 'Worker error',
  watchdog: 'Worker tidak merespons',
  'ping-gagal': 'Ping worker gagal',
};
const OUTCOME_LABEL: Record<SimRecoveryOutcome, string> = {
  'worker-restart': 'worker baru dibuat',
  'local-fallback': 'jatuh ke sesi cadangan lokal',
};

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-4 shrink-0 text-emerald-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5.5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-4 shrink-0 text-red-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4M12 17.5v.01" />
    </svg>
  );
}

const smallButtonClass =
  'rounded-md border border-border-interactive bg-panel-elevated px-2.5 py-1.5 text-xs font-medium text-zinc-100 transition-colors hover:border-accent-primary/60 disabled:cursor-wait disabled:opacity-60';

export default function DiagnosticsPanel() {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<HealthCheckResult[] | null>(null);
  const [recovery, setRecovery] = useState<SimRecoveryEntry[]>(() =>
    getSimRecoveryLog(),
  );
  const [errorEntries, setErrorEntries] = useState<ErrorLogEntry[]>(() =>
    readErrorLog(localStorageOrNull()),
  );
  const [copyNote, setCopyNote] = useState<string | null>(null);

  // Riwayat pemulihan tetap segar selama panel terbuka.
  useEffect(() => {
    setSimRecoveryListener(() => setRecovery(getSimRecoveryLog()));
    return () => setSimRecoveryListener(null);
  }, []);

  const runChecks = async () => {
    setChecking(true);
    try {
      setResults(await runHealthChecks(defaultHealthCheckDeps()));
      setErrorEntries(readErrorLog(localStorageOrNull()));
      setRecovery(getSimRecoveryLog());
    } finally {
      setChecking(false);
    }
  };

  const copyLog = async () => {
    const text = formatErrorLog(errorEntries);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote('Log tersalin.');
    } catch {
      setCopyNote('Gagal menyalin otomatis — peramban menolak akses clipboard.');
    }
    window.setTimeout(() => setCopyNote(null), 3000);
  };

  const clearLog = () => {
    clearErrorLog(localStorageOrNull());
    setErrorEntries([]);
    setCopyNote('Log dibersihkan.');
    window.setTimeout(() => setCopyNote(null), 3000);
  };

  return (
    <div className="mt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        Diagnostik
      </h3>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
        Periksa kesehatan mesin simulasi, solver, penyimpanan, dan tampilan 3D
        di peramban ini.
      </p>
      <button
        type="button"
        onClick={() => void runChecks()}
        disabled={checking}
        className="mt-2 rounded-md border border-accent-primary/60 bg-accent-primary/25 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition-colors hover:bg-accent-primary/35 disabled:cursor-wait disabled:opacity-60"
      >
        {checking ? 'Memeriksa…' : 'Periksa Kesehatan'}
      </button>

      {results && (
        <ul className="mt-2.5 space-y-2" aria-label="Hasil pemeriksaan kesehatan">
          {results.map((result) => (
            <li key={result.id} className="flex gap-2">
              <StatusIcon ok={result.ok} />
              <div className="min-w-0">
                <p className="text-xs text-zinc-200">
                  {result.label}{' '}
                  <span
                    className={
                      result.ok ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'
                    }
                  >
                    {result.ok ? 'Sehat' : 'Bermasalah'}
                  </span>
                </p>
                {!result.ok && (
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                    {result.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {recovery.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-zinc-200">
            Riwayat pemulihan otomatis
          </h4>
          <ul className="mt-1 space-y-1">
            {recovery.map((entry, idx) => (
              <li key={`${entry.at}-${idx}`} className="text-xs text-zinc-400">
                {new Date(entry.at).toLocaleTimeString('id-ID')} —{' '}
                {REASON_LABEL[entry.reason]}; {OUTCOME_LABEL[entry.outcome]}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <h4 className="text-xs font-semibold text-zinc-200">Log error terakhir</h4>
        {errorEntries.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-400">
            Belum ada error tercatat di peramban ini.
          </p>
        ) : (
          <>
            <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto pr-1">
              {errorEntries.map((entry, idx) => (
                <li
                  key={`${entry.at}-${idx}`}
                  className="break-words font-mono text-[11px] leading-relaxed text-zinc-400"
                >
                  {entry.at ? `${entry.at} — ` : ''}
                  {entry.message}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void copyLog()} className={smallButtonClass}>
                Salin Log
              </button>
              <button type="button" onClick={clearLog} className={smallButtonClass}>
                Bersihkan Log
              </button>
            </div>
          </>
        )}
        {copyNote && (
          <p role="status" className="mt-1.5 text-xs text-zinc-300">
            {copyNote}
          </p>
        )}
      </div>
    </div>
  );
}
