# Proposal — Batch 9: Kamera Sinematik, Shortcut, Tool Actions, Probe

Tambahan user di batch ini: tool delete khusus + pilihan sudut kamera.

## Yang dibangun
1. cameraView di store + CameraRig menghormatinya (GSAP 0,6 dtk ke posisi + target eksplisit); fokus autopsi lama tidak diubah. Preset: Perspektif (home), Atas (tegak lurus breadboard), Depan, Dekat (instance terpilih / pusat breadboard).
2. Shortcut penuh dengan penjaga fokus editor/input (menutup lubang lama: Delete saat mengetik bisa menghapus komponen): Esc, Delete/Backspace, R (rotasi draft), Space (jalan/jeda, preventDefault), 1–6 (warna kabel), Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y.
3. Bar peralatan: swatch 6 warna bernomor, Undo/Redo (disabled state), Mode Hapus (klik item terpilih langsung terhapus + bunyi, kursor crosshair, Esc keluar), toggle Suara, teks petunjuk.
4. AutopsyCard: tombol "Lihat Titik Rusak" (komponen & pin board) via setCameraView.
5. Probe hover: nama net + tegangan berwarna status terhadap tegangan logika board (hijau/kuning/merah overvoltage) + arus ≈ hanya untuk pin komponen bercabang tunggal (tidak menebak multi-cabang).
6. Lighting: shadows PCFSoft + ContactShadows drei; tanpa Environment (menghindari unduhan HDR runtime).
