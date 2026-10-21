import { terminalHoleId, railHoleId } from '../../shared/boards/breadboard';
import type { TerminalRef } from '../wiring/netlist';
import { DEFAULT_SKETCH } from '../sketch/defaultSketch';
import type { Assertion } from './engine';

/**
 * Kurikulum mode Lesson — 8 modul Bahasa Indonesia (ROADMAP Batch 4).
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
];

export function getLesson(id: string): LessonModule | undefined {
  return LESSONS.find((l) => l.id === id);
}
