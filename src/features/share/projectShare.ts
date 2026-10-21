import LZString from 'lz-string';
import type { ComponentInstanceState } from '../../shared/types';
import type { TerminalRef, WireConnection } from '../wiring/netlist';
import { BOARD_DEFINITIONS } from '../../shared/boards/definitions';
import { getComponentMeta } from '../../shared/components/catalogMeta';

/**
 * Serialisasi proyek (ROADMAP Batch 4): seluruh rangkaian + sketch
 * menjadi satu objek yang bisa dibagikan sebagai tautan (lz-string
 * di hash URL) atau berkas .rangkai (JSON). simState tidak ikut —
 * hasil simulasi selalu dihitung ulang di sisi penerima.
 *
 * VALIDASI (self-healing SH-1): data dari luar — hash tautan, berkas
 * impor, dan autosave sesi — TIDAK pernah dipercaya mentah. Semua
 * pintu masuk melewati validateSharedProject yang memeriksa bentuk
 * secara mendalam (versi dikenal, board terdaftar, setiap tipe
 * komponen ada di katalog, terminal kabel masuk akal). Data gagal
 * validasi ditolak utuh (null), tidak pernah diterapkan sebagian.
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

export type ProjectValidation =
  | { ok: true; project: SharedProject }
  | { ok: false; reason: string };

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidTerminalRef(
  value: unknown,
  instanceIds: ReadonlySet<string>,
): value is TerminalRef {
  if (!isPlainRecord(value)) return false;
  if (value.kind === 'hole') {
    return typeof value.holeId === 'string' && value.holeId.length > 0;
  }
  if (value.kind === 'board') {
    return typeof value.pinId === 'string' && value.pinId.length > 0;
  }
  if (value.kind === 'component') {
    return (
      typeof value.instanceId === 'string' &&
      instanceIds.has(value.instanceId) &&
      typeof value.pinId === 'string' &&
      value.pinId.length > 0
    );
  }
  return false;
}

/**
 * Validasi mendalam satu proyek dari sumber luar. Mengembalikan
 * alasan kegagalan spesifik (Bahasa Indonesia) agar pemanggil bisa
 * mencatat/mengarantina dengan konteks — bukan sekadar "invalid".
 */
export function validateSharedProject(value: unknown): ProjectValidation {
  if (!isPlainRecord(value)) {
    return { ok: false, reason: 'data bukan objek proyek' };
  }
  const p = value as Partial<SharedProject> & Record<string, unknown>;
  if (p.v !== 1) {
    return {
      ok: false,
      reason: `versi proyek tidak dikenal: ${JSON.stringify(p.v ?? null)}`,
    };
  }
  if (typeof p.boardId !== 'string' || !(p.boardId in BOARD_DEFINITIONS)) {
    return { ok: false, reason: `board tidak dikenal: ${JSON.stringify(p.boardId ?? null)}` };
  }
  if (!Array.isArray(p.instances)) {
    return { ok: false, reason: 'daftar komponen bukan array' };
  }
  const instanceIds = new Set<string>();
  for (const raw of p.instances) {
    if (!isPlainRecord(raw)) {
      return { ok: false, reason: 'ada komponen yang bukan objek' };
    }
    const inst = raw as Record<string, unknown>;
    if (typeof inst.id !== 'string' || inst.id.length === 0) {
      return { ok: false, reason: 'ada komponen tanpa id yang sah' };
    }
    if (typeof inst.type !== 'string' || !getComponentMeta(inst.type)) {
      return {
        ok: false,
        reason: `tipe komponen tidak ada di katalog: ${JSON.stringify(inst.type ?? null)}`,
      };
    }
    if (
      !Array.isArray(inst.position) ||
      inst.position.length !== 3 ||
      !inst.position.every(isFiniteNumber)
    ) {
      return { ok: false, reason: `posisi komponen ${inst.id} tidak sah` };
    }
    if (!isFiniteNumber(inst.rotation)) {
      return { ok: false, reason: `rotasi komponen ${inst.id} tidak sah` };
    }
    if (!isPlainRecord(inst.props)) {
      return { ok: false, reason: `props komponen ${inst.id} tidak sah` };
    }
    if (inst.interactiveState !== undefined && !isPlainRecord(inst.interactiveState)) {
      return { ok: false, reason: `keadaan interaktif komponen ${inst.id} tidak sah` };
    }
    instanceIds.add(inst.id);
  }
  if (!isPlainRecord(p.pinHoles)) {
    return { ok: false, reason: 'peta pin-lubang tidak sah' };
  }
  for (const [instanceId, holes] of Object.entries(p.pinHoles)) {
    if (!instanceIds.has(instanceId)) {
      return { ok: false, reason: `peta pin-lubang menunjuk komponen tak dikenal: ${instanceId}` };
    }
    if (!isPlainRecord(holes) || !Object.values(holes).every((h) => typeof h === 'string')) {
      return { ok: false, reason: `peta pin-lubang komponen ${instanceId} tidak sah` };
    }
  }
  if (!Array.isArray(p.wires)) {
    return { ok: false, reason: 'daftar kabel bukan array' };
  }
  for (const raw of p.wires) {
    if (!isPlainRecord(raw)) {
      return { ok: false, reason: 'ada kabel yang bukan objek' };
    }
    const wire = raw as Record<string, unknown>;
    if (
      typeof wire.id !== 'string' ||
      wire.id.length === 0 ||
      typeof wire.color !== 'string' ||
      !isValidTerminalRef(wire.a, instanceIds) ||
      !isValidTerminalRef(wire.b, instanceIds)
    ) {
      return { ok: false, reason: `kabel tidak sah: ${JSON.stringify(wire.id ?? null)}` };
    }
  }
  if (typeof p.sketchCode !== 'string') {
    return { ok: false, reason: 'kode sketch bukan teks' };
  }
  return { ok: true, project: value as unknown as SharedProject };
}

function isSharedProject(value: unknown): value is SharedProject {
  return validateSharedProject(value).ok;
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
