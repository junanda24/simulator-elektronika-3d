# STYLE_GUIDE.md — Desain Visual & Identitas "Tactile ESD Workbench"

## 1. Filosofi Desain: "Meja Bengkel Elektronik Modern"
Antarmuka dirancang menyerupai meja praktikum teknisi profesional yang dipadukan dengan instrumen ukur modern (terinspirasi dari alas kerja anti-statis *ESD Mat*, alat ukur *Fluke*, dan antarmuka *Blender*). Bersih dari gimik kekanak-kanakan, fokus penuh pada keterbacaan teknis dan kejelasan visual 3D.

---

## 2. Palet Warna (CSS Variables / Tailwind v4 Tokens)

### A. Latar & Permukaan UI (Dark Mode Default)
- `--bg-workbench-mat`: `#0F241D` (Hijau Tua Alas Potong ESD dengan grid milimeter halus `#18382D`)
- `--bg-panel`: `#12151C` (Matte Charcoal untuk panel UI dengan keburaman `backdrop-blur-md`)
- `--bg-panel-elevated`: `#1A1E28` (Kartu komponen, bar atas, tab aktif)
- `--border-subtle`: `#282E3D` (Garis batas panel 1px tegas)

### B. Warna Semantik & Elektrik
- `--accent-primary`: `#00E5FF` (Electric Cyan — indikator aktif, fokus kamera, tombol aksi sekunder)
- `--accent-run`: `#10B981` (Signal Emerald — tombol Jalankan Simulasi, status rangkaian aman)
- `--accent-warning`: `#F59E0B` (Solder Amber — peringatan arus mendekati batas maksimal)
- `--accent-danger`: `#FF2A54` (Short-Circuit Crimson — korsleting, komponen terbakar, laporan autopsi)

### C. Standar Warna Kabel Jumper & Pinout (Wajib Konsisten)
- **5V Power:** Merah (`#EF4444`)
- **3.3V Power:** Oranye (`#F97316`)
- **GND (Ground):** Hitam (`#1F2937` dengan *specular highlight* abu-abu agar tetap terlihat jelas di atas meja gelap)
- **Digital GPIO / PWM:** Biru (`#3B82F6`), Hijau (`#22C55E`), Ungu (`#A855F7`)
- **Analog Input:** Kuning (`#EAB308`)
- **I2C (SDA / SCL):** Cyan (`#06B6D4`) & Magenta (`#EC4899`)

---

## 3. Tipografi
- **Font UI & Materi Kurikulum:** `Plus Jakarta Sans` (Sangat nyaman dibaca untuk penjelasan panjang berbahasa Indonesia, memiliki kontras tinggi).
- **Font Teknis (Editor Kode, Label Pin 3D, Probe Multimeter, Serial Monitor):** `JetBrains Mono` (Angka tabular sehingga pembacaan tegangan `4.98 V` dan arus `18.4 mA` yang berubah cepat tidak membuat teks bergoyang).

---

## 4. Bahasa Visual 3D & Efek Diagnostik

1. **Material Prosedural Berbasis Fisika (PBR):**
   - **PCB Board:** `MeshPhysicalMaterial` dengan `clearcoat: 0.6`, `roughness: 0.3` (memberikan kilau khas lapisan *solder mask* PCB asli: Biru Teal untuk Uno, Hitam Matte untuk ESP32, Hijau untuk Pico).
   - **Kaki Pin & Konektor:** `metalness: 0.9`, `roughness: 0.2` (warna emas kuningan untuk pin header dan perak timah untuk kaki komponen).
2. **X-Ray Jalur Konduktor Breadboard:**
   - Saat pengguna mengarahkan kursor ke sebuah lubang breadboard, 5 lubang vertikal (atau jalur power horizontal) yang terhubung di bawah plastik menyala dengan pendaran hijau transparan (`#10B981`, opacity `0.45`).
3. **Hover Probe (Multimeter Instan):**
   - Mengarahkan kursor ke pin atau kabel mana pun saat simulasi berjalan menampilkan *floating pill badge* kecil di samping kursor: `[GPIO 2] 3.30 V | 12.4 mA`.
4. **Animasi & Kamera Autopsi Kerusakan:**
   - Ketika komponen rusak, waktu simulasi otomatis di-pause, kamera 3D meluncur mulus (durasi `600ms`, easing `power3.out`) mendekati titik komponen yang berasap, jalur kabel penyebab arus berlebih menyala merah berdenyut, dan **Kartu Autopsi Kerusakan** muncul di sisi komponen.

---

## 5. Tata Letak Layar (Optimal pada Resolusi 1366x768 ke Atas)

- **Top Toolbar (Tinggi 48px):** Pemilih Mode (`Sandbox` / `Belajar`), Pemilih Board (`Arduino Uno`, `ESP32`, `NodeMCU`, `Pico`), Tombol Kontrol Simulasi (`Jalankan`, `Pause`, `Reset`), Toggle X-Ray Arus, dan Tombol `Bagikan Link`.
- **Left Dock (Lebar 260px, Collapsible):** Katalog komponen dengan pencarian instan, filter kategori, dan kartu komponen yang bisa di-*drag-and-drop* langsung ke meja 3D.
- **Center Viewport (70%–100% Layar):** Stage 3D interaktif penuh. Dilengkapi tombol cepat di sudut bawah untuk *Reset Kamera*, *Top View (2D-like)*, dan *Perspective View*.
- **Right Dock (Lebar 380px, Collapsible & Resizable):** Panel bertab yang berisi:
  1. `Kode Sketch` (CodeMirror + tombol kompilasi)
  2. `Serial Monitor / Plotter` (Dapat dibuka sebagai *split pane* di bawah editor kode)
  3. `Panduan Belajar` (Instruksi langkah demi langkah dan *checklist* target misi otomatis)
