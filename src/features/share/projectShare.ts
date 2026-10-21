import LZString from 'lz-string';
import type { ComponentInstanceState } from '../../shared/types';
import type { WireConnection } from '../wiring/netlist';

/**
 * Serialisasi proyek (ROADMAP Batch 4): seluruh rangkaian + sketch
 * menjadi satu objek yang bisa dibagikan sebagai tautan (lz-string
 * di hash URL) atau berkas .rangkai (JSON). simState tidak ikut —
 * hasil simulasi selalu dihitung ulang di sisi penerima.
 */

export interface SharedProject {
  v: 1;
  boardId: string;
  instances: Array<{
    id: string;
    type: string;
    position: [number, number, number];
    rotation: number;
    props: Record<string, unknown>;
    interactiveState: Record<string, unknown>;
  }>;
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  sketchCode: string;
}

export function toSharedProject(args: {
  boardId: string;
  instances: ComponentInstanceState[];
  pinHoles: Record<string, Record<string, string>>;
  wires: WireConnection[];
  sketchCode: string;
}): SharedProject {
  return {
    v: 1,
    boardId: args.boardId,
    instances: args.instances.map((i) => ({
      id: i.id,
      type: i.type,
      position: i.position,
      rotation: i.rotation,
      props: i.props,
      interactiveState: i.interactiveState,
    })),
    pinHoles: args.pinHoles,
    wires: args.wires,
    sketchCode: args.sketchCode,
  };
}

function isSharedProject(value: unknown): value is SharedProject {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Partial<SharedProject>;
  return (
    p.v === 1 &&
    typeof p.boardId === 'string' &&
    Array.isArray(p.instances) &&
    typeof p.pinHoles === 'object' &&
    p.pinHoles !== null &&
    Array.isArray(p.wires) &&
    typeof p.sketchCode === 'string'
  );
}

export function projectToHash(project: SharedProject): string {
  const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(project));
  return `#s=${compressed}`;
}

export function projectFromHash(hash: string): SharedProject | null {
  const match = hash.match(/#s=([A-Za-z0-9\-_+/=]+)/);
  if (!match) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(match[1]);
    if (!json) return null;
    const parsed: unknown = JSON.parse(json);
    return isSharedProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function projectToFileJson(project: SharedProject): string {
  return JSON.stringify(project, null, 2);
}

export function projectFromFileJson(text: string): SharedProject | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isSharedProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
