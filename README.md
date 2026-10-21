# Simulator Elektronika 3D

Simulator rangkaian elektronika 3D interaktif di browser untuk belajar Arduino dan mikrokontroler — **tempat berlatih elektronika di mana berbuat salah itu gratis**. Rangkai komponen di breadboard 3D, tulis sketch, jalankan, dan kalau salah pasang: komponen bisa benar-benar rusak, lengkap dengan penjelasan penyebabnya (mode Autopsi).

Tidak perlu login, tidak perlu database, tanpa instalasi. Semua simulasi berjalan lokal di browser.

**Coba langsung: https://simulator-elektronika-3d.vercel.app**

## Kenapa proyek ini ada

Belajar elektronika itu mahal dan berisiko: satu kabel salah colok bisa membunuh board beneran, dan pemula justru paling sering salah. Kit fisik juga tidak terjangkau semua orang. Simulator yang ada umumnya tidak memberi konsekuensi atas kesalahan (arus berlebih tidak merusak apa pun), hanya punya satu board, dan hampir semuanya berbahasa Inggris. Proyek ini menjawabnya: simulasi listrik nyata (bukan animasi), board bisa diganti, 20 komponen, kerusakan dengan konsekuensi dan penjelasan Bahasa Indonesia.

Ditujukan untuk siswa SMK, mahasiswa, pemula hobi elektronika, dan guru yang butuh alat peraga aman.

## Fitur utama

- **Simulasi listrik nyata** — solver Modified Nodal Analysis (MNA) berjalan di Web Worker; tegangan dan arus dihitung dari rangkaianmu, bukan ditebak.
- **4 board yang bisa diganti** — Arduino Uno, ESP32 DevKit, NodeMCU ESP8266, Raspberry Pi Pico, masing-masing dengan profil listrik aslinya (tegangan logika 5V/3,3V, batas arus pin, resolusi ADC, pull-up).
- **20 komponen plug-and-play** — resistor, LED 5mm, LED RGB, push button, potensiometer, kapasitor elektrolit, dioda 1N4007, transistor NPN 2N2222, modul relay 5V, LDR, PIR, LM35, joystick analog, sensor kelembaban tanah, servo SG90, motor DC, buzzer aktif, display 7-segment, sekering, saklar miring.
- **Kerusakan real-case + Kartu Autopsi** — LED gosong kelebihan arus, kapasitor rusak karena polaritas terbalik, pin board mati permanen karena overvoltage/overcurrent, korsleting rel catu daya, sekering putus, motor stall terbakar. Setiap kerusakan dijelaskan penyebab dan cara mencegahnya.
- **Bisa diprogram** — editor sketch Arduino dengan transpiler bawaan (tokenizer + parser tulisan tangan), serial monitor, pinMode/digitalWrite/analogWrite/digitalRead/analogRead berjalan terhadap rangkaian nyatamu.
- **Mode belajar** — 8 modul kurikulum Bahasa Indonesia dengan rangkaian awal sekali klik dan checklist assertion yang memeriksa rangkaianmu secara langsung.
- **Berbagi proyek** — seluruh rangkaian + sketch tersimpan di hash URL (kompresi lz-string) dan ekspor/impor berkas `.rangkai`.
- **Interaksi taktil 3D** — pasang komponen ke breadboard 830 lubang, sambungkan kabel per warna fungsi, hover probe untuk membaca tegangan net secara live, efek asap saat komponen rusak, kamera fokus otomatis ke TKP kerusakan.

## Aturan kerusakan (ringkas)

| Rule ID | Pemicu |
| --- | --- |
| `LED_OVERCURRENT` | Arus LED > 30 mA |
| `LED_REVERSE_BREAKDOWN` | Tegangan balik LED > 5 V |
| `CAP_REVERSE_POLARITY` / `CAP_OVERVOLTAGE` | Kapasitor terbalik > 1 V / melebihi rating |
| `MCU_PIN_OVERCURRENT` | Arus pin > 40 mA (Uno) / 28 mA (ESP32, Pico) / 12 mA (NodeMCU) |
| `MCU_PIN_OVERVOLTAGE` | Tegangan net melebihi logika board + 0,5 V |
| `POWER_SHORT_CIRCUIT` | Rel catu daya terhubung langsung ke GND |
| `TRANSISTOR_OVERCURRENT` | Arus kolektor > 0,8 A |
| `MOTOR_STALL` | Arus motor > 1 A (poros terkunci) |
| `FUSE_BLOWN` | Arus melewati sekering > rating — rangkaian terbuka, ganti sekering |

