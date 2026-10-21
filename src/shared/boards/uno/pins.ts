/**
 * Definisi pin Arduino Uno R3 — posisi lokal cocok dengan render
 * di UnoBoard.tsx (header: digital z=-9.6, daya & analog z=9.6).
 * Board dirender pada UNO_ORIGIN di stage.
 */

export const UNO_ORIGIN: [number, number, number] = [-21, 0, 0];
export const UNO_TOP_Y = 1.7;

export type UnoPinKind = 'power' | 'ground' | 'digital' | 'analog' | 'control';

export interface UnoPin {
  id: string;
  label: string;
  kind: UnoPinKind;
  /** Net bawaan board: kedua pin GND berbagi net yang sama. */
  net: string;
  local: [number, number, number];
}

function buildUnoPins(): UnoPin[] {
  const pins: UnoPin[] = [];
  // Header digital atas: indeks i -> D(13-i), x = -6.5 + i, z = -9.6
  for (let i = 0; i < 14; i += 1) {
    const id = `D${13 - i}`;
    pins.push({ id, label: id, kind: 'digital', net: id, local: [-6.5 + i, 1.15, -9.6] });
  }
  // Header daya bawah: x = -8.9 + i, z = 9.6
  const power: Array<[string, UnoPinKind]> = [
    ['VIN', 'power'],
    ['GND', 'ground'],
    ['GND', 'ground'],
    ['5V', 'power'],
    ['3V3', 'power'],
    ['RST', 'control'],
    ['IOREF', 'control'],
    ['AREF', 'control'],
  ];
  power.forEach(([label, kind], i) => {
    pins.push({
      id: `${label}#${i}`,
      label,
      kind,
      net: label,
      local: [-8.9 + i, 1.15, 9.6],
    });
  });
  // Header analog bawah kanan: x = 3.1 + i, z = 9.6
  for (let i = 0; i < 6; i += 1) {
    const id = `A${i}`;
    pins.push({ id, label: id, kind: 'analog', net: id, local: [3.1 + i, 1.15, 9.6] });
  }
  return pins;
}

export const UNO_PINS: UnoPin[] = buildUnoPins();

const BY_ID = new Map(UNO_PINS.map((pin) => [pin.id, pin]));

export function unoPinById(id: string): UnoPin | undefined {
  return BY_ID.get(id);
}

export function unoPinWorldPosition(id: string): [number, number, number] | null {
  const pin = BY_ID.get(id);
  if (!pin) return null;
  return [UNO_ORIGIN[0] + pin.local[0], UNO_ORIGIN[1] + pin.local[1], UNO_ORIGIN[2] + pin.local[2]];
}

/** Pin board terdekat dari titik lokal (x, z) di bidang header. */
export function unoPinAtLocal(x: number, z: number): UnoPin | null {
  let best: UnoPin | null = null;
  let bestDist = 0.95;
  for (const pin of UNO_PINS) {
    const dist = Math.hypot(pin.local[0] - x, pin.local[2] - z);
    if (dist < bestDist) {
      bestDist = dist;
      best = pin;
    }
  }
  return best;
}
