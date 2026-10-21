# ROADMAP.md — Rencana Eksekusi Bertahap & SOP Ekspansi Komponen

## 1. Strategi Eksekusi 5 Batch

Proyek dibangun secara inkremental. Setiap batch menghasilkan produk yang langsung dapat diuji secara menyeluruh sebelum melangkah ke batch berikutnya.

### Batch 1: Core Engine, Plugin Registry & Siklus "Rangkai -> Nyala -> Meledak"
- [ ] Setup project React 19 + Vite + Tailwind v4 + R3F v9 + Zustand + Web Worker (`comlink`).
- [ ] Implementasi `ComponentPlugin` & `BoardPlugin` registry di `src/shared/`.
- [ ] Buat **Stage 3D ESD Workbench** dengan kontrol kamera orbit yang dibatasi sudutnya (tidak bisa menembus bawah meja).
- [ ] Buat **Breadboard 830 titik** (`InstancedMesh` + Mathematical Grid Snapping + X-Ray highlight jalur konduktor).
- [ ] Buat Board pertama: **Arduino Uno R3** prosedural lengkap dengan `CanvasTexture` silkscreen.
- [ ] Buat sistem **Wiring 3D** (`CatmullRomCurve3`, kustomisasi warna kabel, hapus/pindah ujung kabel).
- [ ] Bangun **MNA Solver v1** (Linear + Piecewise-Linear) di Web Worker + Hover Multimeter Probe.
- [ ] Buat 2 komponen pertama via Plugin Registry: **Resistor** (gelang warna dinamis sesuai nilai Ohm) & **LED 5mm**.
- [ ] Implementasi **Damage Engine v1** + Efek Asap 3D + Kamera Zoom Autopsi + **Kartu Autopsi Kerusakan** (uji kasus: colok LED ke 5V & GND tanpa resistor -> LED gosong).

### Batch 2: Sketch Runtime, Virtual Clock & Interaksi 3D Dasar
- [ ] Integrasi editor `@codemirror` dengan *syntax highlighting* C++ Arduino.
- [ ] Bangun **Transpiler Sketch ke Async JS Generator** di Web Worker (`setup`, `loop`, `pinMode`, `digitalWrite`, `digitalRead`, `analogWrite`, `analogRead`, `delay`, `millis`, `Serial`).
- [ ] Buat panel **Serial Monitor**.
- [ ] Tambahkan komponen input interaktif 3D pertama: **Push Button** (klik di 3D) dan **Potensiometer** (putar knob di 3D).
- [ ] Tambahkan aturan kerusakan **`POWER_SHORT_CIRCUIT`** (5V ketemu GND langsung) dan **`MCU_PIN_OVERCURRENT`**.

### Batch 3: Multi-Board Ecosystem & Aturan Lintas Tegangan (5V vs 3.3V)
- [ ] Tambahkan 3 Board baru ke `src/shared/boards/`:
  - **ESP32 DevKit V1** (Logika 3.3V)
  - **NodeMCU ESP8266** (Logika 3.3V)
  - **Raspberry Pi Pico** (Logika 3.3V)
- [ ] Implementasi fitur ganti board secara instan di atas meja kerja.
- [ ] Aktifkan aturan kerusakan **`MCU_PIN_OVERVOLTAGE`**: sinyal 5V yang masuk ke pin GPIO board 3.3V langsung merusak pin tersebut disertai edukasi *Voltage Divider* / *Logic Level Converter*.

