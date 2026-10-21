import { EMPTY_SIM_RESULT, type ComponentInstanceState } from '../../shared/types';
import { getComponentMeta } from '../../shared/components/catalogMeta';
import {
  holeWorldPosition,
  parseHole,
  terminalHoleId,
} from '../../shared/boards/breadboard';

export interface Placement {
  instance: ComponentInstanceState;
  pinHoles: Record<string, string>;
}

let counter = 0;
function nextId(type: string): string {
  counter += 1;
  return `${type}-${Date.now().toString(36)}-${counter}`;
}

/**
 * Hitung penempatan komponen dari lubang yang diklik pengguna.
 * - LED: lubang klik = anoda; katoda = lubang 2 baris di bawahnya (kolom sama).
 * - Resistor: lubang klik = kaki A; kaki B = 4 baris di atasnya (kolom sama),
 *   badan diputar 90° agar membentang sepanjang baris (beda strip).
 * - Push Button: membentang melintasi kanal — sisi A di bank L kolom 4,
 *   sisi B di bank R kolom 0. Klik valid hanya pada lubang A1 (L,4) atau
 *   B1 (R,0); A2/B2 = 2 baris di bawahnya.
 * - Potensiometer: lubang klik = kaki A; Wiper = 1 baris di bawahnya,
 *   kaki B = 2 baris di bawahnya (bank & kolom sama).
 * Mengembalikan null bila lubang tujuan tidak valid / terisi komponen lain.
 */
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

export function computePlacement(
  type: string,
  clickedHoleId: string,
  occupiedHoles: Set<string>,
): Placement | null {
  const plugin = getComponentMeta(type);
  const clicked = parseHole(clickedHoleId);
  if (!plugin || !clicked || clicked.kind !== 'terminal') return null;
  const bank = clicked.bank as 'L' | 'R';
  const row = clicked.row as number;
  const col = clicked.col as number;

  let pinHoles: Record<string, string> = {};
  let rotation = 0;

  if (type === 'led-5mm') {
    const cathodeRow = row + 2;
    if (cathodeRow >= 63) return null;
    pinHoles = {
      ANODE: clickedHoleId,
      CATHODE: terminalHoleId(bank, cathodeRow, col),
    };
  } else if (type === 'resistor') {
    const rowB = row - 4;
    if (rowB < 0) return null;
    pinHoles = {
      A: clickedHoleId,
      B: terminalHoleId(bank, rowB, col),
    };
    rotation = Math.PI / 2;
  } else if (type === 'push-button') {
    // Hanya dua lubang klik yang valid: A1 di L kolom 4, atau B1 di R kolom 0
    // (baris yang sama — instance di tengah kanal di antara keduanya).
    const isA1 = bank === 'L' && col === 4;
    const isB1 = bank === 'R' && col === 0;
    if (!isA1 && !isB1) return null;
    if (row + 2 >= 63) return null;
    pinHoles = {
      A1: terminalHoleId('L', row, 4),
      A2: terminalHoleId('L', row + 2, 4),
      B1: terminalHoleId('R', row, 0),
      B2: terminalHoleId('R', row + 2, 0),
    };
  } else if (type === 'potentiometer') {
    if (row + 2 >= 63) return null;
    pinHoles = {
      A: clickedHoleId,
      WIPER: terminalHoleId(bank, row + 1, col),
      B: terminalHoleId(bank, row + 2, col),
    };
  } else if (type === 'relay') {
    // Dua kolom: sisi koil (klik = VCC) dan sisi kontak 3 kolom di kanan.
    if (row + 2 >= 63 || col + 3 > 4) return null;
    pinHoles = {
      VCC: clickedHoleId,
      IN: terminalHoleId(bank, row + 1, col),
      GND: terminalHoleId(bank, row + 2, col),
      COM: terminalHoleId(bank, row, col + 3),
      NO: terminalHoleId(bank, row + 1, col + 3),
      NC: terminalHoleId(bank, row + 2, col + 3),
    };
  } else if (COLUMN_SPECS[type]) {
    const spec = COLUMN_SPECS[type];
    const maxRow = row + Math.max(...spec.map((p) => p.rowOffset));
    if (maxRow >= 63) return null;
    pinHoles = {};
    for (const pinSpec of spec) {
      pinHoles[pinSpec.id] = terminalHoleId(bank, row + pinSpec.rowOffset, col);
    }
  } else {
    return null;
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
      rotation,
      props: { ...plugin.defaultProps },
      interactiveState: {},
      simState: EMPTY_SIM_RESULT,
    },
    pinHoles,
  };
}
