# Proposal — Batch 4: Mode Lesson, Share Link, Ekspor .rangkai

Blueprint: ROADMAP.md Batch 4.

## Yang dibangun
1. Kurikulum 8 modul Bahasa Indonesia (src/features/lessons/curriculum.ts): materi singkat, rangkaian awal & sketch awal yang bisa dimuat sekali klik, board target per modul.
2. Mesin assertion (src/features/lessons/engine.ts): pemeriksaan terstruktur atas state live (komponen hadir, arus cabang, tegangan net, state pin, keluaran serial, kerusakan yang disengaja) — dievaluasi dari snapshot sesi + netlist.
3. Tab Panduan di Right Dock: daftar modul, checklist assertion live, status selesai tersimpan di localStorage.
4. Share link: seluruh proyek (board, komponen, kabel, sketch) diserialkan lz-string ke hash URL; membuka link memuat proyek. Ekspor/impor berkas .rangkai (JSON).

## Skenario wajib lolos
- Modul 2 (Blink) lulus saat rangkaian demo + sketch bawaan berjalan.
- Modul 6 (arus berlebih) lulus HANYA setelah kerusakan LED_OVERCURRENT benar-benar terjadi.
- Share: serialkan → deserialkan menghasilkan state yang sama (round-trip tes).
