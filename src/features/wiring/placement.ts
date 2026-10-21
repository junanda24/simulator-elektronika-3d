import { EMPTY_SIM_RESULT, type ComponentInstanceState } from '../../shared/types';
import { getComponentMeta } from '../../shared/components/catalogMeta';
import {
  TERMINAL_COLS,
  TERMINAL_ROWS,
  holeWorldPosition,
  parseHole,
  terminalHoleId,
} from '../../shared/boards/breadboard';

export interface Placement {
  instance: ComponentInstanceState;
  pinHoles: Record<string, string>;
}

/** Rotasi penempatan yang dipilih pengguna (derajat, kelipatan 90°). */
export type PlacementRotation = 0 | 90 | 180 | 270;

let counter = 0;
function nextId(type: string): string {
  counter += 1;
  return `${type}-${Date.now().toString(36)}-${counter}`;
}

/**
 * Spesifikasi penempatan generik "satu kolom": pin-pin segaris dalam
 * satu kolom breadboard dengan offset baris dari lubang klik. Dipakai
 * mayoritas komponen Batch 5 — menambah komponen cukup menambah baris
 * di tabel ini + meta pin lokal yang cocok (z lokal = offset − rata-rata).
 */
const COLUMN_SPECS: Record<string, Array<{ id: string; rowOffset: number }>> = {
  capacitor: [
    { id: 'PLUS', rowOffset: 0 },
    { id: 'MINUS', rowOffset: 2 },
  ],
  diode: [
    { id: 'ANODE', rowOffset: 0 },
    { id: 'CATHODE', rowOffset: 2 },
  ],
  'rgb-led': [
    { id: 'COM', rowOffset: 0 },
    { id: 'R', rowOffset: 1 },
    { id: 'G', rowOffset: 2 },
    { id: 'B', rowOffset: 3 },
  ],
  ldr: [
    { id: 'A', rowOffset: 0 },
    { id: 'B', rowOffset: 2 },
  ],
  fuse: [
    { id: 'A', rowOffset: 0 },
    { id: 'B', rowOffset: 2 },
  ],
  'tilt-switch': [
    { id: 'A', rowOffset: 0 },
    { id: 'B', rowOffset: 2 },
  ],
  buzzer: [
    { id: 'PLUS', rowOffset: 0 },
    { id: 'MINUS', rowOffset: 2 },
  ],
  'dc-motor': [
    { id: 'PLUS', rowOffset: 0 },
    { id: 'MINUS', rowOffset: 2 },
  ],
  'lm35': [
    { id: 'VCC', rowOffset: 0 },
    { id: 'OUT', rowOffset: 1 },
    { id: 'GND', rowOffset: 2 },
  ],
  'soil-moisture': [
    { id: 'VCC', rowOffset: 0 },
    { id: 'AO', rowOffset: 1 },
    { id: 'GND', rowOffset: 2 },
  ],
  pir: [
    { id: 'VCC', rowOffset: 0 },
    { id: 'OUT', rowOffset: 1 },
    { id: 'GND', rowOffset: 2 },
  ],
  transistor: [
    { id: 'E', rowOffset: 0 },
    { id: 'B', rowOffset: 1 },
    { id: 'C', rowOffset: 2 },
  ],
  servo: [
    { id: 'GND', rowOffset: 0 },
    { id: 'VCC', rowOffset: 1 },
    { id: 'SIG', rowOffset: 2 },
  ],
  joystick: [
    { id: 'VCC', rowOffset: 0 },
    { id: 'GND', rowOffset: 1 },
    { id: 'VRX', rowOffset: 2 },
    { id: 'VRY', rowOffset: 3 },
    { id: 'SW', rowOffset: 4 },
  ],
  'seven-segment': [
    { id: 'A', rowOffset: 0 },
    { id: 'B', rowOffset: 1 },
    { id: 'C', rowOffset: 2 },
    { id: 'D', rowOffset: 3 },
    { id: 'E', rowOffset: 4 },
    { id: 'F', rowOffset: 5 },
    { id: 'G', rowOffset: 6 },
    { id: 'DP', rowOffset: 7 },
    { id: 'COM', rowOffset: 8 },
  ],
};

