import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { setBootStagePreparing } from './app/bootOverlay.ts'

// Berkas ini tereksekusi = bundle selesai dimuat: majukan tahap overlay
// boot dari "Memuat aplikasi…" ke "Menyiapkan meja kerja 3D…".
setBootStagePreparing()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
