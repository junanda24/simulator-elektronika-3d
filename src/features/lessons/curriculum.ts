import { terminalHoleId, railHoleId } from '../../shared/boards/breadboard';
import type { TerminalRef } from '../wiring/netlist';
import { DEFAULT_SKETCH } from '../sketch/defaultSketch';
import type { Assertion } from './engine';

/**
 * Kurikulum mode Lesson — 24 modul Bahasa Indonesia (8 modul awal
 * ROADMAP Batch 4 + modul 9–14 gelombang lanjutan + modul 15–20
 * gelombang proyek easy→hard + modul 21–24 gelombang proyek hard:
 * sensor gas/api, sonar, kontrol multi-sensor, mesin keadaan arah).
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
  {
    id: 'modul-21-alarm-gas-api',
    title: 'Modul 21 — Alarm Gas & Api: Penjaga Dapur',
    boardId: 'uno',
    intro:
      'Dapur adalah tempat paling berbahaya di rumah: gas LPG yang bocor tidak terlihat, dan api kompor bisa menyambar tanpa peringatan. Modul ini membangun penjaga dapur dari dua sensor analog yang arah bacaannya BERLAWANAN — dan itu pelajaran pertamanya. AO MQ-2 NAIK saat gas naik: resistansi elemennya turun dari ±83 kΩ di udara bersih ke ±2,8 kΩ di gas pekat, menarik simpul pembaginya ke atas. AO KY-026 justru TURUN saat api mendekat, karena fototransistornya makin menghantar dan menarik simpulnya ke bawah. Tidak ada aturan "nilai naik berarti bahaya" — arah adalah sifat rangkaian tiap modul. Perhatikan juga pemanas MQ-2: elemennya membakar ±160 mA terus-menerus dari rel, jadi sensor ini diberi makan dari rel, tidak pernah dari pin. Bila bahaya terdeteksi, pin D13 hanya memberi tegangan ke gerbang MOSFET — arus gerbangnya praktis nol — dan saluran Drain–Source MOSFET-lah yang mengalirkan 0,42 A dari rel ke motor kipas. Sepuluh segmen bar graph menampilkan level gas, dan setiap segmen punya resistor 220 Ω sendiri di anodanya. Kedua sensor juga punya pin DO berkomparator (aktif-LOW) yang sengaja tidak dipakai di modul ini — jalur analog memberi kita level, bukan cuma ya/tidak.',
    goal: 'Jalankan sketch di udara bersih — semua segmen mati dan kipas diam — lalu naikkan penggeser Gas pada MQ-2 ke 5000 ppm: level bar graph naik, dan pada gas berbahaya kipas exhaust berputar serta buzzer berbunyi. Kembalikan Gas ke 0, lalu naikkan penggeser Api pada KY-026 ke 85%: alarm harus berbunyi lagi, kali ini karena api, walau gas bersih. Tantangan: tambahkan tingkat WASPADA — pada gas menengah (ADC gas 250–470) buat buzzer berbunyi putus-putus (bunyi 100 ms tiap detik memakai millis()) TANPA menyalakan kipas, agar penghuni diperingatkan sebelum keadaan menjadi bahaya.',
    starter: {
      placements: [
        { type: 'mq2', holeId: T('R', 8, 2) },
        { type: 'flame-sensor', holeId: T('R', 16, 2) },
        { type: 'led-bar-graph', holeId: T('L', 52, 4) },
        { type: 'resistor', holeId: T('L', 4, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 9, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 14, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 19, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 24, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 29, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 34, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 39, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 44, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 49, 2), props: { resistance: 220 } },
        { type: 'buzzer', holeId: T('R', 24, 2) },
        { type: 'mosfet', holeId: T('R', 30, 2) },
        { type: 'dc-motor', holeId: T('R', 36, 2) },
      ],
      wires: [
        // Rel daya
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
        // MQ-2: catu dari rel (pemanas ±161 mA), AO ke A0
        { a: hole(RAIL('L+', 20)), b: hole(T('R', 8, 4)), color: RED },
        { a: hole(T('R', 9, 4)), b: hole(RAIL('R-', 15)), color: DARK },
        { a: pin('A0'), b: hole(T('R', 11, 4)), color: YELLOW },
        // KY-026: catu dari rel, AO ke A1
        { a: hole(RAIL('L+', 24)), b: hole(T('R', 17, 4)), color: RED },
        { a: hole(T('R', 16, 4)), b: hole(RAIL('R-', 18)), color: DARK },
        { a: pin('A1'), b: hole(T('R', 19, 4)), color: YELLOW },
        // Bar graph: pin board -> kaki A resistor segmen 1..10 (D2..D11)
        { a: pin('D2'), b: hole(T('L', 4, 4)), color: BLUE },
        { a: pin('D3'), b: hole(T('L', 9, 4)), color: BLUE },
        { a: pin('D4'), b: hole(T('L', 14, 4)), color: BLUE },
        { a: pin('D5'), b: hole(T('L', 19, 4)), color: BLUE },
        { a: pin('D6'), b: hole(T('L', 24, 4)), color: BLUE },
        { a: pin('D7'), b: hole(T('L', 29, 4)), color: BLUE },
        { a: pin('D8'), b: hole(T('L', 34, 4)), color: BLUE },
        { a: pin('D9'), b: hole(T('L', 39, 4)), color: BLUE },
        { a: pin('D10'), b: hole(T('L', 44, 4)), color: BLUE },
        { a: pin('D11'), b: hole(T('L', 49, 4)), color: BLUE },
        // Kaki B resistor segmen 1..10 -> strip anoda segmen yang sama
        { a: hole(T('L', 0, 0)), b: hole(T('L', 52, 0)), color: BLUE },
        { a: hole(T('L', 5, 0)), b: hole(T('L', 53, 0)), color: BLUE },
        { a: hole(T('L', 10, 0)), b: hole(T('L', 54, 0)), color: BLUE },
        { a: hole(T('L', 15, 0)), b: hole(T('L', 55, 0)), color: BLUE },
        { a: hole(T('L', 20, 0)), b: hole(T('L', 56, 0)), color: BLUE },
        { a: hole(T('L', 25, 0)), b: hole(T('L', 57, 0)), color: BLUE },
        { a: hole(T('L', 30, 0)), b: hole(T('L', 58, 0)), color: BLUE },
        { a: hole(T('L', 35, 0)), b: hole(T('L', 59, 0)), color: BLUE },
        { a: hole(T('L', 40, 0)), b: hole(T('L', 60, 0)), color: BLUE },
        { a: hole(T('L', 45, 0)), b: hole(T('L', 61, 0)), color: BLUE },
        // Katoda: rantai daisy K1 -> K2 -> ... -> K10 -> rel R-
        { a: hole(T('R', 52, 4)), b: hole(T('R', 53, 4)), color: DARK },
        { a: hole(T('R', 53, 4)), b: hole(T('R', 54, 4)), color: DARK },
        { a: hole(T('R', 54, 4)), b: hole(T('R', 55, 4)), color: DARK },
        { a: hole(T('R', 55, 4)), b: hole(T('R', 56, 4)), color: DARK },
        { a: hole(T('R', 56, 4)), b: hole(T('R', 57, 4)), color: DARK },
        { a: hole(T('R', 57, 4)), b: hole(T('R', 58, 4)), color: DARK },
        { a: hole(T('R', 58, 4)), b: hole(T('R', 59, 4)), color: DARK },
        { a: hole(T('R', 59, 4)), b: hole(T('R', 60, 4)), color: DARK },
        { a: hole(T('R', 60, 4)), b: hole(T('R', 61, 4)), color: DARK },
        { a: hole(T('R', 61, 2)), b: hole(RAIL('R-', 29)), color: DARK },
        // Buzzer dari D12
        { a: pin('D12'), b: hole(T('R', 24, 4)), color: BLUE },
        { a: hole(T('R', 26, 4)), b: hole(RAIL('R-', 25)), color: DARK },
        // MOSFET + motor kipas: D13 hanya ke gerbang; daya motor dari rel
        { a: pin('D13'), b: hole(T('R', 30, 4)), color: BLUE },
        { a: hole(T('R', 32, 4)), b: hole(RAIL('R-', 32)), color: DARK },
        { a: hole(T('R', 31, 4)), b: hole(T('R', 38, 4)), color: BLUE },
        { a: hole(RAIL('L+', 40)), b: hole(T('R', 36, 4)), color: RED },
      ],
      sketch: `// Penjaga dapur: MQ-2 (A0) + KY-026 (A1) -> bar graph, kipas, buzzer
int pinSegmen[10] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11};

void tampilkanLevel(int level) {
  for (int i = 0; i < 10; i++) {
    digitalWrite(pinSegmen[i], i < level ? HIGH : LOW);
  }
}

void setup() {
  for (int i = 0; i < 10; i++) {
    pinMode(pinSegmen[i], OUTPUT);
  }
  pinMode(12, OUTPUT);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int adcGas = analogRead(A0);
  int adcApi = analogRead(A1);

  // Level gas untuk bar graph: ADC udara bersih ±58, gas pekat ±750
  int level = constrain(map(adcGas, 55, 760, 0, 10), 0, 10);
  tampilkanLevel(level);

  // Dua arah berlawanan: gas BAHAYA saat ADC gas TINGGI (> 470,
  // ±1.500 ppm), api BAHAYA saat ADC api RENDAH (< 460) karena
  // AO KY-026 turun saat api mendekat.
  bool bahayaGas = adcGas > 470;
  bool adaApi = adcApi < 460;

  if (adaApi) {
    digitalWrite(13, HIGH);
    digitalWrite(12, HIGH);
    Serial.println("API TERDETEKSI! Kipas & alarm menyala");
  } else if (bahayaGas) {
    digitalWrite(13, HIGH);
    digitalWrite(12, HIGH);
    Serial.println("BAHAYA GAS! Kipas & alarm menyala");
  } else {
    digitalWrite(13, LOW);
    digitalWrite(12, LOW);
  }

  Serial.print("Gas ADC: ");
  Serial.print(adcGas);
  Serial.print(" Api ADC: ");
  Serial.println(adcApi);
  delay(300);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'mq2', label: 'Sensor gas MQ-2 terpasang' },
      { kind: 'component-present', type: 'flame-sensor', label: 'Sensor api KY-026 terpasang' },
      { kind: 'component-present', type: 'led-bar-graph', label: 'Bar graph 10 segmen terpasang' },
      { kind: 'component-present', type: 'mosfet', label: 'MOSFET driver kipas terpasang' },
      { kind: 'pin-mode', pinId: 'D13', mode: 'OUTPUT', label: 'Pin D13 menggerakkan gerbang MOSFET' },
      {
        kind: 'net-voltage',
        target: { kind: 'component', type: 'mq2', pinId: 'AO' },
        minV: 0.15,
        maxV: 0.5,
        label: 'AO MQ-2 di udara bersih ±0,29 V (sensor berdaya, pembagi hidup)',
      },
      {
        kind: 'serial-number-range',
        min: 40,
        max: 75,
        label: 'Bacaan ADC gas udara bersih (±58) tercetak di Serial',
      },
      {
        kind: 'branch-current',
        type: 'led-bar-graph',
        branch: 's7',
        minA: 0.004,
        maxA: 0.025,
        label: 'Segmen ke-7 bar graph menyala (level gas tinggi)',
      },
      {
        kind: 'branch-current',
        type: 'dc-motor',
        branch: 'main',
        minA: 0.3,
        maxA: 0.5,
        label: 'Motor kipas berputar lewat MOSFET (arus 0,3–0,5 A dari rel)',
      },
      {
        kind: 'branch-current',
        type: 'buzzer',
        branch: 'main',
        minA: 0.02,
        maxA: 0.035,
        label: 'Buzzer alarm berbunyi pada keadaan bahaya',
      },
      { kind: 'serial-contains', text: 'BAHAYA GAS', label: 'Serial mengumumkan bahaya gas' },
      { kind: 'serial-contains', text: 'API TERDETEKSI', label: 'Serial mengumumkan api terdeteksi' },
    ],
  },
  {
    id: 'modul-22-sensor-parkir',
    title: 'Modul 22 — Sensor Parkir Ultrasonik HC-SR04',
    boardId: 'uno',
    intro:
      "Sensor parkir mobil dan pengukur jarak robot memakai trik yang sama: kirim pulsa ultrasonik, lalu UKUR berapa lama gema kembali. HC-SR04 tidak memberi angka jarak — ia memberi pulsa di pin ECHO yang lebarnya adalah waktu tempuh suara: jarak (cm) = lebar pulsa (µs) dibagi 58. Fungsi pulseIn() mengukur lebar itu; di simulator ini pulseIn dihitung analitik dari jadwal modul, jadi angkanya eksak seperti di board asli. Jebakan klasiknya: pulseIn mengembalikan 0 bila TIDAK ADA gema sampai batas waktu (timeout) — itu berarti 'tidak ada objek dalam jangkauan', BUKAN jarak 0 cm. Sketch yang memperlakukan 0 sebagai 'sangat dekat' akan membunyikan alarm terus di jalan kosong. TRIG butuh pulsa HIGH minimal 10 µs untuk memulai pengukuran, dan pengukuran berikutnya baru boleh dimulai setelah ±60 ms. Karena proyek ini butuh 13 pin sinyal, buzzer dipindah ke A0 — di Uno, pin analog sah dipakai sebagai pin digital biasa.",
    goal: "Jalankan sketch dengan rintangan bawaan 100 cm — Serial mencetak 'Jarak: 100 cm', lima segmen bar graph menyala, dan buzzer berbunyi berjeda sedang. Geser penggeser Jarak rintangan pada HC-SR04 ke 25 cm: sembilan segmen menyala dan bunyi buzzer merapat. Terakhir aktifkan tombol 'Tanpa rintangan': bar graph padam, buzzer diam, dan Serial menyatakan tidak ada objek — BUKAN jarak 0. Tantangan: tambahkan peringatan mendadak — bila jarak menyusut lebih dari 50 cm dalam waktu kurang dari satu detik (objek datang tiba-tiba), bunyikan buzzer terus selama 1 detik memakai millis() dan variabel bacaan sebelumnya.",
    starter: {
      placements: [
        { type: 'hc-sr04', holeId: T('R', 8, 2) },
        { type: 'led-bar-graph', holeId: T('L', 52, 4) },
        { type: 'resistor', holeId: T('L', 4, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 9, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 14, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 19, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 24, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 29, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 34, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 39, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 44, 2), props: { resistance: 220 } },
        { type: 'resistor', holeId: T('L', 49, 2), props: { resistance: 220 } },
        { type: 'buzzer', holeId: T('R', 16, 2) },
      ],
      wires: [
        // Rel daya
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
        // HC-SR04: catu dari rel, TRIG dari D12, ECHO ke D13
        { a: hole(RAIL('L+', 20)), b: hole(T('R', 8, 4)), color: RED },
        { a: hole(T('R', 11, 4)), b: hole(RAIL('R-', 15)), color: DARK },
        { a: pin('D12'), b: hole(T('R', 9, 4)), color: BLUE },
        { a: pin('D13'), b: hole(T('R', 10, 4)), color: BLUE },
        // Buzzer dari A0 (pin analog sebagai pin digital)
        { a: pin('A0'), b: hole(T('R', 16, 4)), color: BLUE },
        { a: hole(T('R', 18, 4)), b: hole(RAIL('R-', 20)), color: DARK },
        // Bar graph: pin board -> kaki A resistor segmen 1..10 (D2..D11)
        { a: pin('D2'), b: hole(T('L', 4, 4)), color: BLUE },
        { a: pin('D3'), b: hole(T('L', 9, 4)), color: BLUE },
        { a: pin('D4'), b: hole(T('L', 14, 4)), color: BLUE },
        { a: pin('D5'), b: hole(T('L', 19, 4)), color: BLUE },
        { a: pin('D6'), b: hole(T('L', 24, 4)), color: BLUE },
        { a: pin('D7'), b: hole(T('L', 29, 4)), color: BLUE },
        { a: pin('D8'), b: hole(T('L', 34, 4)), color: BLUE },
        { a: pin('D9'), b: hole(T('L', 39, 4)), color: BLUE },
        { a: pin('D10'), b: hole(T('L', 44, 4)), color: BLUE },
        { a: pin('D11'), b: hole(T('L', 49, 4)), color: BLUE },
        // Kaki B resistor segmen 1..10 -> strip anoda segmen yang sama
        { a: hole(T('L', 0, 0)), b: hole(T('L', 52, 0)), color: BLUE },
        { a: hole(T('L', 5, 0)), b: hole(T('L', 53, 0)), color: BLUE },
        { a: hole(T('L', 10, 0)), b: hole(T('L', 54, 0)), color: BLUE },
        { a: hole(T('L', 15, 0)), b: hole(T('L', 55, 0)), color: BLUE },
        { a: hole(T('L', 20, 0)), b: hole(T('L', 56, 0)), color: BLUE },
        { a: hole(T('L', 25, 0)), b: hole(T('L', 57, 0)), color: BLUE },
        { a: hole(T('L', 30, 0)), b: hole(T('L', 58, 0)), color: BLUE },
        { a: hole(T('L', 35, 0)), b: hole(T('L', 59, 0)), color: BLUE },
        { a: hole(T('L', 40, 0)), b: hole(T('L', 60, 0)), color: BLUE },
        { a: hole(T('L', 45, 0)), b: hole(T('L', 61, 0)), color: BLUE },
        // Katoda: rantai daisy K1 -> K2 -> ... -> K10 -> rel R-
        { a: hole(T('R', 52, 4)), b: hole(T('R', 53, 4)), color: DARK },
        { a: hole(T('R', 53, 4)), b: hole(T('R', 54, 4)), color: DARK },
        { a: hole(T('R', 54, 4)), b: hole(T('R', 55, 4)), color: DARK },
        { a: hole(T('R', 55, 4)), b: hole(T('R', 56, 4)), color: DARK },
        { a: hole(T('R', 56, 4)), b: hole(T('R', 57, 4)), color: DARK },
        { a: hole(T('R', 57, 4)), b: hole(T('R', 58, 4)), color: DARK },
        { a: hole(T('R', 58, 4)), b: hole(T('R', 59, 4)), color: DARK },
        { a: hole(T('R', 59, 4)), b: hole(T('R', 60, 4)), color: DARK },
        { a: hole(T('R', 60, 4)), b: hole(T('R', 61, 4)), color: DARK },
        { a: hole(T('R', 61, 2)), b: hole(RAIL('R-', 29)), color: DARK },
      ],
      sketch: `// Sensor parkir: TRIG di D12, ECHO di D13, buzzer di A0 (pin analog
// yang dipakai sebagai pin digital), bar graph 10 segmen di D2-D11.
int pinSegmen[10] = {2, 3, 4, 5, 6, 7, 8, 9, 10, 11};

void tampilkanLevel(int level) {
  for (int i = 0; i < 10; i++) {
    digitalWrite(pinSegmen[i], i < level ? HIGH : LOW);
  }
}

void setup() {
  pinMode(12, OUTPUT);
  pinMode(13, INPUT);
  pinMode(A0, OUTPUT);
  for (int i = 0; i < 10; i++) {
    pinMode(pinSegmen[i], OUTPUT);
  }
  Serial.begin(9600);
}

void loop() {
  // Pulsa pemicu: LOW sebentar, HIGH 10 us, lalu LOW lagi.
  digitalWrite(12, LOW);
  delayMicroseconds(2);
  digitalWrite(12, HIGH);
  delayMicroseconds(10);
  digitalWrite(12, LOW);

  // Ukur lebar pulsa ECHO. Timeout 30 ms (±5 m) dipilih sadar agar
  // loop tidak menggantung 1 detik penuh (bawaan Arduino) saat
  // tidak ada objek.
  long durasi = pulseIn(13, HIGH, 30000);

  if (durasi == 0) {
    // 0 = TIDAK ADA gema yang kembali (timeout) — bukan jarak 0 cm!
    tampilkanLevel(0);
    digitalWrite(A0, LOW);
    Serial.println("Tidak ada objek dalam jangkauan");
    delay(200);
  } else {
    long jarak = durasi / 58;
    int j = constrain(jarak, 10, 200);
    int level = map(j, 200, 10, 0, 10);
    tampilkanLevel(level);
    Serial.print("Jarak: ");
    Serial.print(jarak);
    Serial.println(" cm");
    // Buzzer: bunyi 50 ms, lalu jeda yang memendek saat objek dekat.
    digitalWrite(A0, HIGH);
    delay(50);
    digitalWrite(A0, LOW);
    delay(map(j, 10, 200, 40, 500));
  }
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'hc-sr04', label: 'Sensor ultrasonik HC-SR04 terpasang' },
      { kind: 'component-present', type: 'led-bar-graph', label: 'Bar graph 10 segmen terpasang' },
      { kind: 'pin-mode', pinId: 'D12', mode: 'OUTPUT', label: 'Pin D12 menggerakkan TRIG HC-SR04' },
      {
        kind: 'serial-number-range',
        min: 90,
        max: 110,
        label: 'Jarak bawaan ±100 cm terbaca dari lebar pulsa ECHO',
      },
      {
        kind: 'branch-current',
        type: 'led-bar-graph',
        branch: 's5',
        minA: 0.004,
        maxA: 0.025,
        label: 'Lima segmen menyala pada jarak 100 cm',
      },
      {
        kind: 'branch-current',
        type: 'buzzer',
        branch: 'main',
        minA: 0.02,
        maxA: 0.035,
        label: 'Buzzer berbunyi berjeda dari pin A0',
      },
      {
        kind: 'serial-number-range',
        min: 20,
        max: 30,
        label: 'Jarak dekat ±25 cm terbaca setelah rintangan didekatkan',
      },
      {
        kind: 'branch-current',
        type: 'led-bar-graph',
        branch: 's9',
        minA: 0.004,
        maxA: 0.025,
        label: 'Sembilan segmen menyala saat objek dekat (25 cm)',
      },
      {
        kind: 'serial-contains',
        text: 'Tidak ada objek',
        label: 'Sketch membedakan timeout (bukan jarak 0) saat tanpa rintangan',
      },
    ],
  },
  {
    id: 'modul-23-rumah-kaca',
    title: 'Modul 23 — Rumah Kaca Otomatis: Kontrol Multi-Sensor',
    boardId: 'uno',
    intro:
      'Rumah kaca otomatis mengambil keputusan dari TIGA sensor sekaligus, dan keputusannya tidak boleh gelisah. Termistor NTC dirangkai sebagai pembagi tegangan dengan resistor 10 kΩ: resistansinya jatuh dari 10 kΩ pada 25 °C ke ±4,3 kΩ pada 45 °C, jadi simpul A0 naik dari 2,50 V ke 3,48 V saat udara memanas. Ambang tunggal membuat ventilasi membuka-tutup belasan kali di sekitar titik ambang, jadi sketch memakai HISTERESIS: ventilasi membuka di ADC 650 (±40 °C) tetapi baru menutup di ADC 520 (±30 °C) — di antara keduanya, keadaan sebelumnya dipertahankan. Di atas suhu ada satu penguasa: hujan. AO sensor hujan MH-RD TURUN saat basah (4,95 V saat kering menjadi 1,67 V saat terendam — arah yang berlawanan dengan NTC), dan begitu hujan terdeteksi, ventilasi dipaksa menutup dan pompa berhenti walau sedang panas-panasnya. Pompa digerakkan MOSFET dari D7, ventilasi adalah servo di D9, dan lampu tumbuh menyala sendiri saat LDR merasa hari sudah gelap.',
    goal: 'Atur penggeser Suhu pada NTC ke 35 °C dan jalankan sketch: ventilasi harus tetap TERTUTUP walau ADC suhu (602) sudah di atas 600 — itulah pita histeresis bekerja dari sisi dingin. Naikkan suhu ke 45 °C: ventilasi membuka penuh dan pompa menyala. Turunkan kembali ke 35 °C: keduanya harus BERTAHAN menyala — histeresis dari sisi panas. Lalu naikkan penggeser Kebasahan ke 100%: hujan memaksa ventilasi menutup dan pompa berhenti. Terakhir turunkan penggeser Cahaya pada LDR ke 0: lampu tumbuh menyala. Tantangan: tambahkan mode hemat air — pompa hanya boleh menyala maksimal 10 detik lalu wajib beristirahat 20 detik walau suhu masih tinggi, memakai millis() dan variabel waktu.',
    starter: {
      placements: [
        { type: 'ntc-thermistor', holeId: T('L', 10, 2) },
        { type: 'resistor', holeId: T('L', 16, 4), props: { resistance: 10000 } },
        { type: 'ldr', holeId: T('L', 22, 2) },
        { type: 'resistor', holeId: T('L', 28, 4), props: { resistance: 10000 } },
        { type: 'led-5mm', holeId: T('L', 34, 4), props: { color: 'red' } },
        { type: 'resistor', holeId: T('L', 40, 2), props: { resistance: 220 } },
        { type: 'rain-sensor', holeId: T('R', 8, 2) },
        { type: 'servo', holeId: T('R', 16, 2) },
        { type: 'mosfet', holeId: T('R', 24, 2) },
        { type: 'dc-motor', holeId: T('R', 32, 2) },
      ],
      wires: [
        // Rel daya
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
        // Pembagi NTC: rel -> NTC -> simpul A0 -> 10k -> GND
        { a: hole(T('L', 10, 4)), b: hole(RAIL('L+', 29)), color: RED },
        { a: pin('A0'), b: hole(T('L', 12, 0)), color: YELLOW },
        { a: hole(T('L', 16, 0)), b: hole(RAIL('L-', 29)), color: DARK },
        // Pembagi LDR: rel -> LDR -> simpul A2 -> 10k -> GND
        { a: hole(T('L', 22, 4)), b: hole(RAIL('L+', 34)), color: RED },
        { a: pin('A2'), b: hole(T('L', 24, 0)), color: YELLOW },
        { a: hole(T('L', 28, 0)), b: hole(RAIL('L-', 34)), color: DARK },
        // Lampu tumbuh: D6 -> anoda; katoda -> resistor -> rel L-
        { a: pin('D6'), b: hole(T('L', 34, 0)), color: BLUE },
        { a: hole(T('L', 40, 0)), b: hole(RAIL('L-', 40)), color: DARK },
        // MH-RD: catu dari rel, AO ke A1
        { a: hole(RAIL('L+', 20)), b: hole(T('R', 8, 4)), color: RED },
        { a: hole(T('R', 9, 4)), b: hole(RAIL('R-', 15)), color: DARK },
        { a: pin('A1'), b: hole(T('R', 11, 4)), color: YELLOW },
        // Servo ventilasi: daya dari rel, SIG dari D9
        { a: hole(T('R', 16, 4)), b: hole(RAIL('R-', 18)), color: DARK },
        { a: hole(RAIL('L+', 24)), b: hole(T('R', 17, 4)), color: RED },
        { a: pin('D9'), b: hole(T('R', 18, 4)), color: BLUE },
        // MOSFET + pompa: D7 ke gerbang, daya motor dari rel
        { a: pin('D7'), b: hole(T('R', 24, 4)), color: BLUE },
        { a: hole(T('R', 26, 4)), b: hole(RAIL('R-', 25)), color: DARK },
        { a: hole(T('R', 25, 4)), b: hole(T('R', 34, 4)), color: BLUE },
        { a: hole(RAIL('L+', 40)), b: hole(T('R', 32, 4)), color: RED },
      ],
      sketch: `// Rumah kaca: NTC (A0) + hujan MH-RD (A1) + LDR (A2)
// Ambang suhu dalam ADC: MEMBUKA di 650 (±40 C), MENUTUP di 520
// (±30 C). Di antara keduanya keadaan DIPERTAHANKAN (histeresis).
// Ambang tutup dipilih terhadap bacaan SAAT POMPA MENYALA: beban
// motor menurunkan tegangan rel, jadi ADC suhu 35 C terbaca 557
// berbeban (602 tanpa beban) — ambang 570 akan menutup palsu.
bool ventTerbuka = false;
bool pompaNyala = false;

void setup() {
  pinMode(7, OUTPUT);
  pinMode(9, OUTPUT);
  pinMode(6, OUTPUT);
  digitalWrite(7, LOW);
  digitalWrite(6, LOW);
  analogWrite(9, 0);
  Serial.begin(9600);
}

void loop() {
  int adcSuhu = analogRead(A0);
  int adcHujan = analogRead(A1);
  int adcCahaya = analogRead(A2);

  // AO hujan TURUN saat basah: kering ±1013, terendam ±341
  bool hujan = adcHujan < 700;

  // Keputusan suhu dengan histeresis (hanya berubah di luar pita)
  if (adcSuhu >= 650) {
    if (!ventTerbuka) {
      ventTerbuka = true;
      Serial.println("VENT BUKA (panas)");
    }
    pompaNyala = true;
  } else if (adcSuhu <= 520) {
    if (ventTerbuka) {
      ventTerbuka = false;
      Serial.println("VENT TUTUP (suhu turun)");
    }
    pompaNyala = false;
  }
  // Di pita 571-649 tidak ada cabang: ventTerbuka & pompaNyala
  // mempertahankan nilai sebelumnya. Itulah histeresis.

  // Prioritas tertinggi: hujan menimpa keputusan suhu
  if (hujan) {
    if (ventTerbuka) {
      Serial.println("VENT TUTUP (HUJAN)");
    }
    ventTerbuka = false;
    pompaNyala = false;
  }

  analogWrite(9, ventTerbuka ? 255 : 0);
  digitalWrite(7, pompaNyala ? HIGH : LOW);

  // Lampu tumbuh: menyala saat cahaya kurang (ADC LDR < 500)
  digitalWrite(6, adcCahaya < 500 ? HIGH : LOW);

  Serial.print("Suhu ADC: ");
  Serial.print(adcSuhu);
  Serial.print(" Hujan ADC: ");
  Serial.print(adcHujan);
  Serial.print(" Cahaya ADC: ");
  Serial.println(adcCahaya);
  delay(200);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'ntc-thermistor', label: 'Termistor NTC terpasang sebagai sensor suhu' },
      { kind: 'component-present', type: 'rain-sensor', label: 'Sensor hujan MH-RD terpasang' },
      { kind: 'component-present', type: 'servo', label: 'Servo ventilasi terpasang' },
      {
        kind: 'serial-number-range',
        min: 600,
        max: 640,
        label: 'Bacaan ADC suhu NTC tercetak (pita tengah ±602 pada 35 °C)',
      },
      {
        kind: 'branch-current',
        type: 'servo',
        branch: 'angle',
        minA: 155,
        maxA: 180,
        label: 'Ventilasi membuka penuh saat suhu melewati ambang atas',
      },
      {
        kind: 'branch-current',
        type: 'dc-motor',
        branch: 'main',
        minA: 0.3,
        maxA: 0.5,
        label: 'Pompa menyala lewat MOSFET saat panas',
      },
      { kind: 'serial-contains', text: 'VENT BUKA', label: 'Serial mengumumkan ventilasi membuka' },
      {
        kind: 'serial-contains',
        text: 'VENT TUTUP (HUJAN)',
        label: 'Hujan memaksa ventilasi menutup (prioritas hujan di atas suhu)',
      },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.004,
        maxA: 0.025,
        label: 'Lampu tumbuh menyala saat cahaya kurang',
      },
    ],
  },
  {
    id: 'modul-24-penghitung-pengunjung',
    title: 'Modul 24 — Penghitung Pengunjung Dua Arah',
    boardId: 'uno',
    intro:
      'Penghitung pengunjung di toko, perpustakaan, dan parkir bekerja dengan dua sinar yang putus BERURUTAN: arah urutannya memberi tahu apakah seseorang masuk atau keluar. Satu sensor saja tidak bisa membedakan keduanya, dan urutan yang dibatalkan di tengah jalan — orang yang mengurungkan niat lalu mundur — tidak boleh mengubah hitungan. Sketch modul ini adalah mesin keadaan empat tahap yang hanya mengubah hitungan saat SELURUH urutan lintasan selesai: luar, keduanya, dalam, bebas berarti masuk; urutan cerminnya berarti keluar. Dua FC-51 menjadi kedua sinarnya (OUT aktif-LOW: halangan menariknya ke 0 V, dan karena keluarannya didorong aktif, ia dibaca dengan INPUT polos, bukan INPUT_PULLUP). Display 7-segment menampilkan hitungan 0–9, dan relay menyalakan lampu ruangan selama hitungan di atas nol — pin D11 hanya berbicara ke pin IN relay; kontak NO-lah yang memberi makan lampu dari rel. Perhatikan penghematan pin: titik desimal (DP) sengaja tidak disambung karena penghitung 0–9 tidak membutuhkannya.',
    goal: "Jalankan sketch — display menampilkan 0 dan lampu mati. Simulasikan orang masuk dengan penggeser Jarak halangan: turunkan FC-51 luar ke 10 cm, lalu FC-51 dalam ke 10 cm, lalu bebaskan luar (35 cm), terakhir bebaskan dalam — hitungan menjadi 1, Serial mencetak 'Masuk. Pengunjung: 1', dan lampu menyala. Sebelum menambah lagi, buktikan ketahanannya: putuskan sinar luar saja lalu bebaskan — hitungan tidak boleh berubah karena lintasan dibatalkan. Ulangi lintasan penuh sekali lagi sampai hitungan 2 dan segmen G ikut menyala. Terakhir simulasikan orang keluar dengan urutan cermin (dalam dulu) sampai Serial mencetak 'Keluar. Pengunjung: 1'. Tantangan: tambahkan alarm kapasitas — bila hitungan mencapai 9 (penuh), buat display berkedip (semua segmen nyala-mati tiap 500 ms memakai millis()) sampai ada pengunjung yang keluar.",
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
        // URUTAN FC-51 ADALAH KONTRAK DENGAN HARNESS: luar (indeks
        // instance 0) WAJIB ditempatkan sebelum dalam — jangan diubah.
        { type: 'fc-51', holeId: T('L', 24, 2) },
        { type: 'fc-51', holeId: T('L', 32, 2) },
        { type: 'relay', holeId: T('L', 48, 4) },
        { type: 'resistor', holeId: T('R', 58, 2), props: { resistance: 220 } },
        { type: 'led-5mm', holeId: T('R', 54, 4), props: { color: 'red' } },
      ],
      wires: [
        // Rel daya
        { a: pin('5V#3'), b: hole(RAIL('L+', 4)), color: RED },
        { a: hole(RAIL('L-', 4)), b: pin('GND#1'), color: DARK },
        { a: hole(RAIL('R-', 4)), b: pin('GND#2'), color: DARK },
        // Strip segmen display -> ujung B resistor segmen (bank R)
        { a: hole(T('L', 10, 2)), b: hole(T('R', 10, 4)), color: BLUE },
        { a: hole(T('L', 11, 2)), b: hole(T('R', 15, 4)), color: BLUE },
        { a: hole(T('L', 12, 2)), b: hole(T('R', 20, 4)), color: BLUE },
        { a: hole(T('L', 13, 2)), b: hole(T('R', 25, 4)), color: BLUE },
        { a: hole(T('L', 14, 2)), b: hole(T('R', 30, 4)), color: BLUE },
        { a: hole(T('L', 15, 2)), b: hole(T('R', 35, 4)), color: BLUE },
        { a: hole(T('L', 16, 2)), b: hole(T('R', 40, 4)), color: BLUE },
        // Pin board -> ujung A resistor segmen (D4..D10 untuk A..G)
        { a: pin('D4'), b: hole(T('R', 14, 4)), color: BLUE },
        { a: pin('D5'), b: hole(T('R', 19, 4)), color: BLUE },
        { a: pin('D6'), b: hole(T('R', 24, 4)), color: BLUE },
        { a: pin('D7'), b: hole(T('R', 29, 4)), color: BLUE },
        { a: pin('D8'), b: hole(T('R', 34, 4)), color: BLUE },
        { a: pin('D9'), b: hole(T('R', 39, 4)), color: BLUE },
        { a: pin('D10'), b: hole(T('R', 44, 4)), color: BLUE },
        // COM display -> GND
        { a: hole(T('L', 18, 2)), b: hole(RAIL('L-', 29)), color: DARK },
        // FC-51 luar (sinar pertama dari luar pintu)
        { a: hole(RAIL('L+', 29)), b: hole(T('L', 24, 4)), color: RED },
        { a: hole(T('L', 25, 4)), b: hole(RAIL('L-', 20)), color: DARK },
        { a: pin('D2'), b: hole(T('L', 26, 4)), color: BLUE },
        // FC-51 dalam (sinar kedua)
        { a: hole(RAIL('L+', 34)), b: hole(T('L', 32, 4)), color: RED },
        { a: hole(T('L', 33, 4)), b: hole(RAIL('L-', 25)), color: DARK },
        { a: pin('D3'), b: hole(T('L', 34, 4)), color: BLUE },
        // Relay: koil dari rel, IN dari D11, COM diberi makan rel
        { a: hole(RAIL('L+', 44)), b: hole(T('L', 48, 0)), color: RED },
        { a: pin('D11'), b: hole(T('L', 49, 0)), color: BLUE },
        { a: hole(T('L', 50, 0)), b: hole(RAIL('L-', 40)), color: DARK },
        { a: hole(RAIL('L+', 10)), b: hole(T('R', 48, 4)), color: RED },
        // Kontak NO -> resistor lampu -> LED -> rel R-
        { a: hole(T('R', 49, 4)), b: hole(T('R', 58, 4)), color: BLUE },
        { a: hole(T('R', 56, 4)), b: hole(RAIL('R-', 29)), color: DARK },
      ],
      sketch: `// Penghitung pengunjung dua arah.
// Mesin keadaan lintasan pintu:
//   tahap 0 = diam, 1 = sensor pertama putus, 2 = keduanya putus,
//   tahap 3 = ekor (sensor pertama bebas, kedua masih putus).
// Hitungan HANYA berubah saat seluruh urutan selesai — tidak pernah
// oleh satu sensor saja, tidak pernah oleh lintasan yang dibatalkan.
int pinSegmen[7] = {4, 5, 6, 7, 8, 9, 10};

// Pola bit per angka untuk 7 segmen: bit tertinggi = A, terendah = G
int pola[10] = {
  0b1111110, // 0
  0b0110000, // 1
  0b1101101, // 2
  0b1111001, // 3
  0b0110011, // 4
  0b1011011, // 5
  0b1011111, // 6
  0b1110000, // 7
  0b1111111, // 8
  0b1111011  // 9
};

int hitungan = 0;
int tahap = 0;
int arah = 0; // +1 masuk, -1 keluar

void tampilkan(int n) {
  for (int i = 0; i < 7; i++) {
    int bit = (pola[n] >> (6 - i)) & 1;
    digitalWrite(pinSegmen[i], bit);
  }
}

void selesaiLintasan() {
  hitungan = hitungan + arah;
  if (hitungan > 9) hitungan = 9;
  if (hitungan < 0) hitungan = 0;
  tampilkan(hitungan);
  if (arah > 0) {
    Serial.print("Masuk. Pengunjung: ");
  } else {
    Serial.print("Keluar. Pengunjung: ");
  }
  Serial.println(hitungan);
  arah = 0;
}

void setup() {
  for (int i = 0; i < 7; i++) {
    pinMode(pinSegmen[i], OUTPUT);
  }
  pinMode(2, INPUT);
  pinMode(3, INPUT);
  pinMode(11, OUTPUT);
  Serial.begin(9600);
  tampilkan(0);
  Serial.println("Pengunjung: 0");
}

void loop() {
  // OUT FC-51 aktif-LOW: sinar putus (ada orang) terbaca LOW
  bool luarPutus = digitalRead(2) == LOW;
  bool dalamPutus = digitalRead(3) == LOW;

  if (tahap == 0) {
    if (luarPutus && !dalamPutus) {
      arah = 1;
      tahap = 1;
    } else if (dalamPutus && !luarPutus) {
      arah = -1;
      tahap = 1;
    } else if (luarPutus && dalamPutus) {
      arah = 0;
      tahap = 2;
    }
  } else if (tahap == 1) {
    if (luarPutus && dalamPutus) {
      tahap = 2;
    } else if (!luarPutus && !dalamPutus) {
      // Sensor pertama bebas lagi sebelum sensor kedua putus:
      // orangnya mundur — lintasan dibatalkan, hitungan utuh.
      tahap = 0;
      arah = 0;
    }
  } else if (tahap == 2) {
    if (!luarPutus && !dalamPutus) {
      // Kedua sinar bebas bersamaan (lintasan sangat cepat)
      if (arah != 0) selesaiLintasan();
      tahap = 0;
    } else if (arah == 1 && !luarPutus && dalamPutus) {
      tahap = 3; // masuk: luar bebas duluan — ekor lintasan
    } else if (arah == -1 && luarPutus && !dalamPutus) {
      tahap = 3; // keluar: dalam bebas duluan — ekor lintasan
    } else if (arah == 1 && luarPutus && !dalamPutus) {
      tahap = 1; // dalam bebas duluan: orang mundur kembali
    } else if (arah == -1 && !luarPutus && dalamPutus) {
      tahap = 1;
    } else if (arah == 0 && luarPutus && !dalamPutus) {
      arah = 1;
      tahap = 1;
    } else if (arah == 0 && !luarPutus && dalamPutus) {
      arah = -1;
      tahap = 1;
    }
  } else if (tahap == 3) {
    if (!luarPutus && !dalamPutus) {
      selesaiLintasan();
      tahap = 0;
    } else if (luarPutus && dalamPutus) {
      tahap = 2; // orang melangkah mundur ke tengah pintu
    }
  }

  // Lampu ruangan menyala selama masih ada pengunjung di dalam
  digitalWrite(11, hitungan > 0 ? HIGH : LOW);
  delay(20);
}
`,
    },
    assertions: [
      { kind: 'component-present', type: 'fc-51', label: 'Sensor FC-51 terpasang di pintu' },
      { kind: 'component-present', type: 'seven-segment', label: 'Display 7-segment terpasang' },
      { kind: 'component-present', type: 'relay', label: 'Relay lampu ruangan terpasang' },
      { kind: 'pin-mode', pinId: 'D2', mode: 'INPUT', label: 'Pin D2 membaca FC-51 luar (INPUT, tanpa pull-up)' },
      {
        kind: 'branch-current',
        type: 'seven-segment',
        branch: 'a',
        minA: 0.004,
        maxA: 0.028,
        label: 'Segmen A menyala (angka 0 tampil sejak awal)',
      },
      { kind: 'serial-contains', text: 'Masuk. Pengunjung: 1', label: 'Lintasan masuk pertama terhitung' },
      {
        kind: 'branch-current',
        type: 'relay',
        branch: 'active',
        minA: 0.9,
        maxA: 1.1,
        label: 'Relay AKTIF (ada pengunjung di dalam — lampu menyala)',
      },
      {
        kind: 'branch-current',
        type: 'led-5mm',
        branch: 'led',
        minA: 0.004,
        maxA: 0.025,
        label: 'Lampu ruangan menyala lewat kontak NO relay',
      },
      {
        kind: 'branch-current',
        type: 'seven-segment',
        branch: 'g',
        minA: 0.004,
        maxA: 0.028,
        label: 'Segmen G menyala (hitungan mencapai 2)',
      },
      { kind: 'serial-contains', text: 'Masuk. Pengunjung: 2', label: 'Lintasan masuk kedua terhitung' },
      { kind: 'serial-contains', text: 'Keluar. Pengunjung: 1', label: 'Lintasan keluar terhitung (hitungan berkurang)' },
    ],
  },
];

export function getLesson(id: string): LessonModule | undefined {
  return LESSONS.find((l) => l.id === id);
}
