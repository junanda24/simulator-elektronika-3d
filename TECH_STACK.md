# TECH_STACK.md — Spesifikasi Teknologi & Optimasi Performa

## 1. Core Dependencies

| Kategori | Paket / Teknologi | Peran & Alasan Pemilihan |
| :--- | :--- | :--- |
| **UI & Build** | `react@^19`, `vite`, `typescript`, `tailwindcss@^4` | Fondasi UI deklaratif modern, *build time* instan, styling zero-runtime. |
| **3D Engine** | `three`, `@react-three/fiber@^9`, `@react-three/drei` | Ekosistem 3D deklaratif untuk React. Seluruh komponen menggunakan geometri prosedural tanpa ketergantungan aset `.glb` eksternal. |
| **State Management** | `zustand` | Mengelola state global sirkuit, seleksi komponen, undo/redo, dan sinkronisasi snapshot dari Web Worker tanpa *re-render* berlebih. |
| **Multi-Threading** | Web Workers API + `comlink` | Menjalankan MNA Solver dan interpreter Arduino di background thread dengan RPC berbasis Promise yang bersih. |
| **Code Editor** | `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-cpp` | Jauh lebih ringan dari Monaco Editor (< 150kB gzipped), mendukung highlight C++/Arduino dan penanda baris error. |
| **Animasi** | `gsap` | Transisi kamera 3D saat fokus ke komponen rusak (Autopsi), animasi lipat panel UI, dan efek *micro-interaction*. |
| **Audio Sintetis** | Native `Web Audio API` | Menghasilkan suara buzzer (frekuensi PWM nyata), bunyi *klik* mekanis relay/pushbutton, dan suara *pop/sizzle* saat komponen terbakar tanpa file MP3. |
| **Sharing & Save** | `lz-string` | Mengompresi seluruh state JSON rangkaian + kode menjadi string URL hash (`#s=...`) untuk berbagi tugas tanpa database/login. |

---

## 2. Strategi Optimasi 3D (Target: 60 FPS di Laptop Spek Sekolah)

Karena target pengguna mencakup pelajar SMK dengan laptop berprosesor rendah (Intel Celeron/i3 dengan GPU terintegrasi), aturan optimasi 3D berikut bersifat mutlak:

1. **`THREE.InstancedMesh` untuk Lubang Breadboard & Pin Header:**
   - Breadboard 830 lubang dan puluhan pin header board tidak boleh dirender sebagai komponen `<mesh>` individual. Semuanya harus digabung dalam satu *draw call* menggunakan `<Instances>` dari `@react-three/drei`.
2. **Mathematical Grid Snapping (Zero Hole Raycasting):**
   - Dilarang memasang event listener (`onPointerMove`, `onClick`) pada ratusan lubang breadboard.
   - Gunakan **satu bidang datar transparan (`PlaneGeometry`)** di atas permukaan meja dan breadboard.
   - Ambil titik potong raycast `(x, z)`, lalu konversi ke koordinat matriks lubang terdekat secara matematis menggunakan pembulatan jarak standar pitch elektronik ($2.54\text{ mm}$).
3. **Procedural Silkscreen dengan `THREE.CanvasTexture`:**
   - Agar board (Uno, ESP32, NodeMCU, Pico) dan layar (LCD 16x2, OLED) tampak realistis tanpa memuat file tekstur gambar berukuran besar, buat fungsi utilitas yang menggambar teks pinout (`GND`, `5V`, `GPIO4`), logo, dan jalur PCB ke dalam elemen `<canvas>` 2D di memori, lalu konversi menjadi `CanvasTexture`.
4. **On-Demand / Throttled Frame Updates:**
   - Saat simulasi berstatus `STOPPED` dan pengguna tidak menggerakkan kamera atau kursor, turunkan beban GPU dengan menghentikan *loop* animasi partikel dan shader.

---

## 3. Desain Mesin Interpreter Sketch (Tanpa Emulator CPU Berat)

Menggantikan pendekatan Wokwi (`avr8js` / emulasi instruksi mesin yang berat dan spesifik chip), kita menggunakan **Source-to-Source AST Transpiler ke Async JavaScript Generator**:

1. **Tahap Parsing:** Kode C++ Arduino milik pengguna di-parse menjadi AST ringan untuk mengekstrak variabel global, fungsi `setup()`, fungsi `loop()`, dan fungsi kustom.
2. **Tahap Transformasi Asynchronous:**
   - Fungsi `loop()` diubah menjadi `async function* __userLoop(__api, __clock)`.
   - Pemanggilan fungsi waktu seperti `delay(ms)` diubah menjadi `yield { type: 'DELAY', durationMs: ms }`.
   - Di setiap awal blok perulangan (`while`, `for`), transpiler menyisipkan `yield { type: 'LOOP_GUARD' }` secara otomatis. Ini menjamin kode `while(true) {}` tanpa `delay()` **tidak akan pernah membekukan browser** maupun Web Worker.
3. **API Perangkat Keras Virtual (`__api`):**
   - Mendukung: `pinMode`, `digitalWrite`, `digitalRead`, `analogWrite` (PWM duty cycle $0-255$), `analogRead` (resolusi 10-bit $0-1023$ untuk Uno, 12-bit $0-4095$ untuk ESP32/Pico), `millis`, `micros`, `delay`, `delayMicroseconds`, `Serial.begin`, `Serial.print`, `Serial.println`, serta library standar terintegrasi (`Servo.h`, `DHT.h`, `LiquidCrystal_I2C.h`, `Wire.h`).
