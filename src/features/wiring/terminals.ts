import { holeWorldPosition } from '../../shared/boards/breadboard';
import {
  boardPinWorldPosition,
  getBoardDefinition,
  type BoardDefinition,
} from '../../shared/boards/definitions';
import { getComponentMeta } from '../../shared/components/catalogMeta';
import type { ComponentInstanceState } from '../../shared/types';
import type { TerminalRef } from './netlist';

const UNO_DEF = getBoardDefinition('uno');

/**
 * Posisi dunia terminal komponen terminal-bebas: posisi instance +
 * localPosition pin meta yang diputar rotation instance mengelilingi
 * sumbu Y — transform yang sama persis dengan yang dipakai model 3D
 * (group position=instance.position, rotation=[0, rotation, 0]).
 * Mengembalikan null bila instance/pin tidak dikenal.
 */
export function componentPinWorldPosition(
  instance: ComponentInstanceState,
  pinId: string,
): [number, number, number] | null {
  const pin = getComponentMeta(instance.type)?.pins.find((p) => p.id === pinId);
  if (!pin) return null;
  const [lx, ly, lz] = pin.localPosition;
  const cos = Math.cos(instance.rotation);
  const sin = Math.sin(instance.rotation);
  return [
    instance.position[0] + lx * cos + lz * sin,
    instance.position[1] + ly,
    instance.position[2] - lx * sin + lz * cos,
  ];
}

/**
 * Posisi dunia titik colok sebuah terminal (untuk render kabel & marker).
 * Terminal 'component' membutuhkan daftar instance untuk ditemukan —
 * pemanggil yang me-render kabel/marker memang sudah berlangganan
 * instance dari store.
 */
export function terminalWorldPosition(
  ref: TerminalRef,
  board: BoardDefinition = UNO_DEF,
  instances: ComponentInstanceState[] = [],
): [number, number, number] | null {
  if (ref.kind === 'hole') return holeWorldPosition(ref.holeId);
  if (ref.kind === 'component') {
    const instance = instances.find((i) => i.id === ref.instanceId);
    return instance ? componentPinWorldPosition(instance, ref.pinId) : null;
  }
  const pos = boardPinWorldPosition(board, ref.pinId);
  if (!pos) return null;
  return [pos[0], pos[1] + 0.55, pos[2]];
}
