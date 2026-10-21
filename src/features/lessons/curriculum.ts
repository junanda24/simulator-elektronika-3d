import { terminalHoleId, railHoleId } from '../../shared/boards/breadboard';
import type { TerminalRef } from '../wiring/netlist';
import { DEFAULT_SKETCH } from '../sketch/defaultSketch';
import type { Assertion } from './engine';

/**
 * Kurikulum mode Lesson — 20 modul Bahasa Indonesia (8 modul awal
 * ROADMAP Batch 4 + modul 9–14 gelombang lanjutan + modul 15–20
 * gelombang proyek easy→hard).
 * Rangkaian awal dinyatakan dengan id lubang breadboard & pin board
 * yang stabil, mengikuti aturan placement masing-masing komponen.
 */

export interface LessonStarter {
  placements: Array<{
    type: string;
    holeId: string;
    props?: Record<string, unknown>;
  }>;
  wires: Array<{ a: TerminalRef; b: TerminalRef; color: string }>;
  sketch?: string;
}

export interface LessonModule {
  id: string;
  title: string;
  boardId: string;
  intro: string;
  goal: string;
  starter?: LessonStarter;
  assertions: Assertion[];
}

const hole = (holeId: string): TerminalRef => ({ kind: 'hole', holeId });
const pin = (pinId: string): TerminalRef => ({ kind: 'board', pinId });
const T = terminalHoleId;
const RAIL = railHoleId;

const RED = '#ef4444';
const DARK = '#2a2e37';
const BLUE = '#3b82f6';
const YELLOW = '#eab308';

const LED_CURRENT_SAFE: Pick<
  Extract<Assertion, { kind: 'branch-current' }>,
  'minA' | 'maxA'
> = { minA: 0.004, maxA: 0.025 };