Detail lengkap: [SIMULATION_RULES.md](SIMULATION_RULES.md).

## Menjalankan lokal

```bash
npm install
npm run dev      # mode pengembangan
npm run build    # build produksi
npm test         # 286 tes (vitest)
```

## Teknologi

React 19 + Vite + TypeScript, Tailwind CSS 4, React Three Fiber v9 (3D), zustand (state), comlink (jembatan Web Worker untuk solver), CodeMirror 6 (editor sketch), GSAP (animasi kamera), lz-string (share link). Arsitektur feature-based dengan kontrak plugin komponen/board — inti simulasi tidak pernah menyebut nama komponen (zero-core-touch).

Dokumen desain: [ARCHITECTURE.md](ARCHITECTURE.md) · [TECH_STACK.md](TECH_STACK.md) · [STYLE_GUIDE.md](STYLE_GUIDE.md) · [ROADMAP.md](ROADMAP.md) · riwayat per batch di `openspec/changes/`.

## Penyederhanaan yang disadari

- **HC-SR04, DHT22, LCD/OLED tidak dimasukkan** — protokolnya berbasis pewaktuan pulsa digital / I2C yang tidak bisa dimodelkan secara jujur oleh solver DC tunak. Diganti LM35 dan sensor kelembaban tanah yang keluarannya analog nyata.
- **Servo** — sudut mengikuti rasio tegangan rata-rata pin sinyal (duty PWM), bukan lebar pulsa 1–2 ms seperti hardware asli.
- **Buzzer** — perilaku elektrik dan visual lengkap; suara WebAudio belum disambungkan.
- **Transpiler sketch** — semantik pembagian mengikuti JavaScript (bukan pemotongan integer C++); tipe library tak dikenal (Servo, DHT, dll.) lolos parse sebagai `null`.

## Status

Roadmap awal 5 batch selesai, dilanjutkan Batch 6–10 (overhaul interaktivitas): audio mekanis Web Audio, undo/redo, rotasi penempatan, kabel elastis + aliran arus + thermal glow, ghost penempatan, gizmo sensor 3D, gerak servo/joystick yang halus, efek ledakan berlapis, preset kamera, shortcut penuh, mode hapus, dan realisme visual (label tercetak breadboard, jejak PCB, material epoxy). Terverifikasi: 286/286 tes lulus, TypeScript bersih, build produksi hijau. Riwayat per batch di `openspec/changes/`. Gelombang redesign HUD (audit design 6 lensa): shell dashboard diganti Floating Studio HUD — tiga kapsul melayang (Run tunggal Jalankan/Berhenti, menu Demo dan Proyek, bantuan "?"), katalog full-height dengan ikon SVG per komponen, dock bawah 7 warna kabel, kamera [3D] [Atas] [Fokus] dengan setViewOffset, board digeser lebih dekat ke breadboard, plus perbaikan aksesibilitas (indikator fokus keyboard, reduced-motion, kontras AA).

Audit menyeluruh 2026-10-21 (gelombang perbaikan pasca-rilis): model transistor diperbaiki (lonjakan Ic fiktif belasan ampere saat transisi OFF→ON dan osilasi saturasi yang membuat solver tidak konvergen — diganti ingatan rezim B–E + konduktansi saturasi); jalur Run dibuat anti-mati-diam (bridge membuktikan worker hidup dan jatuh ke sesi lokal bila worker gagal, status UI jujur saat sketch mati, banner error tampil di semua tab, baris yang salah ditandai di editor); transpiler diperkuat (stub library bernama untuk Servo/DHT, builtin Arduino tambahan, pesan "belum didukung" yang eksplisit, nomor baris error titik-koma akurat, `map()` dipotong ala `long` Arduino); performa dipangkas (ContactShadows dibakar sekali, DPR maksimal 1,5, bayangan 1024, memo per instance 3D, netlist kabel terisolasi dari badai snapshot); katalog didesain ulang (pencarian + tab kategori + tile ringkas), toolbar bergrup, kursor tong sampah pada mode hapus; Panduan diperluas dari 8 menjadi 14 modul.
