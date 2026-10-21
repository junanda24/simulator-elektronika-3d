/**
 * Penggerak overlay boot di index.html (perintah user 2026-10-21:
 * user tidak boleh menunggu tanpa tahu proses di belakang layar).
 *
 * Overlay dan seluruh gayanya hidup di index.html agar tampil sejak
 * HTML pertama — sebelum bundle JS (±1,9MB) dan CSS aplikasi tiba.
 * Modul ini hanya mengganti teks tahapnya dan memudarkannya; sinyalnya
 * jujur, diambil dari peristiwa nyata:
 *   1. "Memuat aplikasi…"      — bawaan HTML, selama bundle diunduh.
 *   2. "Menyiapkan meja kerja 3D…" — main.tsx tereksekusi (bundle sudah
 *      jalan, React mulai merender).
 *   3. Memudar ≤200ms — App ter-commit dan loop R3F diberi kesempatan
 *      menyajikan frame pertamanya (lihat efek boot di App.tsx).
 * Bila overlay sedang berstatus error (WebGL tidak tersedia / bundle
 * gagal dimuat — dideteksi skrip penjaga inline di index.html),
 * pemudaran DITOLAK: pesan error harus tetap terbaca, bukan ditelan.
 */

const OVERLAY_ID = 'boot-overlay';
const STAGE_ID = 'boot-stage';
const DONE_CLASS = 'boot-done';
const ERROR_CLASS = 'boot-error';

/** Tahap 2: bundle sudah tereksekusi, perenderan dimulai. */
export function setBootStagePreparing(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay || overlay.classList.contains(ERROR_CLASS)) return;
  const stage = document.getElementById(STAGE_ID);
  if (stage) stage.textContent = 'Menyiapkan meja kerja 3D…';
}

/**
 * Tampilkan pesan error pada overlay boot — dipakai jalur penyembuhan
 * chunk (chunkHealing.ts) saat reload otomatis sudah pernah dicoba dan
 * pemuatan tetap gagal: user mendapat penjelasan jujur di overlay yang
 * sama, bukan loop reload atau layar kosong. Bila overlay sudah
 * dicabut dari DOM (error terjadi di tengah sesi), fungsi ini tidak
 * berpengaruh — errornya tetap tercatat di log error lokal.
 */
export function showBootError(message: string): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  overlay.classList.add(ERROR_CLASS);
  const stage = document.getElementById(STAGE_ID);
  if (stage) stage.textContent = message;
}

/**
 * Selesai: pasang kelas pudar (transisi 200ms di index.html) lalu cabut
 * node dari DOM. Idempoten — panggilan berulang tidak berpengaruh.
 */
export function finishBootOverlay(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;
  if (overlay.classList.contains(ERROR_CLASS)) return;
  if (overlay.classList.contains(DONE_CLASS)) return;
  overlay.classList.add(DONE_CLASS);
  window.setTimeout(() => overlay.remove(), 260);
}
