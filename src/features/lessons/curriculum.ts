import { terminalHoleId, railHoleId } from '../../shared/boards/breadboard';
import type { TerminalRef } from '../wiring/netlist';
import { DEFAULT_SKETCH } from '../sketch/defaultSketch';
import type { Assertion } from './engine';

/**
 * Kurikulum mode Lesson — 14 modul Bahasa Indonesia (8 modul awal
 * ROADMAP Batch 4 + modul 9–14 gelombang lanjutan).
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
        kind: 'serial-number-range',
        min: 10,
        max: 1010,
        label: 'Sketch mencetak hasil analogRead ke Serial Monitor',
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
    title: 'Modul 8 — Proyek Akhir: Lampu Kendali Ganda',
    boardId: 'uno',
    intro:
      'Proyek penutup menggabungkan semuanya: tombol sebagai saklar (INPUT_PULLUP), potensiometer sebagai pengatur kecerahan (analogRead + map), dan LED yang dikendalikan PWM. Sketch awal sudah jadi; tugasmu memastikan rangkaian berjalan dan semua peran berfungsi.',
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
      'Motor DC menarik arus ratusan miliampere — jauh di atas batas aman pin Arduino (40 mA). Karena itu pin tidak pernah memberi makan motor secara langsung: pin hanya memerintah relay, dan kontak relay yang menyambungkan motor ke rel 5 V. Perhatikan penempatan relay di breadboard: kaki COM berbagi strip dengan VCC (sama-sama 5 V), dan keluaran NO berbagi strip dengan masukan IN. Karena berbagi strip itu, jalur motor diberi resistor seri 22 Ω: tanpa resistor, beban motor menahan tegangan IN di bawah ambang aktif relay dan membebani pin; dengan resistor, IN bisa naik melewati ambang, kontak berpindah, dan motor menerima daya penuh dari rel.',
    goal: 'Jalankan sketch — relay berbunyi klik bergantian dan motor berputar hanya selama relay ON.',
    starter: {
      placements: [
        { type: 'relay', holeId: T('L', 20, 1) },
        { type: 'resistor', holeId: T('R', 24, 2), props: { resistance: 22 } },
        { type: 'dc-motor', holeId: T('R', 28, 2) },
      ],
      wires: [
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 20, 0)), color: RED },
        { a: pin('D8'), b: hole(T('L', 21, 0)), color: BLUE },
        { a: hole(T('L', 21, 2)), b: hole(T('R', 24, 0)), color: RED },
        { a: hole(T('R', 20, 0)), b: hole(T('R', 28, 0)), color: RED },
        { a: hole(T('L', 22, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
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
        kind: 'serial-number-range',
        min: 0,
        max: 1023,
        label: 'Sketch membaca dan mencetak nilai cahaya A0 (ADC 0–1023)',
      },
      {
        kind: 'net-voltage',
        target: { kind: 'component', type: 'ldr', pinId: 'B' },
        minV: 1.0,
        maxV: 4.95,
        label: 'Tegangan keluaran pembagi di kaki B LDR berada di rentang kerja 1–4,95 V',
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
];

export function getLesson(id: string): LessonModule | undefined {
  return LESSONS.find((l) => l.id === id);
}
