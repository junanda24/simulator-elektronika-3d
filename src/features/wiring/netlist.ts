import type {
  CircuitInput,
  ComponentInstanceState,
  PinState,
  ResistiveLink,
  TheveninSource,
} from '../../shared/types';
import { getComponentMeta } from '../../shared/components/catalogMeta';
import { holeNetKey } from '../../shared/boards/breadboard';
import {
  boardPinById,
  getBoardDefinition,
  type BoardDefinition,
} from '../../shared/boards/definitions';

const UNO_DEF = getBoardDefinition('uno');

/** Resistansi bleed high-Z pin mode INPUT ke GND (Ω) — lihat buildNetlist. */
export const INPUT_BLEED_OHMS = 10_000_000;

/**
 * Ujung kabel: lubang breadboard, pin board, atau terminal komponen
 * terminal-bebas (komponen yang tidak menancap ke lubang — baterai 9V;
 * lihat FREE_PLACEMENT_TYPES di placement.ts). Pin board adalah
 * preseden terminal non-lubang; terminal komponen memperluas pola yang
 * sama ke pin instance: net dasarnya `pin:<instanceId>:<pinId>`, persis
 * net yang diterima pin komponen tanpa lubang di buildNetlist, jadi
 * kabel berujung 'component' bergabung ke net pin itu sendiri.
 */
export type TerminalRef =
  | { kind: 'hole'; holeId: string }
  | { kind: 'board'; pinId: string }
  | { kind: 'component'; instanceId: string; pinId: string };

export interface WireConnection {
  id: string;
  a: TerminalRef;
  b: TerminalRef;
  color: string;
}

/** Net bawaan sebuah terminal sebelum digabung kabel. */
export function terminalBaseNet(ref: TerminalRef, board: BoardDefinition = UNO_DEF): string {
  if (ref.kind === 'hole') return holeNetKey(ref.holeId) ?? `hole:${ref.holeId}`;
  if (ref.kind === 'component') return `pin:${ref.instanceId}:${ref.pinId}`;
  const pin = boardPinById(board, ref.pinId);
  return `board:${pin ? pin.net : ref.pinId}`;
}

export function terminalLabel(
  ref: TerminalRef,
  board: BoardDefinition = UNO_DEF,
  instances: ComponentInstanceState[] = [],
): string {
  if (ref.kind === 'board') {
    return `${board.name} ${boardPinById(board, ref.pinId)?.label ?? ref.pinId}`;
  }
  if (ref.kind === 'component') {
    // Label manusiawi bila instance-nya dikenal pemanggil: nama
    // komponen + label pin meta ("Baterai 9V (6LR61) Terminal + …").
    const instance = instances.find((i) => i.id === ref.instanceId);
    const meta = instance ? getComponentMeta(instance.type) : undefined;
    const pin = meta?.pins.find((p) => p.id === ref.pinId);
    if (meta && pin) return `${meta.name} ${pin.label}`;
    return `Terminal ${ref.pinId}`;
  }
  return ref.holeId;
}

/** Union-Find sederhana untuk penggabungan net oleh kabel. */
export class UnionFind {
  private parent = new Map<string, string>();

  find(key: string): string {
    let root = key;
    while (this.parent.get(root) !== undefined && this.parent.get(root) !== root) {
      root = this.parent.get(root) as string;
    }
    // Path compression
    let current = key;
    while (this.parent.get(current) !== undefined && this.parent.get(current) !== current) {
      const next = this.parent.get(current) as string;
      this.parent.set(current, root);
      current = next;
    }
    if (!this.parent.has(key)) this.parent.set(key, key);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }

  /** Nama kanonis: set yang berisi board GND selalu bernama 'GND'. */
  canonical(key: string, members: Set<string>): string {
    void key;
    if (members.has('board:GND')) return 'GND';
    return [...members].sort()[0];
  }
}

export interface NetlistResult {
  input: CircuitInput;
  /** Peta nama net kanonis per terminal (untuk probe & debug). */
  netOfTerminal: (ref: TerminalRef) => string;
  netOfPin: (instanceId: string, pinId: string) => string | null;
  /** Nama net kanonis sebuah pin board (untuk runtime & aturan board). */
  netOfBoardPin: (pinId: string) => string;
  /** Terisi bila rail daya board tergabung langsung ke GND (korsleting). */
  shortCircuit: { volts: number } | null;
}

/**
 * Bangun CircuitInput untuk solver dari state rangkaian:
 * gabungkan net bawaan (strip/rail/board) memakai kabel (union-find),
 * namai set berisi GND board sebagai 'GND', dan suntikkan sumber
 * Thevenin untuk rail 5V (5 V / 1 Ω) & 3V3 (3,3 V / 1 Ω) board.
 * Sumber yang net-nya korslet ke GND dibuang (rail runtuh ke 0 V;
 * aturan kerusakan POWER_SHORT_CIRCUIT menyusul di Batch 2).
 */
