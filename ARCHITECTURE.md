# ARCHITECTURE.md — 3D Interactive Electronics Simulator

## 1. Prinsip Utama Arsitektur
1. **100% Client-Side & Zero Backend:** Seluruh simulasi elektrik, kompilasi/interpretasi sketch, dan rendering 3D berjalan di browser pengguna.
2. **Dual-Thread Isolation (Anti-Freeze):** 
   - **Main Thread:** Hanya menangani UI React, state visual Zustand, interaksi 3D (Three.js/R3F), dan audio sintetis.
   - **Simulation Web Worker:** Menangani kalkulasi matriks MNA (Modified Nodal Analysis), eksekusi kode Arduino (Virtual Clock), dan deteksi kerusakan komponen.
3. **Zero-Core-Touch Modularity (Plugin Architecture):** 
   - Mesin utama (`stage3d`, `wiring`, `simulation`) **dilarang keras** melakukan *hardcode* nama komponen (seperti `if (type === 'LED')`).
   - Semua komponen dan board wajib didaftarkan melalui `ComponentPlugin` dan `BoardPlugin` contract. Menambah komponen baru cukup membuat 1 folder di `src/shared/components/catalog/` dan mendaftarkannya di `registry.ts`.

---

## 2. Struktur Direktori (Feature-Based)

```text
src/
├── app/                        # Bootstrap aplikasi, layout utama, global providers
├── features/
│   ├── stage3d/                # Lingkungan 3D utama
│   │   ├── components/         # Canvas, ESD Workbench Mat, Lighting, CameraRig
│   │   ├── gizmos/             # 3D Interactive Manipulators (slider jarak, pemutar potensio)
│   │   ├── effects/            # Partikel asap, percikan api, X-Ray jalur breadboard, thermal glow
│   │   └── hooks/              # Mathematical grid snapping, raycast plane handler
│   ├── wiring/                 # Sistem penarikan kabel 3D
│   │   ├── components/         # CatmullRom 3D wire mesh, pin hover indicator
│   │   └── store/              # State penarikan kabel aktif, warna kabel, kurva bezier/spline
│   ├── simulation/             # Jantung simulasi elektrik
│   │   ├── solver/             # MNA Matrix builder, LU Decomposition solver, PWL handler
│   │   ├── damage/             # Evaluator aturan kerusakan & generator laporan autopsi
│   │   └── worker/             # Web Worker entrypoint & jembatan komunikasi (Comlink)
│   ├── sketch/                 # Pemrograman mikrokontroler
│   │   ├── editor/             # CodeMirror 6 wrapper, syntax highlighting, autocomplete
│   │   ├── runtime/            # Transpiler C++ ke Async JS Generator, Virtual Clock, API Arduino
│   │   └── serial/             # Serial Monitor & Serial Plotter UI
│   └── lessons/                # Mode belajar terstruktur & evaluasi misi
│       ├── engine/             # Rule assertions (cek apakah rangkaian & kode memenuhi syarat lulus)
│       └── curriculum/         # File JSON/TS kurikulum Bahasa Indonesia
├── shared/
│   ├── types/                  # Kontrak TypeScript global (Plugin interfaces, MNA types)
│   ├── boards/                 # Definisi & model 3D prosedural Board
│   │   ├── registry.ts         # Pendaftaran semua board
│   │   ├── uno/                # Arduino Uno R3 (5V logic)
│   │   ├── esp32/              # ESP32 DevKit V1 (3.3V logic)
│   │   ├── nodemcu/            # NodeMCU ESP8266 (3.3V logic)
│   │   └── pico/               # Raspberry Pi Pico (3.3V logic)
│   ├── components/             # Katalog Komponen Modular (Sistem Plugin)
│   │   ├── registry.ts         # Single source of truth seluruh komponen
│   │   ├── primitives/         # Geometri 3D reusable (kaki pin, badan IC, gelang resistor, PCB)
│   │   └── catalog/            # 1 Folder = 1 Komponen mandiri
│   │       ├── led/
│   │       ├── resistor/
│   │       ├── pushbutton/
│   │       ├── ultrasonic-hcsr04/
│   │       └── ... (komponen lainnya)
│   └── utils/                  # CanvasTexture generator, lz-string URL serializer, WebAudio synth
```