export const LESSONS: LessonModule[] = [
  {
    id: 'modul-1-led-pertama',
    title: 'Modul 1 — LED Pertama dari Rel Daya',
    boardId: 'uno',
    intro:
      'LED butuh dua hal: tegangan maju sekitar 2 V dan pembatas arus. Rel 5 V pada breadboard memberi tegangan, resistor 220 Ω membatasi arus di titik aman belasan miliampere. Strip terminal breadboard menghubungkan lima lubang sebaris, jadi kaki komponen yang satu strip otomatis tersambung tanpa kabel.',
    goal: 'Muat rangkaian awal, tekan Jalankan, dan biarkan LED menyala dari rel 5 V.',
    starter: {
      placements: [
        { type: 'resistor', holeId: T('L', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('L', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 24, 2)), color: RED },
        { a: hole(T('L', 22, 4)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
      ],
    },
    assertions: [
      { kind: 'component-present', type: 'resistor', label: 'Resistor terpasang di breadboard' },
      { kind: 'component-present', type: 'led-5mm', label: 'LED terpasang di breadboard' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        ...LED_CURRENT_SAFE,
        label: 'Arus LED di rentang aman 4–25 mA saat simulasi berjalan',
      },
    ],
  },
  {
    id: 'modul-2-blink',
    title: 'Modul 2 — Blink: Program Pertamamu',
    boardId: 'uno',
    intro:
      'Sketch Arduino selalu punya setup() yang berjalan sekali dan loop() yang berputar selamanya. pinMode mengatur arah pin, digitalWrite menulis HIGH (5 V) atau LOW (0 V), dan delay menghentikan program sesaat. Pin D13 dihubungkan ke LED lewat resistor, persis rangkaian demo.',
    goal: 'Jalankan sketch blink dan perhatikan LED berkedip tiap detik sambil Serial Monitor mencetak statusnya.',
    starter: {
      placements: [
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('D13'), b: hole(T('R', 24, 2)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: DEFAULT_SKETCH,
    },
    assertions: [
      { kind: 'pin-mode', pinId: 'D13', mode: 'OUTPUT', label: 'Pin D13 diatur sebagai OUTPUT oleh sketch' },
      { kind: 'serial-contains', text: 'LED nyala', label: 'Serial Monitor menerima cetakan dari sketch' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        ...LED_CURRENT_SAFE,
        label: 'LED benar-benar menyala pada fase HIGH blink',
      },
    ],
  },
  {
    id: 'modul-3-tombol',
    title: 'Modul 3 — Push Button & INPUT_PULLUP',
    boardId: 'uno',
    intro:
      'Pin input yang mengambang membaca nilai acak. Mode INPUT_PULLUP mengaktifkan resistor internal 20 kΩ ke 5 V sehingga pin diam di HIGH, dan tombol yang menghubungkannya ke GND menariknya ke LOW saat ditekan. Pola ini dipakai hampir semua tombol di perangkat asli karena hemat komponen.',
    goal: 'Tekan dan tahan push button di meja 3D (klik modelnya) — LED harus menyala selama tombol ditekan.',
    starter: {
      placements: [
        { type: 'push-button', holeId: T('L', 20, 4) },
        { type: 'resistor', holeId: T('R', 30, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 26, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('D2'), b: hole(T('L', 20, 2)), color: BLUE },
        { a: hole(T('R', 20, 2)), b: hole(RAIL('R-', 15)), color: DARK },
        { a: pin('D13'), b: hole(T('R', 30, 2)), color: BLUE },
        { a: hole(T('R', 28, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(13, OUTPUT);
}

void loop() {
  int tombol = digitalRead(2);
  if (tombol == LOW) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'push-button', label: 'Push button terpasang melintasi kanal breadboard' },
      { kind: 'pin-mode', pinId: 'D2', mode: 'INPUT_PULLUP', label: 'Pin D2 memakai INPUT_PULLUP' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        ...LED_CURRENT_SAFE,
        label: 'LED menyala saat tombol ditekan dan ditahan',
      },
    ],
  },
  {
    id: 'modul-4-potensio',
    title: 'Modul 4 — Potensiometer & analogRead',
    boardId: 'uno',
    intro:
      'Potensiometer adalah pembagi tegangan variabel: dua resistor seri yang titik tengahnya (wiper) bergeser saat knop diputar. analogRead mengubah tegangan wiper 0–5 V menjadi angka 10-bit 0–1023. Putar knop potensiometer di meja 3D dengan menyeretnya ke atas atau bawah.',
    goal: 'Jalankan sketch, putar potensiometer, dan lihat angka ADC berubah di Serial Monitor.',
    starter: {
      placements: [{ type: 'potentiometer', holeId: T('L', 20, 2), props: { value: 10000 } }],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 0)), color: RED },
        { a: hole(T('L', 22, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('A0'), b: hole(T('L', 21, 4)), color: YELLOW },
      ],
      sketch: `void setup() {
  Serial.begin(9600);
}

void loop() {
  int nilai = analogRead(A0);
  Serial.println(nilai);
  delay(200);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'potentiometer', label: 'Potensiometer terpasang' },
      {
        kind: 'net-voltage',
        target: { kind: 'component', type: 'potentiometer', pinId: 'WIPER' },
        minV: 0.3,
        maxV: 4.7,
        label: 'Tegangan wiper berada di antara rel (pembagi bekerja)',
      },
      {
        // Dua ekstrem yang tidak bisa benar bersamaan tanpa putaran
        // penuh (engine sticky mengingat keduanya): menutup celah
        // audit T3 — modul dulu lulus dari posisi tengah bawaan saja.
        kind: 'serial-number-range',
        min: 0,
        max: 80,
        label: 'Putar knop ke minimum — angka Serial turun di bawah 80',
      },
      {
        kind: 'serial-number-range',
        min: 940,
        max: 1023,
        label: 'Putar knop ke maksimum — angka Serial naik di atas 940',
      },
    ],
  },
  {
    id: 'modul-5-pwm',
    title: 'Modul 5 — PWM: Mengatur Kecerahan',
    boardId: 'uno',
    intro:
      'analogWrite tidak mengubah tegangan secara analog; ia menyalakan dan mematikan pin ribuan kali per detik (PWM). Duty cycle 128 dari 255 berarti pin menyala separuh waktu, dan LED terlihat separuh terang. Solver menghitung tegangan rata-ratanya, jadi arus LED ikut separuh.',
    goal: 'Jalankan sketch PWM dan amati LED menyala redup terkendali.',
    starter: {
      placements: [
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('D9'), b: hole(T('R', 24, 2)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(9, OUTPUT);
  analogWrite(9, 128);
}

void loop() {
}
`,
    },
    assertions: [
      { kind: 'pin-pwm', pinId: 'D9', label: 'Pin D9 mengeluarkan PWM (analogWrite aktif)' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.0008,
        maxA: 0.01,
        label: 'Arus LED redup di rentang PWM 0,8–10 mA',
      },
    ],
  },
  {
    id: 'modul-6-bahaya-arus',
    title: 'Modul 6 — Bahaya: LED Tanpa Resistor',
    boardId: 'uno',
    intro:
      'Rangkaian awal modul ini SENGAJA salah: anoda LED terhubung langsung ke rel 5 V tanpa resistor. Arus akan melonjak ke ratusan miliampere dan LED terbakar — di simulator kamu cukup membaca Laporan Autopsi lalu mengganti komponennya. Di dunia nyata, kesalahan ini menghabiskan LED betulan.',
    goal: 'Jalankan dan biarkan LED terbakar, baca autopsinya, lalu perbaiki: ganti LED dan pasang resistor 220 Ω seri di jalur anoda sampai arusnya aman.',
    starter: {
      placements: [{ type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } }],
      wires: [
        { a: pin('5V#3'), b: hole(T('R', 20, 2)), color: RED },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
    },
    assertions: [
      {
        kind: 'damage-occurred',
        ruleId: 'LED_OVERCURRENT',
        label: 'LED terbakar karena arus berlebih (autopsi muncul)',
      },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        ...LED_CURRENT_SAFE,
        label: 'Setelah diperbaiki dengan resistor, arus LED kembali aman',
      },
    ],
  },
  {
    id: 'modul-7-esp32',
    title: 'Modul 7 — Pindah ke ESP32 (Logika 3,3 V)',
    boardId: 'esp32',
    intro:
      'ESP32 bekerja dengan logika 3,3 V, bukan 5 V. Arus LED dari pin 3,3 V lebih kecil, dan yang lebih penting: memasukkan 5 V ke pin ESP32 akan membakarnya permanen (aturan MCU_PIN_OVERVOLTAGE di simulator ini menirunya). Perhatikan dropdown board sudah berganti ke ESP32 DevKit dan LED demo pindah ke pin D2.',
    goal: 'Jalankan blink di ESP32 dan biarkan LED berkedip dengan logika 3,3 V.',
    starter: {
      placements: [
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('D2'), b: hole(T('R', 24, 2)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#0'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(2, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink ESP32 dimulai!");
}

void loop() {
  digitalWrite(2, HIGH);
  delay(500);
  digitalWrite(2, LOW);
  delay(500);
}
`,
    },
    assertions: [
      { kind: 'board-is', boardId: 'esp32', label: 'Board aktif adalah ESP32 DevKit' },
      { kind: 'pin-mode', pinId: 'D2', mode: 'OUTPUT', label: 'Pin D2 diatur sebagai OUTPUT' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.0015,
        maxA: 0.01,
        label: 'Arus LED khas logika 3,3 V (1,5–10 mA)',
      },
    ],
  },
  {
    id: 'modul-8-proyek-akhir',
    title: 'Modul 8 — Proyek Gabungan: Lampu Kendali Ganda',
    boardId: 'uno',
    intro:
      'Proyek gabungan ini merangkai semuanya: tombol sebagai saklar (INPUT_PULLUP), potensiometer sebagai pengatur kecerahan (analogRead + map), dan LED yang dikendalikan PWM. Sketch awal sudah jadi; tugasmu memastikan rangkaian berjalan dan semua peran berfungsi.',
    goal: 'Jalankan proyek, tahan tombol sambil memutar potensiometer — kecerahan LED harus mengikuti putaran knop.',
    starter: {
      placements: [
        { type: 'push-button', holeId: T('L', 20, 4) },
        { type: 'potentiometer', holeId: T('L', 30, 2), props: { value: 10000 } },
        { type: 'resistor', holeId: T('R', 30, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 26, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('D2'), b: hole(T('L', 20, 2)), color: BLUE },
        { a: hole(T('R', 20, 2)), b: hole(RAIL('R-', 15)), color: DARK },
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 30, 0)), color: RED },
        { a: hole(T('L', 32, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('A0'), b: hole(T('L', 31, 4)), color: YELLOW },
        { a: pin('D9'), b: hole(T('R', 30, 2)), color: BLUE },
        { a: hole(T('R', 28, 4)), b: hole(RAIL('R-', 29)), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(2, INPUT_PULLUP);
  pinMode(9, OUTPUT);
}

void loop() {
  int cahaya = analogRead(A0);
  int pwm = map(cahaya, 0, 1023, 0, 255);
  if (digitalRead(2) == LOW) {
    analogWrite(9, pwm);
  } else {
    analogWrite(9, 0);
  }
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'push-button', label: 'Push button terpasang' },
      { kind: 'component-present', type: 'potentiometer', label: 'Potensiometer terpasang' },
      { kind: 'pin-pwm', pinId: 'D9', label: 'PWM aktif saat tombol ditekan dan knop terputar naik' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.0005,
        maxA: 0.025,
        label: 'LED menyala mengikuti kendali tombol + potensiometer',
      },
    ],
  },
  {
    id: 'modul-9-transistor-saklar',
    title: 'Modul 9 — Transistor sebagai Saklar',
    boardId: 'uno',
    intro:
      'Transistor NPN bekerja seperti keran arus: arus kecil masuk ke basis (B) membuka jalan bagi arus yang jauh lebih besar dari kolektor (C) ke emitor (E). Resistor basis 10 kΩ membatasi arus basis di kisaran 0,4 mA, lalu faktor penguatan β (±100 pada 2N2222) melipatgandakannya untuk menyalakan LED. Emitor selalu menuju GND pada pola saklar sisi-rendah ini.',
    goal: 'Muat rangkaian awal dan jalankan sketch — LED harus berkedip mengikuti perintah pin D7 ke basis transistor.',
    starter: {
      placements: [
        { type: 'transistor', holeId: T('L', 20, 2) },
        { type: 'resistor', holeId: T('L', 25, 4), props: { resistance: 10000 } },
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('D7'), b: hole(T('L', 25, 0)), color: BLUE },
        { a: hole(T('L', 20, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('5V#3'), b: hole(RAIL('R+', 4)), color: RED },
        { a: hole(RAIL('R+', 29)), b: hole(T('R', 24, 0)), color: RED },
        { a: hole(T('R', 22, 0)), b: hole(T('L', 22, 4)), color: BLUE },
      ],
      sketch: `void setup() {
  pinMode(7, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(7, HIGH);
  Serial.println("Transistor ON");
  delay(800);
  digitalWrite(7, LOW);
  Serial.println("Transistor OFF");
  delay(800);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'transistor', label: 'Transistor NPN terpasang' },
      { kind: 'component-present', type: 'led-5mm', label: 'LED terpasang di jalur kolektor' },
      { kind: 'pin-mode', pinId: 'D7', mode: 'OUTPUT', label: 'Pin D7 diatur sebagai OUTPUT oleh sketch' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.003,
        maxA: 0.025,
        label: 'LED menyala terang (3–25 mA) saat transistor ON',
      },
      {
        kind: 'branch-current',
        type: 'transistor',
        branch: 'ic',
        minA: 0.002,
        maxA: 0.3,
        label: 'Arus kolektor transistor mengalir di atas 2 mA',
      },
    ],
  },
  {
    id: 'modul-10-relay-motor',
    title: 'Modul 10 — Relay Mengendalikan Motor',
    boardId: 'uno',
    intro:
      'Motor DC menarik arus ratusan miliampere — jauh di atas batas aman pin Arduino (40 mA). Karena itu pin tidak pernah memberi makan motor secara langsung: pin D8 hanya mengirim sinyal ke pin IN relay, koil relay dialiri rel daya lewat VCC dan GND, dan kontak relay menyambungkan rangkaian beban yang sama sekali terpisah. Perhatikan bentuk modul relay yang menjembatani kanal tengah breadboard seperti kaki DIP: pin kendali (VCC, IN, GND) berada di bank kiri dan pin kontak (COM, NO, NC) di bank kanan, sehingga kedua sisi tidak pernah berbagi strip — tidak ada jalan bagi arus beban merembet ke sisi kendali. Inilah isolasi galvanik yang membuat relay aman. Pada rangkaian ini COM menerima 5 V dari rel, NO meneruskannya ke motor saat relay aktif, dan NC sengaja dibiarkan tidak terhubung.',
    goal: 'Jalankan sketch — relay berbunyi klik bergantian dan motor berputar hanya selama relay ON.',
    starter: {
      placements: [
        { type: 'relay', holeId: T('L', 20, 4) },
        { type: 'dc-motor', holeId: T('R', 28, 2) },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 0)), color: RED },
        { a: pin('D8'), b: hole(T('L', 21, 0)), color: BLUE },
        { a: hole(T('L', 22, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('5V#3'), b: hole(RAIL('R+', 4)), color: RED },
        { a: hole(RAIL('R+', 29)), b: hole(T('R', 20, 4)), color: RED },
        { a: hole(T('R', 21, 4)), b: hole(T('R', 28, 0)), color: RED },
        { a: hole(T('R', 30, 0)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(8, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(8, HIGH);
  Serial.println("Relay ON - motor berputar");
  delay(1500);
  digitalWrite(8, LOW);
  Serial.println("Relay OFF - motor berhenti");
  delay(1500);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'relay', label: 'Modul relay terpasang' },
      { kind: 'component-present', type: 'dc-motor', label: 'Motor DC terpasang di kontak relay' },
      { kind: 'pin-mode', pinId: 'D8', mode: 'OUTPUT', label: 'Pin D8 diatur sebagai OUTPUT oleh sketch' },
      {
        kind: 'branch-current',
        type: 'dc-motor',
        branch: 'main',
        minA: 0.1,
        maxA: 0.9,
        label: 'Motor berputar (arus 0,1–0,9 A) saat relay ON',
      },
    ],
  },
  {
    id: 'modul-11-ldr-lampu-otomatis',
    title: 'Modul 11 — Lampu Otomatis Sensor Cahaya',
    boardId: 'uno',
    intro:
      'LDR adalah resistor yang nilainya berubah oleh cahaya: ±200 Ω saat terang benderang dan ±20 kΩ saat gelap total. Diseri dengan resistor tetap 10 kΩ, LDR membentuk pembagi tegangan — titik tengahnya dibaca pin A0. Saat gelap, tegangan titik tengah turun dan sketch menyalakan LED: prinsip yang sama dengan lampu jalan yang menyala sendiri saat senja.',
    goal: 'Jalankan sketch, lalu gelapkan LDR — seret model LDR atau turunkan penggeser Cahaya saat LDR terpilih — sampai angka Serial turun di bawah 600 dan LED menyala otomatis.',
    starter: {
      placements: [
        { type: 'ldr', holeId: T('L', 20, 2) },
        { type: 'resistor', holeId: T('L', 26, 4), props: { resistance: 10000 } },
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 0)), color: RED },
        { a: pin('A0'), b: hole(T('L', 22, 0)), color: YELLOW },
        { a: hole(T('L', 26, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('D13'), b: hole(T('R', 24, 2)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int cahaya = analogRead(A0);
  Serial.println(cahaya);
  if (cahaya < 600) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
  delay(200);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'ldr', label: 'LDR terpasang sebagai pembagi tegangan' },
      {
        // Dipersempit sesuai audit T7: rentang lama 0–1023 terpenuhi
        // oleh angka ADC apa pun (termasuk terang bawaan) — pita gelap
        // ini hanya tercapai bila LDR benar-benar digelapkan.
        kind: 'serial-number-range',
        min: 0,
        max: 600,
        label: 'Angka Serial turun di bawah 600 saat LDR digelapkan',
      },
      {
        kind: 'net-voltage',
        target: { kind: 'component', type: 'ldr', pinId: 'B' },
        minV: 1.0,
        maxV: 2.9,
        label: 'Tegangan pembagi di kaki B LDR turun ke pita gelap 1–2,9 V saat digelapkan',
      },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.003,
        maxA: 0.025,
        label: 'LED menyala otomatis setelah LDR digelapkan',
      },
    ],
  },
  {
    id: 'modul-12-pir-buzzer',
    title: 'Modul 12 — Alarm Gerak PIR + Buzzer',
    boardId: 'uno',
    intro:
      'Sensor PIR membaca perubahan panas inframerah di depannya — saat ada makhluk hangat bergerak, pin OUT-nya naik ke tegangan catu (HIGH). Sketch cukup membaca OUT lewat pin input D2 lalu menyalakan buzzer aktif di D9. Buzzer aktif berbunyi terus selama diberi tegangan searah dengan polaritas benar, jadi tidak perlu sinyal khusus.',
    goal: 'Jalankan sketch, lalu klik kubah putih PIR di meja 3D untuk mensimulasikan gerakan — buzzer harus berbunyi sebagai alarm.',
    starter: {
      placements: [
        { type: 'pir', holeId: T('L', 20, 2) },
        { type: 'buzzer', holeId: T('R', 20, 2) },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 0)), color: RED },
        { a: pin('D2'), b: hole(T('L', 21, 4)), color: BLUE },
        { a: hole(T('L', 22, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('D9'), b: hole(T('R', 20, 0)), color: BLUE },
        { a: hole(T('R', 22, 0)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(2, INPUT);
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int gerak = digitalRead(2);
  if (gerak == HIGH) {
    digitalWrite(9, HIGH);
    Serial.println("Gerakan terdeteksi!");
  } else {
    digitalWrite(9, LOW);
  }
  delay(100);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'pir', label: 'Sensor PIR terpasang' },
      { kind: 'component-present', type: 'buzzer', label: 'Buzzer aktif terpasang' },
      { kind: 'pin-mode', pinId: 'D2', mode: 'INPUT', label: 'Pin D2 diatur sebagai INPUT untuk membaca PIR' },
      {
        kind: 'branch-current',
        type: 'buzzer',
        branch: 'main',
        minA: 0.003,
        maxA: 0.06,
        label: 'Buzzer berbunyi (arus di atas 3 mA) setelah kubah PIR diklik',
      },
    ],
  },
  {
    id: 'modul-13-servo-potensio',
    title: 'Modul 13 — Servo Kendali Potensiometer',
    boardId: 'uno',
    intro:
      'Servo bergerak ke posisi sudut yang diperintahkan, bukan berputar bebas seperti motor. Di simulator ini sudut servo mengikuti tegangan rata-rata sinyal PWM dari pin D9 (penyederhanaan dari pulsa 1–2 ms di perangkat asli). Potensiometer dibaca lewat A0, lalu fungsi map mengubah rentang ADC 0–1023 menjadi rentang PWM 0–255 untuk menggerakkan tanduk servo.',
    goal: 'Jalankan sketch dan putar potensiometer — tanduk servo harus mengikuti putaran knop dari 0° sampai 180°.',
    starter: {
      placements: [
        { type: 'servo', holeId: T('L', 20, 2) },
        { type: 'potentiometer', holeId: T('R', 20, 2), props: { value: 10000 } },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 21, 0)), color: RED },
        { a: hole(T('L', 20, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('D9'), b: hole(T('L', 22, 4)), color: BLUE },
        { a: pin('5V#3'), b: hole(RAIL('R+', 4)), color: RED },
        { a: hole(RAIL('R+', 29)), b: hole(T('R', 20, 0)), color: RED },
        { a: hole(T('R', 22, 0)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('A0'), b: hole(T('R', 21, 4)), color: YELLOW },
      ],
      sketch: `void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int nilai = analogRead(A0);
  int pwm = map(nilai, 0, 1023, 0, 255);
  analogWrite(9, pwm);
  Serial.println(nilai);
  delay(100);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'servo', label: 'Servo SG90 terpasang' },
      { kind: 'component-present', type: 'potentiometer', label: 'Potensiometer terpasang sebagai pengendali' },
      { kind: 'pin-pwm', pinId: 'D9', label: 'Pin D9 mengeluarkan PWM penggerak servo' },
      {
        // Mesin assertion hanya mengenal arus cabang; servo menyimpan
        // sudutnya (derajat, 0–180) sebagai branch current 'angle' —
        // rentang di bawah ini adalah DERAJAT, bukan ampere: posisi
        // tengah knop (±512 ADC → PWM ±127) memberi sudut ±90°.
        kind: 'branch-current',
        type: 'servo',
        branch: 'angle',
        minA: 15,
        maxA: 165,
        label: 'Sudut servo berada di rentang gerak 15–165 derajat',
      },
      {
        // Ekstrem dua ujung (audit T4): posisi tengah bawaan (α 0,5)
        // menaruh sudut di ±90° sehingga modul dulu lulus tanpa
        // interaksi apa pun. Kedua ekstrem dibuktikan lewat angka
        // Serial (pola Modul 4), karena dua bukti lain terbukti bocor
        // oleh probe harness: (1) pita sudut 0–25° ter-latch oleh
        // transien startup — servo melaporkan 0° selama 1–2 tick
        // sebelum analogWrite pertama; (2) pita tegangan wiper yang
        // memuat 0 V ter-latch oleh snapshot rangkaian yang BELUM
        // dinyalakan (semua net 0 V). Tanpa daya tidak ada cetakan
        // Serial, dan cetakan pertama selalu nilai tengah asli, jadi
        // dua pita ini hanya terpenuhi oleh putaran knop yang nyata.
        kind: 'serial-number-range',
        min: 0,
        max: 80,
        label: 'Putar knop ke ujung bawah — angka Serial mendekati 0 dan servo ke dekat 0°',
      },
      {
        kind: 'serial-number-range',
        min: 940,
        max: 1023,
        label: 'Putar knop ke ujung atas — angka Serial mendekati 1023 dan servo ke dekat 180°',
      },
      {
        // Pita sudut atas aman dari transien startup (sudut mulai di
        // 0, bukan 180), jadi ujung atas dibuktikan juga dari sisi servo.
        kind: 'branch-current',
        type: 'servo',
        branch: 'angle',
        minA: 155,
        maxA: 180,
        label: 'Servo benar-benar mencapai dekat 180° saat knop di ujung atas',
      },
      {
        kind: 'net-voltage',
        target: { kind: 'component', type: 'potentiometer', pinId: 'WIPER' },
        minV: 0.2,
        maxV: 4.8,
        label: 'Tegangan wiper potensiometer di rentang 0,2–4,8 V',
      },
    ],
  },
  {
    id: 'modul-14-lm35-termometer',
    title: 'Modul 14 — Termometer LM35 + LED Ambang',
    boardId: 'uno',
    intro:
      'LM35 adalah sensor suhu analog presisi: keluarannya naik persis 10 mV untuk setiap derajat Celsius, jadi 25 °C berarti 0,25 V. Pin A0 mengubah tegangan itu menjadi angka ADC 10-bit (0,25 V ÷ 5 V × 1023 ≈ 51). Ambang 30 °C setara ADC 61 — di atas angka itu sketch menyalakan LED peringatan.',
    goal: 'Jalankan sketch, lalu naikkan suhu LM35 — seret model LM35 atau geser penggeser Suhu saat LM35 terpilih — melewati 30 °C sampai LED peringatan menyala.',
    starter: {
      placements: [
        { type: 'lm35', holeId: T('L', 20, 2) },
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 20, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 0)), color: RED },
        { a: pin('A0'), b: hole(T('L', 21, 4)), color: YELLOW },
        { a: hole(T('L', 22, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('D13'), b: hole(T('R', 24, 2)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int adc = analogRead(A0);
  Serial.println(adc);
  // Ambang 30 derajat: 0,30 V / 5 V x 1023 = 61
  if (adc > 61) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
  delay(200);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'lm35', label: 'Sensor suhu LM35 terpasang' },
      {
        // ADC 10-bit, referensi 5 V, LM35 10 mV/°C:
        // 17 °C = 0,17 V -> ADC 35; 25 °C (suhu bawaan) = 0,25 V -> ADC 51;
        // 60 °C = 0,60 V -> ADC 123; 83 °C = 0,83 V -> ADC 170.
        // Rentang 35–170 menangkap suhu ruangan sampai suhu tinggi yang
        // wajar dicapai saat pengguna menggeser suhu untuk menyalakan LED.
        kind: 'serial-number-range',
        min: 35,
        max: 170,
        label: 'Sketch mencetak bacaan suhu LM35 yang wajar (ADC 35–170)',
      },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.003,
        maxA: 0.025,
        label: 'LED peringatan menyala setelah suhu dinaikkan melewati 30 °C',
      },
    ],
  },
  {
    id: 'modul-15-rgb-pwm',
    title: 'Modul 15 — LED RGB: Mencampur Warna dengan PWM',
    boardId: 'uno',
    intro:
      'Satu LED RGB sebenarnya adalah tiga LED dalam satu kemasan — merah, hijau, dan biru — yang berbagi satu katoda (kaki COM ke GND). Setiap kanal wajib punya resistor pembatasnya sendiri. Warna yang kamu lihat adalah campuran aditif: atur intensitas ketiga kanal dengan PWM dan kamu mendapat warna baru, misalnya merah + hijau = kuning, dan ketiganya penuh = putih.',
    goal: 'Jalankan sketch dan saksikan LED berganti tujuh warna plus mati secara berurutan — perhatikan bahwa oranye, magenta, sian, dan putih tidak punya kanal sendiri, semuanya campuran. Tantangan: ubah sketch agar warna berpindah HALUS (fade) dari satu warna ke warna berikutnya memakai loop for yang menaikkan satu kanal selangkah demi selangkah, bukan loncat seketika.',
    starter: {
      placements: [
        { type: 'rgb-led', holeId: T('L', 20, 2) },
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 25, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 26, 2), props: { resistance: 220 } },
      ],
      wires: [
        { a: pin('D9'), b: hole(T('R', 24, 4)), color: BLUE },
        { a: hole(T('R', 20, 4)), b: hole(T('L', 21, 4)), color: BLUE },
        { a: pin('D10'), b: hole(T('R', 25, 4)), color: BLUE },
        { a: hole(T('R', 21, 4)), b: hole(T('L', 22, 4)), color: BLUE },
        { a: pin('D11'), b: hole(T('R', 26, 4)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(T('L', 23, 4)), color: BLUE },
        { a: hole(T('L', 20, 4)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `// Pencampur Warna RGB: tiga kanal PWM (D9 = R, D10 = G, D11 = B)
void setup() {
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
  Serial.begin(9600);
}

void warna(int r, int g, int b) {
  analogWrite(9, r);
  analogWrite(10, g);
  analogWrite(11, b);
}

void loop() {
  warna(255, 0, 0);
  Serial.println("Merah");
  delay(1000);
  warna(0, 255, 0);
  Serial.println("Hijau");
  delay(1000);
  warna(0, 0, 255);
  Serial.println("Biru");
  delay(1000);
  warna(255, 140, 0);
  Serial.println("Oranye");
  delay(1000);
  warna(255, 0, 255);
  Serial.println("Magenta");
  delay(1000);
  warna(0, 255, 255);
  Serial.println("Sian");
  delay(1000);
  warna(255, 255, 255);
  Serial.println("Putih");
  delay(1000);
  warna(0, 0, 0);
  Serial.println("Mati");
  delay(1000);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'rgb-led', label: 'LED RGB terpasang' },
      { kind: 'pin-pwm', pinId: 'D9', label: 'Pin D9 mengeluarkan PWM untuk kanal merah' },
      {
        kind: 'branch-current',
        type: 'rgb-led',
        branch: 'r',
        minA: 0.004,
        maxA: 0.025,
        label: 'Kanal merah mengalirkan arus aman 4–25 mA',
      },
      {
        kind: 'branch-current',
        type: 'rgb-led',
        branch: 'b',
        minA: 0.003,
        maxA: 0.025,
        label: 'Kanal biru mengalirkan arus aman 3–25 mA',
      },
    ],
  },
  {
    id: 'modul-16-joystick',
    title: 'Modul 16 — Joystick: Dua Sumbu Analog + Tombol',
    boardId: 'uno',
    intro:
      'Modul joystick adalah dua potensiometer 5 kΩ yang disusun tegak lurus — satu untuk sumbu X (VRX), satu untuk sumbu Y (VRY) — ditambah tombol tekan SW di ujung tuasnya. Tuas diam berarti kedua wiper duduk di tengah, jadi ADC membaca sekitar 512, bukan 0. Tombol SW menghubungkan pinnya ke GND saat ditekan, jadi dibaca dengan INPUT_PULLUP seperti push button biasa.',
    goal: 'Jalankan sketch, seret tuas joystick pada model 3D ke segala arah dan lihat pasangan angka X/Y berubah di Serial Monitor, lalu tekan tuasnya (Shift+klik) dan perhatikan SW berubah dari 1 menjadi 0. Tantangan: tambahkan keputusan arah pada sketch — cetak KANAN bila X di atas 600, KIRI bila X di bawah 400, dan TENGAH di antaranya (lakukan hal yang sama untuk ATAS/BAWAH dari nilai Y).',
    starter: {
      placements: [{ type: 'joystick', holeId: T('L', 20, 2) }],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 4)), color: RED },
        { a: hole(T('L', 21, 4)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('A0'), b: hole(T('L', 22, 4)), color: YELLOW },
        { a: pin('A1'), b: hole(T('L', 23, 4)), color: YELLOW },
        { a: pin('D2'), b: hole(T('L', 24, 4)), color: BLUE },
      ],
      sketch: `void setup() {
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int x = analogRead(A0);
  int y = analogRead(A1);
  int sw = digitalRead(2);
  Serial.print("X=");
  Serial.print(x);
  Serial.print(" Y=");
  Serial.print(y);
  Serial.print(" SW=");
  Serial.println(sw);
  delay(200);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'joystick', label: 'Joystick terpasang' },
      {
        kind: 'pin-mode',
        pinId: 'D2',
        mode: 'INPUT_PULLUP',
        label: 'Pin D2 membaca tombol SW dengan INPUT_PULLUP',
      },
      {
        kind: 'net-voltage',
        target: { kind: 'component', type: 'joystick', pinId: 'VRX' },
        minV: 1.0,
        maxV: 4.0,
        label: 'Tegangan VRX terbaca di sekitar tengah rentang (tuas diam ±2,5 V)',
      },
      {
        kind: 'serial-number-range',
        min: 100,
        max: 923,
        label: 'Sketch mencetak nilai sumbu X/Y ke Serial Monitor',
      },
    ],
  },
  {
    id: 'modul-17-kipas-otomatis',
    title: 'Modul 17 — Kipas Otomatis: Sensor Suhu Menggerakkan Motor',
    boardId: 'uno',
    intro:
      'Motor DC menarik arus sekitar 0,4 A — sepuluh kali lipat batas aman pin Arduino (40 mA). Menghubungkannya langsung ke pin akan membakar pin. Solusinya rantai tiga tingkat: LM35 merasakan suhu, pin D7 hanya mengeluarkan arus basis kecil ±8 mA, dan transistor melipatgandakannya (β ±100) menjadi arus kolektor yang cukup untuk motor dari rel 5 V. Transistor di sini adalah saklar sisi-rendah: motor di sisi kolektor, emitor ke GND.',
    goal: 'Jalankan sketch, lalu naikkan suhu LM35 — seret model LM35 atau geser penggeser Suhu saat LM35 terpilih — melewati 30 °C sampai kipas motor berputar, dan turunkan kembali untuk melihatnya berhenti. Tantangan: hilangkan nyala-mati yang gelisah di sekitar ambang — buat kipas menyala di 32 °C tetapi baru mati di 28 °C, memakai variabel keadaan (histeresis) di sketch.',
    starter: {
      placements: [
        { type: 'lm35', holeId: T('L', 20, 2) },
        { type: 'transistor', holeId: T('R', 20, 2) },
        { type: 'resistor', holeId: T('R', 25, 0), props: { resistance: 470 } },
        { type: 'dc-motor', holeId: T('R', 28, 2) },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 4)), color: RED },
        { a: hole(T('L', 22, 4)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('A0'), b: hole(T('L', 21, 4)), color: YELLOW },
        { a: pin('5V#3'), b: hole(RAIL('R+', 4)), color: RED },
        { a: hole(RAIL('R+', 29)), b: hole(T('R', 28, 4)), color: RED },
        { a: pin('D7'), b: hole(T('R', 25, 4)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(T('R', 30, 4)), color: BLUE },
        { a: hole(T('R', 20, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
      ],
      sketch: `void setup() {
  pinMode(7, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int adc = analogRead(A0);
  Serial.print("ADC suhu: ");
  Serial.println(adc);
  // Ambang 30 derajat: 0,30 V / 5 V x 1023 = 61
  if (adc > 61) {
    digitalWrite(7, HIGH);
  } else {
    digitalWrite(7, LOW);
  }
  delay(200);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'lm35', label: 'Sensor suhu LM35 terpasang' },
      { kind: 'component-present', type: 'transistor', label: 'Transistor driver terpasang' },
      { kind: 'component-present', type: 'dc-motor', label: 'Motor DC terpasang sebagai beban' },
      {
        kind: 'serial-number-range',
        min: 35,
        max: 170,
        label: 'Sketch mencetak bacaan suhu LM35 yang wajar (ADC 35–170)',
      },
      {
        kind: 'branch-current',
        type: 'transistor',
        branch: 'ic',
        minA: 0.1,
        maxA: 0.75,
        label: 'Arus kolektor transistor mengalir besar (penguatan bekerja)',
      },
      {
        kind: 'branch-current',
        type: 'dc-motor',
        branch: 'main',
        minA: 0.15,
        maxA: 0.9,
        label: 'Motor berputar (arus 0,15–0,9 A) setelah suhu melewati 30 °C',
      },
    ],
  },
  {
    id: 'modul-18-lampu-lalu-lintas',
    title: 'Modul 18 — Lampu Lalu Lintas: Mesin State Berurutan',
    boardId: 'uno',
    intro:
      'Lampu lalu lintas asli adalah mesin state: kumpulan keadaan yang berpindah menurut urutan dan waktu yang tetap. Di sini ada empat keadaan — MERAH (3 detik), MERAH+KUNING (1 detik), HIJAU (3 detik), KUNING (1 detik) — lalu kembali lagi. Perhatikan keadaan kedua: dua lampu menyala BERSAMAAN. State ditulis lewat satu fungsi lampu(m, k, h) agar keadaan selalu konsisten, tidak ada lampu yang tertinggal dari perintah sebelumnya.',
    goal: 'Jalankan sketch dan amati satu siklus penuh: urutan lampu harus persis MERAH → MERAH+KUNING → HIJAU → KUNING, dan Serial Monitor mengumumkan nama tiap keadaan saat ia aktif. Tantangan: tambahkan mode malam — setelah tiga siklus penuh, lampu beralih ke mode kuning berkedip saja (nyala 500 ms, mati 500 ms) memakai variabel penghitung siklus, seperti lampu lalu lintas sungguhan di jalan sepi.',
    starter: {
      placements: [
        { type: 'led-5mm', holeId: T('L', 16, 4), props: { color: 'red' } },
        { type: 'led-5mm', holeId: T('L', 21, 4), props: { color: 'yellow' } },
        { type: 'led-5mm', holeId: T('L', 26, 4), props: { color: 'green' } },
        { type: 'resistor', holeId: T('R', 20, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 25, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 30, 2), props: { resistance: 220 } },
      ],
      wires: [
        { a: pin('D8'), b: hole(T('R', 20, 4)), color: BLUE },
        { a: hole(T('R', 16, 4)), b: hole(T('L', 16, 0)), color: BLUE },
        { a: pin('D9'), b: hole(T('R', 25, 4)), color: BLUE },
        { a: hole(T('R', 21, 4)), b: hole(T('L', 21, 0)), color: BLUE },
        { a: pin('D10'), b: hole(T('R', 30, 4)), color: BLUE },
        { a: hole(T('R', 26, 4)), b: hole(T('L', 26, 0)), color: BLUE },
        { a: hole(T('L', 18, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(T('L', 23, 0)), b: hole(T('L', 18, 1)), color: DARK },
        { a: hole(T('L', 28, 0)), b: hole(T('L', 23, 1)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
      ],
      sketch: `void lampu(int merah, int kuning, int hijau) {
  digitalWrite(8, merah);
  digitalWrite(9, kuning);
  digitalWrite(10, hijau);
}

void setup() {
  pinMode(8, OUTPUT);
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  lampu(1, 0, 0);
  Serial.println("MERAH - BERHENTI");
  delay(3000);
  lampu(1, 1, 0);
  Serial.println("MERAH + KUNING - BERSIAP");
  delay(1000);
  lampu(0, 0, 1);
  Serial.println("HIJAU - JALAN");
  delay(3000);
  lampu(0, 1, 0);
  Serial.println("KUNING - HATI-HATI");
  delay(1000);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'led-5mm', label: 'Tiga LED lampu lalu lintas terpasang' },
      { kind: 'pin-mode', pinId: 'D8', mode: 'OUTPUT', label: 'Pin D8 (merah) diatur sebagai OUTPUT' },
      { kind: 'pin-mode', pinId: 'D10', mode: 'OUTPUT', label: 'Pin D10 (hijau) diatur sebagai OUTPUT' },
      { kind: 'serial-contains', text: 'HIJAU - JALAN', label: 'Siklus mencapai keadaan HIJAU - JALAN' },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        ...LED_CURRENT_SAFE,
        label: 'LED menyala bergantian sesuai urutan keadaan',
      },
    ],
  },
  {
    id: 'modul-19-sistem-keamanan',
    title: 'Modul 19 — Sistem Keamanan: Dua Sensor, Satu Alarm',
    boardId: 'uno',
    intro:
      'Alarm yang berbunyi untuk setiap gerakan akan dimatikan pemiliknya dalam seminggu. Sistem keamanan sungguhan mengurangi alarm palsu dengan meminta DUA bukti sekaligus: sensor PIR melihat gerakan DAN saklar miring di pintu mendeteksi pintu digerakkan. Sketch menggabungkannya dengan logika AND — relay hanya aktif bila keduanya sepakat. Bila relay aktif, kontak NO-nya memberi makan DUA beban sekaligus dari rel 5 V: buzzer dan lampu peringatan LED. Perhatikan: pin D8 tidak pernah memberi makan beban; ia hanya berbicara ke pin IN relay.',
    goal: 'Jalankan sketch, lalu picu alarmnya: klik kubah PIR untuk mensimulasikan gerakan DAN klik tabung saklar miring untuk mensimulasikan pintu dibuka — buzzer dan LED hanya boleh menyala bila keduanya aktif bersamaan. Coba picu satu sensor saja dan buktikan alarm tetap diam. Tantangan: buat alarm menempel — sekali terpantik, buzzer tetap berbunyi 5 detik walau pemicunya sudah hilang, memakai millis() dan variabel waktu pemicu terakhir.',
    starter: {
      placements: [
        { type: 'pir', holeId: T('L', 16, 2) },
        { type: 'tilt-switch', holeId: T('L', 24, 2) },
        { type: 'relay', holeId: T('L', 32, 4) },
        { type: 'buzzer', holeId: T('R', 20, 2) },
        { type: 'resistor', holeId: T('R', 27, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 23, 4), props: { color: 'red' } },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 16, 4)), color: RED },
        { a: hole(T('L', 18, 4)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('D2'), b: hole(T('L', 17, 4)), color: BLUE },
        { a: pin('D3'), b: hole(T('L', 24, 4)), color: BLUE },
        { a: hole(T('L', 26, 4)), b: hole(RAIL('L-', 20)), color: DARK },
        { a: hole(RAIL('L+', 20)), b: hole(T('L', 32, 0)), color: RED },
        { a: hole(T('L', 34, 0)), b: hole(RAIL('L-', 15)), color: DARK },
        { a: pin('D8'), b: hole(T('L', 33, 0)), color: BLUE },
        { a: hole(RAIL('L+', 10)), b: hole(T('R', 32, 4)), color: RED },
        { a: hole(T('R', 33, 4)), b: hole(T('R', 20, 4)), color: BLUE },
        { a: hole(T('R', 33, 3)), b: hole(T('R', 27, 4)), color: BLUE },
        { a: hole(T('R', 22, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(T('R', 25, 0)), b: hole(RAIL('R-', 20)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
      ],
      sketch: `int statusAlarm = 0;

void setup() {
  pinMode(2, INPUT);
  pinMode(3, INPUT_PULLUP);
  pinMode(8, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int gerak = digitalRead(2);
  int pintu = digitalRead(3);
  // Alarm hanya bila KEDUANYA aktif: ada gerakan (HIGH)
  // DAN pintu dimiringkan (kontak tilt menutup -> LOW)
  if (gerak == HIGH && pintu == LOW) {
    digitalWrite(8, HIGH);
    if (statusAlarm == 0) {
      Serial.println("ALARM! Gerakan + pintu terbuka!");
      statusAlarm = 1;
    }
  } else {
    digitalWrite(8, LOW);
    statusAlarm = 0;
  }
  delay(100);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'pir', label: 'Sensor PIR terpasang' },
      { kind: 'component-present', type: 'tilt-switch', label: 'Saklar miring terpasang di pintu' },
      { kind: 'component-present', type: 'relay', label: 'Modul relay terpasang' },
      {
        kind: 'pin-mode',
        pinId: 'D3',
        mode: 'INPUT_PULLUP',
        label: 'Pin D3 membaca tilt-switch dengan INPUT_PULLUP',
      },
      {
        kind: 'branch-current',
        type: 'relay',
        branch: 'active',
        minA: 0.9,
        maxA: 1.1,
        label: 'Relay AKTIF (kedua sensor sepakat: ada penyusup)',
      },
      {
        kind: 'branch-current',
        type: 'buzzer',
        branch: 'main',
        minA: 0.003,
        maxA: 0.06,
        label: 'Buzzer alarm berbunyi lewat kontak relay',
      },
    ],
  },
  {
    id: 'modul-20-penghitung-7segmen',
    title: 'Modul 20 — Penghitung Digital: Display 7-Segment & Tombol',
    boardId: 'uno',
    intro:
      'Display 7-segment tidak menerima angka — ia hanya punya tujuh batang LED bernama A sampai G plus titik desimal, dengan satu kaki COM bersama ke GND (katoda umum). Angka dibentuk dengan memilih segmen yang menyala: 0 = enam segmen luar, 1 = dua segmen kanan, 8 = semuanya. Setiap segmen adalah LED, jadi setiap pin segmen wajib dilewatkan resistor 220 Ω sendiri. Sketch menyimpan pola tiap angka sebagai bitmask 8 bit dan menampilkannya lewat satu fungsi.',
    goal: 'Jalankan sketch — display menampilkan 0 — lalu tekan push button (klik modelnya) berkali-kali: angka naik 1 setiap tekanan, dan setelah 9 kembali ke 0. Satu tekanan harus selalu berarti satu hitungan, walau tombol ditahan. Tantangan: balik arahnya — buat angka berjalan naik SENDIRI tiap detik memakai millis() tanpa menunggu tombol, dan ubah tombol menjadi tombol reset ke 0.',
    starter: {
      placements: [
        { type: 'seven-segment', holeId: T('L', 10, 0) },
        { type: 'resistor', holeId: T('R', 14, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 19, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 29, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 34, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 39, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 44, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('R', 49, 2), props: { resistance: 220 } },
        { type: 'push-button', holeId: T('L', 52, 4) },
      ],
      wires: [
        { a: hole(T('L', 10, 2)), b: hole(T('R', 10, 4)), color: BLUE },
        { a: hole(T('L', 11, 2)), b: hole(T('R', 15, 4)), color: BLUE },
        { a: hole(T('L', 12, 2)), b: hole(T('R', 20, 4)), color: BLUE },
        { a: hole(T('L', 13, 2)), b: hole(T('R', 25, 4)), color: BLUE },
        { a: hole(T('L', 14, 2)), b: hole(T('R', 30, 4)), color: BLUE },
        { a: hole(T('L', 15, 2)), b: hole(T('R', 35, 4)), color: BLUE },
        { a: hole(T('L', 16, 2)), b: hole(T('R', 40, 4)), color: BLUE },
        { a: hole(T('L', 17, 2)), b: hole(T('R', 45, 4)), color: BLUE },
        { a: pin('D3'), b: hole(T('R', 14, 4)), color: BLUE },
        { a: pin('D4'), b: hole(T('R', 19, 4)), color: BLUE },
        { a: pin('D5'), b: hole(T('R', 24, 4)), color: BLUE },
        { a: pin('D6'), b: hole(T('R', 29, 4)), color: BLUE },
        { a: pin('D7'), b: hole(T('R', 34, 4)), color: BLUE },
        { a: pin('D8'), b: hole(T('R', 39, 4)), color: BLUE },
        { a: pin('D9'), b: hole(T('R', 44, 4)), color: BLUE },
        { a: pin('D10'), b: hole(T('R', 49, 4)), color: BLUE },
        { a: hole(T('L', 18, 2)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: pin('D2'), b: hole(T('L', 52, 0)), color: BLUE },
        { a: hole(T('R', 52, 4)), b: hole(RAIL('R-', 29)), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
      ],
      sketch: `// Pin segmen berurutan A, B, C, D, E, F, G, DP
int pinSegmen[8] = {3, 4, 5, 6, 7, 8, 9, 10};

// Pola bit per angka: bit tertinggi = segmen A, terendah = DP (1 = menyala)
int pola[10] = {
  0b11111100, // 0
  0b01100000, // 1
  0b11011010, // 2
  0b11110010, // 3
  0b01100110, // 4
  0b10110110, // 5
  0b10111110, // 6
  0b11100000, // 7
  0b11111110, // 8
  0b11110110  // 9
};

int angka = 0;
int tombolLalu = 1;

void tampilkan(int n) {
  for (int i = 0; i < 8; i++) {
    int bit = (pola[n] >> (7 - i)) & 1;
    digitalWrite(pinSegmen[i], bit);
  }
}

void setup() {
  for (int i = 0; i < 8; i++) {
    pinMode(pinSegmen[i], OUTPUT);
  }
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
  tampilkan(0);
  Serial.println("Angka: 0");
}

void loop() {
  int tombol = digitalRead(2);
  // Tepi turun: tombol BARU saja ditekan (sebelumnya lepas, kini tertutup)
  if (tombol == 0 && tombolLalu == 1) {
    angka = angka + 1;
    if (angka > 9) {
      angka = 0;
    }
    tampilkan(angka);
    Serial.print("Angka: ");
    Serial.println(angka);
    delay(50);
  }
  tombolLalu = tombol;
  delay(20);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'seven-segment', label: 'Display 7-segment terpasang' },
      { kind: 'component-present', type: 'push-button', label: 'Push button penghitung terpasang' },
      {
        kind: 'pin-mode',
        pinId: 'D2',
        mode: 'INPUT_PULLUP',
        label: 'Pin D2 membaca tombol dengan INPUT_PULLUP',
      },
      {
        kind: 'branch-current',
        type: 'seven-segment',
        branch: 'a',
        minA: 0.004,
        maxA: 0.028,
        label: 'Segmen A menyala (angka 0 tampil sejak awal)',
      },
      {
        kind: 'branch-current',
        type: 'seven-segment',
        branch: 'g',
        minA: 0.004,
        maxA: 0.028,
        label: 'Segmen G menyala setelah tombol ditekan sampai angka 2 atau lebih',
      },
      { kind: 'serial-contains', text: 'Angka:', label: 'Serial Monitor mengumumkan angka yang tampil' },
    ],
  },
];

export function getLesson(id: string): LessonModule | undefined {
  return LESSONS.find((l) => l.id === id);
}