export function buildNetlist(
  instances: ComponentInstanceState[],
  pinHoles: Record<string, Record<string, string>>,
  wires: WireConnection[],
  pinStates: Record<string, PinState> = {},
  board: BoardDefinition = UNO_DEF,
): NetlistResult {
  const profile = board.profile;
  const baseNet = (ref: TerminalRef) => terminalBaseNet(ref, board);
  const uf = new UnionFind();
  const membersOf = new Map<string, Set<string>>();

  const register = (baseNet: string) => {
    const root = uf.find(baseNet);
    if (!membersOf.has(root)) membersOf.set(root, new Set());
    membersOf.get(root)?.add(baseNet);
  };

  // Kumpulkan semua net bawaan
  for (const wire of wires) {
    register(baseNet(wire.a));
    register(baseNet(wire.b));
  }
  for (const instance of instances) {
    const plugin = getComponentMeta(instance.type);
    if (!plugin) continue;
    for (const pin of plugin.pins) {
      const holeId = pinHoles[instance.id]?.[pin.id];
      if (holeId) register(holeNetKey(holeId) ?? `hole:${holeId}`);
      // Pin tanpa lubang (komponen terminal-bebas): net pin-nya sendiri —
      // nama yang sama dengan net dasar TerminalRef 'component', jadi
      // kabel yang diklik ke terminal itu bergabung tepat ke net ini.
      else register(`pin:${instance.id}:${pin.id}`);
    }
  }
  // Semua pin board terdaftar: pin tak berkabel tetap net sendiri (mengambang)
  for (const pin of board.pins) {
    register(`board:${pin.net}`);
  }

  // Gabung via kabel, lalu hitung ulang keanggotaan per root final
  for (const wire of wires) {
    uf.union(baseNet(wire.a), baseNet(wire.b));
  }
  const finalMembers = new Map<string, Set<string>>();
  for (const set of membersOf.values()) {
    for (const member of set) {
      const root = uf.find(member);
      if (!finalMembers.has(root)) finalMembers.set(root, new Set());
      finalMembers.get(root)?.add(member);
    }
  }
  const canonicalName = (baseNet: string): string => {
    const root = uf.find(baseNet);
    const members = finalMembers.get(root) ?? new Set([baseNet]);
    return uf.canonical(root, members);
  };

  // pinNets untuk solver
  const pinNets: Record<string, string> = {};
  for (const instance of instances) {
    const plugin = getComponentMeta(instance.type);
    if (!plugin) continue;
    for (const pin of plugin.pins) {
      const holeId = pinHoles[instance.id]?.[pin.id];
      const base = holeId ? (holeNetKey(holeId) ?? `hole:${holeId}`) : `pin:${instance.id}:${pin.id}`;
      pinNets[`${instance.id}:${pin.id}`] = canonicalName(base);
    }
  }

  // Sumber tegangan board pada net gabungan tiap rel daya definisi board.
  // Dua rel tergabung dalam satu net: tegangan tertinggi menang.
  const sources: TheveninSource[] = [];
  const railVoltsByNet = new Map<string, number>();
  let shortVolts: number | null = null;
  for (const rail of board.powerRails) {
    const net = canonicalName(`board:${rail.net}`);
    if (net === 'GND') {
      shortVolts = Math.max(shortVolts ?? 0, rail.volts);
    } else {
      railVoltsByNet.set(net, Math.max(railVoltsByNet.get(net) ?? 0, rail.volts));
    }
  }
  for (const [net, volts] of railVoltsByNet) {
    sources.push({ net, volts, seriesOhms: 1 });
  }
  // Korsleting: ada rel daya yang tergabung langsung ke GND.
  const shortCircuit = shortVolts !== null ? { volts: shortVolts } : null;

  // --- State pin GPIO dari sketch → sumber Thevenin / tautan resistif ---
  // OUTPUT: Thevenin logicVolts/0 lewat pinOhms profil.
  // INPUT_PULLUP: resistor internal profil (pullupOhms) ke rel logika —
  //   pin diam di HIGH dan sakelar ke GND menariknya ke LOW (inti pola
  //   push button; terverifikasi audit P3: lepas ≈ 5,00 V, tekan ≈ 0 V).
  // INPUT_PULLDOWN: resistor profil yang sama ke GND (mode belum ada di
  //   tipe PinMode/runtime — ditangani defensif agar kontrak netlist
  //   lengkap begitu runtime memancarkannya).
  // INPUT murni: bleed high-Z 10 MΩ ke GND. Tanpa jangkar eksplisit ini
  //   tegangan net pin hanya ditentukan gmin solver (1 GΩ) — terlalu
  //   lemah dan tidak terdokumentasi; 10 MΩ meniru impedansi input
  //   mikrokontroler dan bebannya dapat diabaikan (≤ 0,5 µA pada 5 V,
  //   galat ≤ 0,1 % pada sumber 10 kΩ).
  const links: ResistiveLink[] = [];
  const vccNet = canonicalName(`board:${board.logicRailNet}`);
  for (const [pinId, state] of Object.entries(pinStates)) {
    const net = canonicalName(`board:${boardPinById(board, pinId)?.net ?? pinId}`);
    const mode: string = state.mode;
    if (mode === 'OUTPUT') {
      if (net === 'GND') continue; // arusnya dinilai aturan board dari tegangan target
      const volts =
        state.pwm !== undefined
          ? (profile.logicVolts * state.pwm) / 255
          : state.high
            ? profile.logicVolts
            : 0;
      sources.push({ net, volts, seriesOhms: profile.pinOhms });
    } else if (mode === 'INPUT_PULLUP') {
      if (net !== vccNet && net !== 'GND') {
        links.push({ a: net, b: vccNet, ohms: profile.pullupOhms });
      }
    } else if (mode === 'INPUT_PULLDOWN') {
      if (net !== 'GND') {
        links.push({ a: net, b: 'GND', ohms: profile.pullupOhms });
      }
    } else if (mode === 'INPUT') {
      if (net !== 'GND') {
        links.push({ a: net, b: 'GND', ohms: INPUT_BLEED_OHMS });
      }
    }
  }

  return {
    input: { instances, pinNets, sources, links },
    shortCircuit,
    netOfBoardPin: (pinId) =>
      canonicalName(`board:${boardPinById(board, pinId)?.net ?? pinId}`),
    netOfTerminal: (ref) => canonicalName(baseNet(ref)),
    netOfPin: (instanceId, pinId) => pinNets[`${instanceId}:${pinId}`] ?? null,
  };
}
