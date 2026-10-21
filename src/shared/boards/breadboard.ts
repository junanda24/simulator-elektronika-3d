/**
 * Geometri breadboard 830 titik — SUMBER KEBENARAN posisi lubang.
 * Harus selalu cocok dengan render di features/stage3d/Breadboard.tsx.
 * Skala: 1 unit = 1 pitch (2.54 mm). Koordinat lokal terhadap ORIGIN.
 */

export const BREADBOARD_ORIGIN: [number, number, number] = [12, 0, 0];
export const BREADBOARD_TOP_Y = 3;

export type BankId = 'L' | 'R';
export type RailId = 'L+' | 'L-' | 'R+' | 'R-';

export const TERMINAL_ROWS = 63;
export const TERMINAL_COLS = 5;
export const RAIL_HOLES = 50;

/** X lokal kolom terminal per bank (indeks kolom 0..4). */
const TERMINAL_X: Record<BankId, number[]> = {
  L: [-5.5, -4.5, -3.5, -2.5, -1.5],
  R: [1.5, 2.5, 3.5, 4.5, 5.5],
};

/** X lokal kolom rail daya. */
const RAIL_X: Record<RailId, number> = { 'L-': -9.3, 'L+': -8.1, 'R-': 8.1, 'R+': 9.3 };

export function terminalHoleId(bank: BankId, row: number, col: number): string {
  return `t:${bank}:${row}:${col}`;
}

export function railHoleId(rail: RailId, index: number): string {
  return `r:${rail}:${index}`;
}

export type HoleId = string;

interface ParsedHole {
  kind: 'terminal' | 'rail';
  bank?: BankId;
  row?: number;
  col?: number;
  rail?: RailId;
  index?: number;
}

export function parseHole(holeId: HoleId): ParsedHole | null {
  const parts = holeId.split(':');
  if (parts[0] === 't' && parts.length === 4) {
    const bank = parts[1] as BankId;
    const row = Number(parts[2]);
    const col = Number(parts[3]);
    if ((bank === 'L' || bank === 'R') && row >= 0 && row < TERMINAL_ROWS && col >= 0 && col < TERMINAL_COLS) {
      return { kind: 'terminal', bank, row, col };
    }
    return null;
  }
  if (parts[0] === 'r' && parts.length === 3) {
    const rail = parts[1] as RailId;
    const index = Number(parts[2]);
    if (rail in RAIL_X && index >= 0 && index < RAIL_HOLES) return { kind: 'rail', rail, index };
    return null;
  }
  return null;
}

/** Posisi lokal lubang (y = permukaan atas breadboard). */
export function holeLocalPosition(holeId: HoleId): [number, number, number] | null {
  const parsed = parseHole(holeId);
  if (!parsed) return null;
  if (parsed.kind === 'terminal') {
    return [TERMINAL_X[parsed.bank as BankId][parsed.col as number], BREADBOARD_TOP_Y, -31 + (parsed.row as number)];
  }
  return [RAIL_X[parsed.rail as RailId], BREADBOARD_TOP_Y, -24.5 + (parsed.index as number)];
}

export function holeWorldPosition(holeId: HoleId): [number, number, number] | null {
  const local = holeLocalPosition(holeId);
  if (!local) return null;
  return [
    BREADBOARD_ORIGIN[0] + local[0],
    BREADBOARD_ORIGIN[1] + local[1],
    BREADBOARD_ORIGIN[2] + local[2],
  ];
}

/**
 * Net bawaan lubang: 5 lubang satu baris satu bank = satu strip;
 * satu kolom rail penuh = satu net.
 */
export function holeNetKey(holeId: HoleId): string | null {
  const parsed = parseHole(holeId);
  if (!parsed) return null;
  if (parsed.kind === 'terminal') return `strip:${parsed.bank}:${parsed.row}`;
  return `rail:${parsed.rail}`;
}

/** Lubang terminal satu strip (untuk highlight X-Ray). */
export function stripHoleIds(bank: BankId, row: number): HoleId[] {
  return Array.from({ length: TERMINAL_COLS }, (_, col) => terminalHoleId(bank, row, col));
}

/**
 * Cari lubang terdekat dari titik lokal (x, z) di permukaan breadboard.
 * Matematis murni — tanpa raycast per lubang (TECH_STACK.md §2.2).
 */
export function holeAtLocal(x: number, z: number): HoleId | null {
  // Rail: pita x di tepi
  for (const rail of Object.keys(RAIL_X) as RailId[]) {
    const cx = RAIL_X[rail];
    if (Math.abs(x - cx) <= 0.6) {
      const index = Math.round(z + 24.5);
      if (index >= 0 && index < RAIL_HOLES && Math.abs(z - (-24.5 + index)) <= 0.5) {
        return railHoleId(rail, index);
      }
    }
  }
  // Terminal
  const bank: BankId | null = x < 0 ? 'L' : x > 0 ? 'R' : null;
  if (bank) {
    const cols = TERMINAL_X[bank];
    const col = cols.findIndex((cx) => Math.abs(x - cx) <= 0.5);
    const row = Math.round(z + 31);
    if (col >= 0 && row >= 0 && row < TERMINAL_ROWS && Math.abs(z - (-31 + row)) <= 0.5) {
      return terminalHoleId(bank, row, col);
    }
  }
  return null;
}

/** Label manusiawi untuk lubang (dipakai probe & panel). */
export function holeLabel(holeId: HoleId): string {
  const parsed = parseHole(holeId);
  if (!parsed) return holeId;
  if (parsed.kind === 'terminal') {
    return `Breadboard ${parsed.bank}${(parsed.row as number) + 1}${'abcde'[parsed.col as number]}`;
  }
  return `Rail ${parsed.rail} · lubang ${(parsed.index as number) + 1}`;
}
