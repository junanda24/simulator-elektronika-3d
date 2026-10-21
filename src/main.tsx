import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { setBootStagePreparing, showBootError } from './app/bootOverlay.ts'
import RecoveryBoundary from './app/RecoveryBoundary.tsx'
import { handleChunkLoadError } from './app/chunkHealing.ts'
import { logError } from './app/errorLog.ts'

// Berkas ini tereksekusi = bundle selesai dimuat: majukan tahap overlay
// boot dari "Memuat aplikasi…" ke "Menyiapkan meja kerja 3D…".
setBootStagePreparing()

// ===== Penangan global self-healing (SH-1) — didaftarkan SEKALI di
// titik masuk, sebelum render pertama:
// 1. Error chunk basi (deploy baru mengganti hash berkas) → muat ulang
//    halaman maksimal satu kali per jendela 60 detik (chunkHealing);
//    bila tetap gagal, tampilkan pesan jujur di overlay boot —
//    tidak pernah loop reload.
// 2. Error global lain + janji yang ditolak tanpa penangan → dicatat
//    ke log error lokal (errorLog.ts) untuk diagnosis belakangan.
const CHUNK_GAVE_UP_MESSAGE =
  'Aplikasi gagal dimuat walau sudah dicoba dimuat ulang. Periksa koneksi internet, lalu muat ulang halaman secara manual.';

window.addEventListener('error', (event) => {
  const outcome = handleChunkLoadError(event.error ?? event.message);
  if (outcome === 'reloaded') return;
  if (outcome === 'gave-up') {
    showBootError(CHUNK_GAVE_UP_MESSAGE);
    return;
  }
  if (event.error) logError(event.error, 'window.onerror');
});

window.addEventListener('unhandledrejection', (event) => {
  const outcome = handleChunkLoadError(event.reason);
  if (outcome === 'reloaded') return;
  if (outcome === 'gave-up') {
    showBootError(CHUNK_GAVE_UP_MESSAGE);
    return;
  }
  logError(event.reason, 'unhandledrejection');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RecoveryBoundary scope="app">
      <App />
    </RecoveryBoundary>
  </StrictMode>,
)
