import { holeWorldPosition } from '../../shared/boards/breadboard';
import {
  boardPinWorldPosition,
  getBoardDefinition,
  type BoardDefinition,
} from '../../shared/boards/definitions';
import type { TerminalRef } from './netlist';

const UNO_DEF = getBoardDefinition('uno');

/** Posisi dunia titik colok sebuah terminal (untuk render kabel & marker). */
export function terminalWorldPosition(
  ref: TerminalRef,
  board: BoardDefinition = UNO_DEF,
): [number, number, number] | null {
  if (ref.kind === 'hole') return holeWorldPosition(ref.holeId);
  const pos = boardPinWorldPosition(board, ref.pinId);
  if (!pos) return null;
  return [pos[0], pos[1] + 0.55, pos[2]];
}