/** Offset satu pin relatif terhadap lubang jangkar (lubang yang diklik). */
interface PinOffset {
  id: string;
  /** Offset indeks kolom GLOBAL papan (bank L = 0..4, bank R = 5..9). */
  dCol: number;
  /** Offset baris dari baris lubang jangkar. */
  dRow: number;
}

/**
 * Offset grid tiap pin pada rotasi 0°, relatif terhadap lubang klik.
 * Mengembalikan null bila lubang klik bukan titik jangkar yang sah
 * untuk komponen tersebut (precondition klik dipertahankan dari
 * perilaku lama, tidak tergantung rotasi):
 * - LED: lubang klik = anoda; katoda 2 baris di bawahnya.
 * - Resistor: lubang klik = kaki A; kaki B 4 baris di atasnya, badan
 *   diputar 90° (baseRotation π/2) agar membentang sepanjang baris.
 * - Push Button: membentang melintasi kanal — klik sah hanya pada A1
 *   (bank L kolom 4) atau B1 (bank R kolom 0); sisi B selalu +1 kolom
 *   global dari sisi A.
 * - Potensiometer: klik = kaki A; WIPER +1 baris, kaki B +2 baris.
 * - Relay: klik = VCC, sah hanya di kolom tepi kanal bank L (col 4).
 *   Pola DIP menjembatani kanal: pin kendali tetap di bank L, pin
 *   kontak menyeberang ke kolom 0 bank R — baris kontak tidak pernah
 *   sebank dengan baris kendali, jadi net COM/NO/NC independen penuh
 *   dari net VCC/IN/GND (perbaikan audit T2: footprint lama menaruh
 *   kontak sebaris kendali sehingga COM ≡ VCC, NO ≡ IN, NC ≡ GND).
 */
function pinOffsetsFor(
  type: string,
  bank: 'L' | 'R',
  col: number,
): { offsets: PinOffset[]; baseRotation: number } | null {
  if (type === 'led-5mm') {
    return {
      baseRotation: 0,
      offsets: [
        { id: 'ANODE', dCol: 0, dRow: 0 },
        { id: 'CATHODE', dCol: 0, dRow: 2 },
      ],
    };
  }
  if (type === 'resistor') {
    return {
      baseRotation: Math.PI / 2,
      offsets: [
        { id: 'A', dCol: 0, dRow: 0 },
        { id: 'B', dCol: 0, dRow: -4 },
      ],
    };
  }
  if (type === 'push-button') {
    const isA1 = bank === 'L' && col === 4;
    const isB1 = bank === 'R' && col === 0;
    if (!isA1 && !isB1) return null;
    const aCol = isA1 ? 0 : -1;
    const bCol = isA1 ? 1 : 0;
    return {
      baseRotation: 0,
      offsets: [
        { id: 'A1', dCol: aCol, dRow: 0 },
        { id: 'A2', dCol: aCol, dRow: 2 },
        { id: 'B1', dCol: bCol, dRow: 0 },
        { id: 'B2', dCol: bCol, dRow: 2 },
      ],
    };
  }
  if (type === 'potentiometer') {
    return {
      baseRotation: 0,
      offsets: [
        { id: 'A', dCol: 0, dRow: 0 },
        { id: 'WIPER', dCol: 0, dRow: 1 },
        { id: 'B', dCol: 0, dRow: 2 },
      ],
    };
  }
  if (type === 'relay') {
    // DIP menjembatani kanal tengah: klik hanya sah di tepi kanal
    // bank L (col 4). Kontak di kolom global +1 = kolom 0 bank R;
    // secara fisik itu 3 satuan dari kolom kendali (x −1,5 → +1,5)
    // karena x kolom bank R mulai di +1,5 — cocok dengan localPosition
    // meta (kendali −1,5, kontak +1,5) yang dikunci relay-alignment.
    if (bank !== 'L' || col !== 4) return null;
    return {
      baseRotation: 0,
      offsets: [
        { id: 'VCC', dCol: 0, dRow: 0 },
        { id: 'IN', dCol: 0, dRow: 1 },
        { id: 'GND', dCol: 0, dRow: 2 },
        { id: 'COM', dCol: 1, dRow: 0 },
        { id: 'NO', dCol: 1, dRow: 1 },
        { id: 'NC', dCol: 1, dRow: 2 },
      ],
    };
  }
  const spec = COLUMN_SPECS[type];
  if (spec) {
    return {
      baseRotation: 0,
      offsets: spec.map((p) => ({ id: p.id, dCol: 0, dRow: p.rowOffset })),
    };
  }
  return null;
}

