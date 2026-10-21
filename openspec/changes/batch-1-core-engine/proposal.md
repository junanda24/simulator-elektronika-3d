# Proposal — Batch 1: Core Engine, Plugin Registry & Siklus "Rangkai → Nyala → Meledak"

## Apa ini

Simulator Elektronika 3D interaktif berbasis web: pengguna merangkai rangkaian elektronik di atas meja kerja 3D (board mikrokontroler + breadboard + komponen), menjalankan simulasi elektrik yang dihitung secara nyata, dan belajar dari konsekuensi — termasuk komponen yang rusak bila rangkaian dipasang salah.

Batch 1 membangun fondasinya: mesin simulasi MNA, kontrak plugin komponen/board, stage 3D (meja kerja ESD + breadboard + Arduino Uno prosedural), sistem wiring, dua komponen pertama (Resistor & LED), dan Damage Engine v1 dengan Kartu Autopsi Kerusakan.

## Kenapa ini dibuat (latar belakang)

1. Belajar elektronik itu mahal dan berisiko: sekali salah colok, board/komponen mati beneran. Yang paling sering salah justru pemula.
2. Kit fisik tidak selalu terjangkau; sekolah sering tidak punya perangkat cukup untuk semua siswa.
3. Simulator yang ada kurang: Wokwi fokus emulasi kode tanpa konsekuensi kerusakan, Tinkercad perlu akun dan tampilannya 2D, situs referensi sejenis hanya mendukung satu board dengan komponen sedikit dan tanpa konsekuensi salah pasang.
4. Hampir semua simulator berbahasa Inggris — pelajar Indonesia (terutama SMK) terhambat dua kali.

## Solusi yang ditawarkan

Simulator 3D gratis di browser (tanpa install, tanpa login, tanpa backend) dengan board yang bisa diganti-ganti, katalog komponen besar berbasis plugin, simulasi elektrik nyata (MNA), dan aturan kerusakan yang edukatif: salah pasang = rusak, tapi rusaknya gratis dan dijelaskan penyebabnya (Mode Autopsi). Bahasa Indonesia, mode lesson terstruktur + sandbox.

## Dokumen pengarah (blueprint, disetujui pengguna 2026-10-21)

- `ARCHITECTURE.md` — struktur feature-based, dual-thread (Main vs Simulation Worker), kontrak `ComponentPlugin`/`BoardPlugin`.
- `TECH_STACK.md` — dependency & strategi optimasi 3D.
- `SIMULATION_RULES.md` — pemodelan MNA, matriks aturan kerusakan, aturan interaksi 3D.
- `STYLE_GUIDE.md` — identitas "Tactile ESD Workbench".
- `ROADMAP.md` — eksekusi 5 batch + SOP penambahan komponen.

## Scope Batch 1 (change ini)

- Setup proyek + registry plugin.
- Solver MNA v1 (linear + PWL 2-state untuk LED) berjalan sebagai modul murni (siap dipindah ke Web Worker), dengan tes angka.
- Kontrak tipe global (`PinDefinition`, `ComponentInstanceState`, `ComponentPlugin`, `DamageReport`).
- Plugin Resistor & LED 5mm (elektrik + checkDamage).
- Aturan kerusakan pertama: `LED_OVERCURRENT` (+ `LED_REVERSE_BREAKDOWN`).
- Stage 3D dasar + Uno + breadboard dirender (dilanjutkan iterasi Batch 1 berikutnya: wiring interaktif penuh, efek asap, kamera autopsi).

## Di luar scope change ini

Sketch runtime (Batch 2), board 3.3V & aturan overvoltage (Batch 3), kurikulum lesson (Batch 4), ekspansi 20 komponen (Batch 5), deploy publik (keputusan pengguna, terpisah).

## IP check

Semua model 3D prosedural dari geometri Three.js; tidak ada aset, sprite, logo, atau tekstur pihak ketiga. Nama board (Arduino Uno, ESP32, dst.) dipakai sebagai label faktual perangkat yang disimulasikan. Tidak ada materi berhak cipta yang direproduksi.

## Kepatuhan standar

- `CODE_STANDARDS.md`: TypeScript strict, tanpa `any` liar di kontrak publik, file fokus < 300 baris.
- `ARCHITECTURE.md` (standar web kita): feature-based, tanpa import antar-fitur, state masuk keranjang yang jelas (state sirkuit = Zustand global klien; snapshot simulasi = data turunan dari Worker; tidak ada server state karena tanpa backend).
