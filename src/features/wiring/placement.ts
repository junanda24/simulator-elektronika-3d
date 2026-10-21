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