---

## 3. Kontrak Modularitas (`ComponentPlugin` Interface)

Setiap komponen di `src/shared/components/catalog/<nama-komponen>/` wajib mengimplementasikan kontrak berikut agar otomatis dikenali oleh Katalog UI, Stage 3D, Sistem Kabel, dan Solver MNA:

```typescript
export interface PinDefinition {
  id: string;                  // Contoh: 'ANODE', 'CATHODE', 'VCC', 'TRIG'
  label: string;               // Ditampilkan saat hover di 3D
  localPosition: [number, number, number]; // Posisi relatif terhadap titik tengah komponen (satuan pitch 2.54mm)
  type: 'power' | 'ground' | 'digital' | 'analog' | 'passive' | 'terminal';
}

export interface ComponentInstanceState {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: number;
  props: Record<string, any>;  // Contoh: { resistance: 220, color: 'red' }
  interactiveState: Record<string, any>; // Contoh: { pressed: true, distanceCm: 15, lux: 800 }
  simState: {                  // Di-update oleh Web Worker setiap tick
    pinVoltages: Record<string, number>;
    branchCurrents: Record<string, number>;
    isDamaged: boolean;
    damageReport?: DamageReport;
  };
}

export interface ComponentPlugin {
  // 1. Metadata Katalog
  type: string;                // ID unik, misal: 'led-5mm'
  name: string;                // Nama tampil: 'LED 5mm'
  category: 'passive' | 'output' | 'input' | 'sensor' | 'actuator' | 'display';
  descriptionId: string;       // Penjelasan singkat fungsi komponen (Bahasa Indonesia)
  defaultProps: Record<string, any>;
  pins: PinDefinition[];

  // 2. Render 3D & Interaksi Langsung di Stage
  Render3D: React.FC<{
    instance: ComponentInstanceState;
    onInteract: (newState: Partial<ComponentInstanceState['interactiveState']>) => void;
  }>;

  // 3. Perilaku Elektrik (Berjalan di Web Worker)
  electrical: {
    // Mengisi nilai konduktansi (G) dan sumber arus/tegangan ke matriks MNA
    stampMNA: (matrix: MNAMatrix, instance: ComponentInstanceState, dt: number) => void;
    // Evaluasi apakah komponen rusak pada tick ini berdasarkan hasil tegangan/arus MNA
    checkDamage: (instance: ComponentInstanceState, dt: number) => DamageReport | null;
  };
}
```

---

## 4. Alur Data & Sinkronisasi Thread

1. **Perubahan Rangkaian (Main Thread -> Worker):**
   Saat pengguna memasang komponen, menarik kabel, atau menggeser *gizmo* sensor 3D (misal mengubah jarak objek ultrasonik), Zustand mengirim *Netlist Delta* ke Web Worker.
2. **Siklus Simulasi (Di dalam Web Worker):**
   - Worker menjalankan `Sketch Runtime` sesuai *Virtual Clock* untuk menentukan status pin output MCU (`HIGH`/`LOW`/PWM).
   - Worker membangun matriks MNA dari *Netlist* aktif dan menyelesaikan persamaan linear $A \cdot x = z$.
   - Worker menjalankan `checkDamage()` untuk setiap komponen dan pin board yang aktif.
3. **Sinkronisasi Visual (Worker -> Main Thread):**
   - Maksimal 30–60 kali per detik (dibatasi agar tidak membanjiri *message queue*), Worker mengirim `SimulationSnapshot` berupa `Float32Array` (tegangan tiap node, arus tiap cabang, dan event kerusakan).
   - Komponen 3D membaca nilai ini secara reaktif untuk menyalakan intensitas cahaya LED, memutar tanduk servo, memperbarui layar OLED, atau memicu animasi asap/percikan api.