/**
 * Hitung penempatan komponen dari lubang yang diklik pengguna.
 *
 * `rotationDeg` memutar seluruh footprint di ruang grid lubang
 * (indeks kolom global, baris) relatif terhadap lubang jangkar:
 * 90° memetakan offset (dCol, dRow) → (dRow, −dCol), 180° → (−dCol, −dRow),
 * 270° → (−dRow, dCol). Semua lubang hasil harus berada di papan dan
 * kosong; bila tidak, penempatan tidak valid (null) — tidak dipaksakan.
 *
 * Nilai `rotation` pada instance (radian, untuk render) adalah
 * baseRotation bawaan komponen DITAMBAH rotationDeg dalam radian.
 * Mengembalikan null bila lubang tujuan tidak valid / terisi komponen lain.
 */
export function computePlacement(
  type: string,
  clickedHoleId: string,
  occupiedHoles: Set<string>,
  rotationDeg: PlacementRotation = 0,
): Placement | null {
  const plugin = getComponentMeta(type);
  const clicked = parseHole(clickedHoleId);
  if (!plugin || !clicked || clicked.kind !== 'terminal') return null;
  const bank = clicked.bank as 'L' | 'R';
  const row = clicked.row as number;
  const col = clicked.col as number;

  const plan = pinOffsetsFor(type, bank, col);
  if (!plan) return null;

  const anchorGlobalCol = bank === 'L' ? col : col + TERMINAL_COLS;
  const pinHoles: Record<string, string> = {};
  for (const pin of plan.offsets) {
    let dCol = pin.dCol;
    let dRow = pin.dRow;
    if (rotationDeg === 90) {
      const prevCol = dCol;
      dCol = dRow;
      dRow = -prevCol;
    } else if (rotationDeg === 180) {
      dCol = -dCol;
      dRow = -dRow;
    } else if (rotationDeg === 270) {
      const prevCol = dCol;
      dCol = -dRow;
      dRow = prevCol;
    }
    const g = anchorGlobalCol + dCol;
    const r = row + dRow;
    if (g < 0 || g >= TERMINAL_COLS * 2 || r < 0 || r >= TERMINAL_ROWS) return null;
    const targetBank = g < TERMINAL_COLS ? 'L' : 'R';
    const targetCol = g < TERMINAL_COLS ? g : g - TERMINAL_COLS;
    pinHoles[pin.id] = terminalHoleId(targetBank, r, targetCol);
  }

  for (const holeId of Object.values(pinHoles)) {
    if (occupiedHoles.has(holeId)) return null;
  }

  // Posisi instance = titik tengah antar kaki (dunia), di permukaan breadboard
  const positions = Object.values(pinHoles)
    .map((holeId) => holeWorldPosition(holeId))
    .filter((p): p is [number, number, number] => p !== null);
  if (positions.length !== Object.keys(pinHoles).length) return null;
  const center: [number, number, number] = [
    positions.reduce((sum, p) => sum + p[0], 0) / positions.length,
    positions[0][1],
    positions.reduce((sum, p) => sum + p[2], 0) / positions.length,
  ];

  return {
    instance: {
      id: nextId(type),
      type,
      position: center,
      rotation: plan.baseRotation + (rotationDeg * Math.PI) / 180,
      props: { ...plugin.defaultProps },
      interactiveState: {},
      simState: EMPTY_SIM_RESULT,
    },
    pinHoles,
  };
}
