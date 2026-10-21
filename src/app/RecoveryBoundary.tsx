import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from './errorLog';
import { finishBootOverlay } from './bootOverlay';

/**
 * Error boundary pemulihan (self-healing SH-1). Dua lapis:
 * - scope 'app'    : membungkus seluruh <App/> dari main.tsx — jaring
 *                    terakhir agar kegagalan render apa pun berakhir
 *                    sebagai kartu pemulihan, bukan layar kosong.
 * - scope 'canvas' : membungkus Workbench (kanvas 3D) di App.tsx —
 *                    gangguan WebGL/scene hanya meruntuhkan area 3D;
 *                    "Muat Ulang Tampilan" me-remount scene tanpa
 *                    memuat ulang seluruh halaman.
 *
 * Setiap error tertangkap: (1) tetap diteruskan ke console.error —
 * boundary BUKAN penelan error diam-diam; (2) dicatat ke log error
 * lokal (errorLog.ts, kunci "sim3d:errorlog") untuk diagnosis;
 * (3) user diberi tahu rangkaiannya aman (autosave sesi) + dua aksi
 * pemulihan yang jelas. Gaya mengikuti kartu/panel aplikasi: tema
 * gelap proyek, aksen cyan, tanpa emoji di label.
 */

interface RecoveryBoundaryProps {
  scope: 'app' | 'canvas';
  children: ReactNode;
}

interface RecoveryBoundaryState {
  error: Error | null;
}

export default class RecoveryBoundary extends Component<
  RecoveryBoundaryProps,
  RecoveryBoundaryState
> {
  state: RecoveryBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RecoveryBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      `[RecoveryBoundary:${this.props.scope}]`,
      error,
      info.componentStack,
    );
    logError(error, `boundary:${this.props.scope}`);
    if (this.props.scope === 'app') {
      // Overlay boot masih menutupi layar bila crash terjadi sebelum
      // frame pertama: singkirkan agar kartu pemulihan terlihat.
      finishBootOverlay();
    }
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  private reloadPage = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const isApp = this.props.scope === 'app';
    return (
      <div
        role="alert"
        className={
          isApp
            ? 'fixed inset-0 z-[60] grid place-items-center bg-[#0b0f0d] p-4'
            : 'absolute inset-0 z-10 grid place-items-center bg-[#0b0f0d] p-4'
        }
      >
        <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-panel p-5 shadow-[0_8px_32px_rgb(0_0_0/0.45)]">
          <h2 className="text-[15px] font-bold text-zinc-100">
            {isApp ? 'Aplikasi mengalami gangguan' : 'Tampilan 3D mengalami gangguan'}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
            Terjadi kesalahan tak terduga saat menampilkan bagian ini.
            Rangkaianmu aman — pekerjaanmu tersimpan otomatis di browser
            ini dan dipulihkan saat halaman dimuat ulang.
          </p>
          <p className="mt-3 break-words rounded-lg border border-border-subtle bg-panel-elevated px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-400">
            {error.message || error.name}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="h-9 flex-1 rounded-lg bg-accent-primary px-3 text-[13px] font-semibold text-[#03252b] transition-colors hover:bg-cyan-300 active:scale-[0.98]"
            >
              Muat Ulang Tampilan
            </button>
            <button
              type="button"
              onClick={this.reloadPage}
              className="h-9 flex-1 rounded-lg border border-border-interactive px-3 text-[13px] font-medium text-zinc-200 transition-colors hover:border-accent-primary hover:text-accent-primary active:scale-[0.98]"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      </div>
    );
  }
}