### Batch 4: Mode Belajar Terstruktur (Kurikulum Bahasa Indonesia) & Share Link
- [ ] Bangun **Lesson Evaluator Engine** yang memantau state MNA & sirkuit secara *real-time* untuk memvalidasi kelulusan misi.
- [ ] Susun kurikulum awal (8 Modul Dasar untuk SMK & Pemula):
  1. *Cara Kerja Jalur Breadboard*
  2. *Hukum Ohm & Mengapa LED Butuh Resistor*
  3. *Bahaya Korsleting (Short Circuit) & Jalur Ground*
  4. *Program Pertama: Blink LED Digital*
  5. *Membaca Tombol & Misteri Pin Floating (Pull-up/Pull-down)*
  6. *Input Analog & Mengatur Terang LED dengan PWM*
  7. *Bahaya Sinyal 5V pada Board 3.3V (ESP32/Pico)*
  8. *Tantangan Forensik: Perbaiki 3 Rangkaian yang Rusak Ini!*
- [ ] Implementasi fitur **Share via URL (`lz-string`)** serta Ekspor/Impor file `.rangkai` agar guru dan siswa bisa berbagi rangkaian tanpa akun.

### Batch 5: Ekspansi Katalog 20 Komponen (Plug-and-Play)
Memanfaatkan arsitektur plugin dari Batch 1, tambahkan komponen dalam 3 gelombang:
- **Gelombang 5A (Output, Audio & Indikator):**
  - `rgb-led` (Common Cathode/Anode)
  - `buzzer` (Active & Passive dengan suara nyata via Web Audio API)
  - `seven-segment` (1 digit, Common Cathode/Anode)
  - `relay-5v` (Beserta aturan kerusakan *Back-EMF* jika koil dikontrol tanpa driver/dioda)
- **Gelombang 5B (Sensor dengan Manipulator 3D):**
  - `ldr` (Sensor cahaya + senter virtual 3D)
  - `ultrasonic-hcsr04` (Sensor jarak + papan target geser 3D)
  - `dht11` (Sensor suhu & kelembapan + kontrol *floating dial* 3D)
  - `pir-sensor` (Sensor gerak + tombol simulasi gerakan objek di 3D)
  - `soil-moisture` (Sensor kelembapan tanah + slider kebasahan 3D)
- **Gelombang 5C (Aktuator, Input Lanjutan & Layar):**
  - `servo-sg90` (Tanduk berputar di 3D + simulasi *stall current* jika dikunci)
  - `dc-motor` + `driver-l298n` (Kecepatan & arah putar 3D + bahaya colok motor tanpa driver)
  - `joystick-ky023` (Tongkat 3D yang bisa digeser 2 sumbu + klik tengah)
  - `keypad-4x4` (16 tombol yang bisa diklik langsung di 3D)
  - `lcd-16x2-i2c` & `oled-ssd1306` (Dirender tajam per piksel/karakter menggunakan `CanvasTexture`)

---

## 2. SOP Menambah Komponen Baru (5 Langkah)

Karena sistem sudah modular, setiap kali ingin menambahkan komponen baru di masa depan, cukup ikuti 5 langkah ini tanpa mengedit kode *core*:

1. **Buat Folder Baru:** Buat direktori `src/shared/components/catalog/<slug-komponen>/`.
2. **Definisi Pin & Metadata (`meta.ts`):** Tentukan koordinat kaki pin dalam kelipatan pitch $2.54\text{ mm}$, nama komponen, kategori, dan properti default.
3. **Model & Interaksi 3D (`model3d.tsx`):** Susun geometri komponen menggunakan primitif yang tersedia di `shared/components/primitives/`, lalu tambahkan handler `onClick` / `onPointerDown` jika komponen memiliki bagian mekanis yang bisa digerakkan pengguna.
4. **Model Elektrik & Aturan Rusak (`electrical.ts`):** Tulis fungsi `stampMNA()` untuk menyuntikkan resistansi/sumber tegangan ke matriks, dan `checkDamage()` untuk menentukan batas aman tegangan/arusnya.
5. **Registrasi (`registry.ts`):** Impor plugin tersebut dan masukkan ke dalam array `COMPONENT_REGISTRY`. Komponen otomatis muncul di sidebar katalog, bisa dipasang ke breadboard, bisa ditarik kabelnya, dan langsung dihitung oleh solver MNA.
