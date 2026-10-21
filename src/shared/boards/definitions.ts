import type { BoardProfile } from '../types';
import { UNO_PINS, UNO_ORIGIN, UNO_TOP_Y, type UnoPin } from './uno/pins';
import { UNO_PROFILE } from './profiles';

/**
 * Definisi board generik (kontrak BoardPlugin versi data): pinout,
 * profil elektrik, rel daya, dan pin demo untuk setiap board yang
 * didukung. Data murni tanpa React — dipakai netlist, sesi worker,
 * stage 3D, dan UI. Menambah board = menambah satu entri di sini
 * + satu model 3D.
 */

export type BoardPin = UnoPin;
export type BoardPinKind = BoardPin['kind'];

export interface BoardDefinition {
  id: string;
  name: string;
  profile: BoardProfile;
  origin: [number, number, number];
  /** Ketinggian bidang interaksi header (samakan antar board). */
  topY: number;
  /** Ukuran PCB [lebar x, dalam z] dalam unit scene. */
  size: [number, number];
  pins: BoardPin[];
  /** Rel daya saat board berdaya: nama net pin → tegangan sumber. */
  powerRails: Array<{ net: string; volts: number }>;
  /** Net rel logika (tujuan pull-up internal). */
  logicRailNet: string;
  /** Pin LED onboard untuk rangkaian demo. */
  demoPinId: string;
  demoPinNumber: number;
  pcbColor: string;
}

// Origin bersama semua board non-Uno. -21 (bukan -42): board didekatkan ke
// breadboard (origin x=12) agar celah tepi board→breadboard ±8,5 unit
// (±21,6mm), bukan ±29,5 unit seperti layout lama. UNO_ORIGIN di uno/pins.ts
// memakai nilai yang sama — keduanya WAJIB digeser bersamaan.
const ORIGIN: [number, number, number] = [-21, 0, 0];
const TOP_Y = 1.7;
const PIN_Y = 1.15;

function twoColumns(
  left: Array<[string, BoardPinKind]>,
  right: Array<[string, BoardPinKind]>,
  x: number,
  zStart: number,
  zStep: number,
): BoardPin[] {
  // Id pin yang berulang (GND, 3V3) diberi sufiks #n agar tetap unik
  // sebagai terminal kabel, sementara net-nya tetap berbagi (pola Uno).
  const counts = new Map<string, number>();
  const total = new Map<string, number>();
  for (const [id] of [...left, ...right]) total.set(id, (total.get(id) ?? 0) + 1);
  const mk = (id: string, kind: BoardPinKind, px: number, z: number): BoardPin => {
    let uniqueId = id;
    if ((total.get(id) ?? 0) > 1) {
      const n = counts.get(id) ?? 0;
      counts.set(id, n + 1);
      uniqueId = `${id}#${n}`;
    }
    return { id: uniqueId, label: id, kind, net: id, local: [px, PIN_Y, z] };
  };
  const out: BoardPin[] = [];
  left.forEach(([id, kind], i) => out.push(mk(id, kind, -x, zStart + i * zStep)));
  right.forEach(([id, kind], i) => out.push(mk(id, kind, x, zStart + i * zStep)));
  return out;
}

/* ---------------- Arduino Uno (migrasi dari uno/pins.ts) ---------------- */

const UNO_DEF: BoardDefinition = {
  id: 'uno',
  name: 'Arduino Uno',
  profile: UNO_PROFILE,
  origin: UNO_ORIGIN,
  topY: UNO_TOP_Y,
  size: [27, 21],
  pins: UNO_PINS,
  powerRails: [
    { net: '5V', volts: 5 },
    { net: '3V3', volts: 3.3 },
  ],
  logicRailNet: '5V',
  demoPinId: 'D13',
  demoPinNumber: 13,
  pcbColor: '#0e7490',
};

/* ---------------- ESP32 DevKit V1 (30 pin) ---------------- */

const ESP32_PROFILE: BoardProfile = {
  id: 'esp32',
  logicVolts: 3.3,
  pinOhms: 25,
  pinMaxMa: 28,
  adcBits: 12,
  adcRefVolts: 3.3,
  digitalThresholdVolts: 1.65,
  pullupOhms: 45000,
};

const ESP32_DEF: BoardDefinition = {
  id: 'esp32',
  name: 'ESP32 DevKit',
  profile: ESP32_PROFILE,
  origin: ORIGIN,
  topY: TOP_Y,
  size: [11, 24],
  pins: twoColumns(
    [
      ['EN', 'control'],
      ['D36', 'analog'],
      ['D39', 'analog'],
      ['D34', 'analog'],
      ['D35', 'analog'],
      ['D32', 'digital'],
      ['D33', 'digital'],
      ['D25', 'digital'],
      ['D26', 'digital'],
      ['D27', 'digital'],
      ['D14', 'digital'],
      ['D12', 'digital'],
      ['D13', 'digital'],
      ['GND', 'ground'],
      ['VIN', 'power'],
    ],
    [
      ['D23', 'digital'],
      ['D22', 'digital'],
      ['D21', 'digital'],
      ['D19', 'digital'],
      ['D18', 'digital'],
      ['D5', 'digital'],
      ['D17', 'digital'],
      ['D16', 'digital'],
      ['D4', 'digital'],
      ['D2', 'digital'],
      ['D15', 'digital'],
      ['D3', 'digital'],
      ['D1', 'digital'],
      ['GND', 'ground'],
      ['3V3', 'power'],
    ],
    3.5,
    -10.5,
    1.5,
  ),
  powerRails: [
    { net: '3V3', volts: 3.3 },
    { net: 'VIN', volts: 5 },
  ],
  logicRailNet: '3V3',
  demoPinId: 'D2',
  demoPinNumber: 2,
  pcbColor: '#23262b',
};

/* ---------------- NodeMCU ESP8266 (penyederhanaan silkscreen) ---------------- */

const NODEMCU_PROFILE: BoardProfile = {
  id: 'nodemcu',
  logicVolts: 3.3,
  pinOhms: 25,
  pinMaxMa: 12,
  adcBits: 10,
  adcRefVolts: 3.3,
  digitalThresholdVolts: 1.65,
  pullupOhms: 47000,
};

const NODEMCU_DEF: BoardDefinition = {
  id: 'nodemcu',
  name: 'NodeMCU ESP8266',
  profile: NODEMCU_PROFILE,
  origin: ORIGIN,
  topY: TOP_Y,
  size: [12, 20],
  pins: twoColumns(
    [
      ['RST', 'control'],
      ['A0', 'analog'],
      ['EN', 'control'],
      ['D0', 'digital'],
      ['D1', 'digital'],
      ['D2', 'digital'],
      ['D3', 'digital'],
      ['D4', 'digital'],
      ['GND', 'ground'],
      ['3V3', 'power'],
      ['GND', 'ground'],
      ['VIN', 'power'],
    ],
    [
      ['VU', 'power'],
      ['GND', 'ground'],
      ['3V3', 'power'],
      ['D5', 'digital'],
      ['D6', 'digital'],
      ['D7', 'digital'],
      ['D8', 'digital'],
      ['D9', 'digital'],
      ['D10', 'digital'],
      ['GND', 'ground'],
      ['3V3', 'power'],
      ['GND', 'ground'],
    ],
    3.5,
    -8.25,
    1.5,
  ),
  powerRails: [
    { net: '3V3', volts: 3.3 },
    { net: 'VIN', volts: 5 },
    { net: 'VU', volts: 5 },
  ],
  logicRailNet: '3V3',
  // LED onboard NodeMCU menempel di D4 (GPIO2) — di board asli aktif-rendah,
  // di simulator disederhanakan aktif-tinggi.
  demoPinId: 'D4',
  demoPinNumber: 4,
  pcbColor: '#1f2733',
};

/* ---------------- Raspberry Pi Pico (40 pin) ---------------- */

const PICO_PROFILE: BoardProfile = {
  id: 'pico',
  logicVolts: 3.3,
  pinOhms: 25,
  pinMaxMa: 28,
  adcBits: 12,
  adcRefVolts: 3.3,
  digitalThresholdVolts: 1.65,
  pullupOhms: 60000,
};

const PICO_DEF: BoardDefinition = {
  id: 'pico',
  name: 'Raspberry Pi Pico',
  profile: PICO_PROFILE,
  origin: ORIGIN,
  topY: TOP_Y,
  size: [11, 27],
  pins: twoColumns(
    [
      ['D0', 'digital'],
      ['D1', 'digital'],
      ['GND', 'ground'],
      ['D2', 'digital'],
      ['D3', 'digital'],
      ['D4', 'digital'],
      ['D5', 'digital'],
      ['GND', 'ground'],
      ['D6', 'digital'],
      ['D7', 'digital'],
      ['D8', 'digital'],
      ['D9', 'digital'],
      ['GND', 'ground'],
      ['D10', 'digital'],
      ['D11', 'digital'],
      ['D12', 'digital'],
      ['D13', 'digital'],
      ['GND', 'ground'],
      ['D14', 'digital'],
      ['D15', 'digital'],
    ],
    [
      ['VBUS', 'power'],
      ['VSYS', 'control'],
      ['GND', 'ground'],
      ['3V3_EN', 'control'],
      ['3V3', 'power'],
      ['ADC_VREF', 'control'],
      ['A2', 'analog'],
      ['GND', 'ground'],
      ['A1', 'analog'],
      ['A0', 'analog'],
      ['RUN', 'control'],
      ['D22', 'digital'],
      ['GND', 'ground'],
      ['D21', 'digital'],
      ['D20', 'digital'],
      ['D19', 'digital'],
      ['D18', 'digital'],
      ['GND', 'ground'],
      ['D17', 'digital'],
      ['D16', 'digital'],
    ],
    3.5,
    -12.35,
    1.3,
  ),
  powerRails: [
    { net: 'VBUS', volts: 5 },
    { net: '3V3', volts: 3.3 },
  ],
  logicRailNet: '3V3',
  demoPinId: 'D25',
  demoPinNumber: 25,
  pcbColor: '#14632f',
};

export const BOARD_DEFINITIONS: Record<string, BoardDefinition> = {
  uno: UNO_DEF,
  esp32: ESP32_DEF,
  nodemcu: NODEMCU_DEF,
  pico: PICO_DEF,
};

export function getBoardDefinition(boardId: string): BoardDefinition {
  return BOARD_DEFINITIONS[boardId] ?? UNO_DEF;
}

export function boardPinById(board: BoardDefinition, pinId: string): BoardPin | undefined {
  return board.pins.find((p) => p.id === pinId);
}

/** Pin board terdekat dari titik lokal (x, z) — untuk plane interaksi stage. */
export function boardPinAtLocal(
  board: BoardDefinition,
  x: number,
  z: number,
): BoardPin | null {
  let best: BoardPin | null = null;
  let bestDist = 0.95;
  for (const p of board.pins) {
    const dist = Math.hypot(p.local[0] - x, p.local[2] - z);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

export function boardPinWorldPosition(
  board: BoardDefinition,
  pinId: string,
): [number, number, number] | null {
  const p = boardPinById(board, pinId);
  if (!p) return null;
  return [
    board.origin[0] + p.local[0],
    board.origin[1] + p.local[1],
    board.origin[2] + p.local[2],
  ];
}
