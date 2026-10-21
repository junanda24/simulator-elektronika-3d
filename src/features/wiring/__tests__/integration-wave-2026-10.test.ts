import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeFreePlacement,
  computePlacement,
  isFreePlacementType,
} from '../placement';
import { buildNetlist, type TerminalRef } from '../netlist';
import { useCircuitStore } from '../store/circuitStore';
import { solveCircuit } from '../../simulation/solver/engine';
import { electricalOf } from '../../../shared/components/electricalRegistry';
import { terminalHoleId } from '../../../shared/boards/breadboard';

/**
 * Tes integrasi gelombang ekspansi katalog 2026-10-21:
 * - pola penempatan baru (reed-switch aksial, bar graph DIP);
 * - pola TERMINAL-BEBAS baterai 9V: penempatan di alas, penolakan
 *   zona terlarang & tumpang tindih, dan kabel berujung 'component'
 *   yang benar-benar menghantar (paket klasik baterai → L7805 → rel
 *   5 V, plus aturan BATTERY_SHORT lewat solver nyata);
 * - alur store: placeFreeAt + clickTerminal + removeInstance.
 */

const componentRef = (instanceId: string, pinId: string): TerminalRef => ({
  kind: 'component',
  instanceId,
  pinId,
});
const holeRef = (holeId: string): TerminalRef => ({ kind: 'hole', holeId });

function resetStore() {
  useCircuitStore.setState({
    instances: [],
    pinHoles: {},
    wires: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    placingType: null,
    pendingFrom: null,
    placementRotation: 0,
    wireCursorPos: null,
    isDragging3D: false,
    toolMode: 'build',
    selectedInstanceId: null,
    selectedWireId: null,
    autopsy: null,
  });
}

beforeEach(resetStore);

describe('computePlacement — pola gelombang ekspansi', () => {
  it('reed-switch: pola resistor aksial — B enam baris di atas A, rotasi render π/2', () => {
    const anchor = terminalHoleId('L', 30, 0);
    const p = computePlacement('reed-switch', anchor, new Set());
    expect(p?.pinHoles.A).toBe(anchor);
    expect(p?.pinHoles.B).toBe(terminalHoleId('L', 24, 0));
    expect(p?.instance.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('led-bar-graph: klik sah hanya di bank L kolom 4; anoda di L, katoda menyeberang ke R kolom 0', () => {
    expect(computePlacement('led-bar-graph', terminalHoleId('L', 30, 3), new Set())).toBeNull();
    expect(computePlacement('led-bar-graph', terminalHoleId('R', 30, 0), new Set())).toBeNull();
    const p = computePlacement('led-bar-graph', terminalHoleId('L', 30, 4), new Set());
    expect(p).not.toBeNull();
    expect(p?.pinHoles.A1).toBe(terminalHoleId('L', 30, 4));
    expect(p?.pinHoles.A10).toBe(terminalHoleId('L', 39, 4));
    expect(p?.pinHoles.K1).toBe(terminalHoleId('R', 30, 0));
    expect(p?.pinHoles.K10).toBe(terminalHoleId('R', 39, 0));
    // 20 lubang semuanya berbeda (20 strip independen).
    const holes = Object.values(p?.pinHoles ?? {});
    expect(new Set(holes).size).toBe(20);
  });

  it('modul 4-pin (hc-sr04): empat pin sebaris berurutan dari lubang klik', () => {
    const p = computePlacement('hc-sr04', terminalHoleId('L', 10, 1), new Set());
    expect(p?.pinHoles).toEqual({
      VCC: terminalHoleId('L', 10, 1),
      TRIG: terminalHoleId('L', 11, 1),
      ECHO: terminalHoleId('L', 12, 1),
      GND: terminalHoleId('L', 13, 1),
    });
  });

  it('mosfet & regulator-7805: kolom tunggal urutan meta (G-D-S / IN-GND-OUT)', () => {
    const m = computePlacement('mosfet', terminalHoleId('L', 10, 2), new Set());
    expect(m?.pinHoles).toEqual({
      G: terminalHoleId('L', 10, 2),
      D: terminalHoleId('L', 11, 2),
      S: terminalHoleId('L', 12, 2),
    });
    const r = computePlacement('regulator-7805', terminalHoleId('L', 10, 2), new Set());
    expect(r?.pinHoles).toEqual({
      IN: terminalHoleId('L', 10, 2),
      GND: terminalHoleId('L', 11, 2),
      OUT: terminalHoleId('L', 12, 2),
    });
  });
});

describe('computeFreePlacement — baterai 9V terminal-bebas', () => {
  it('hanya battery-9v yang terminal-bebas; jalur lubang untuknya null', () => {
    expect(isFreePlacementType('battery-9v')).toBe(true);
    expect(isFreePlacementType('resistor')).toBe(false);
    expect(computePlacement('battery-9v', terminalHoleId('L', 30, 0), new Set())).toBeNull();
    expect(computeFreePlacement('resistor', [45, 0], [], 0)).toBeNull();
  });

  it('titik bebas di alas kanan breadboard: instance di y=0, pinHoles kosong', () => {
    const p = computeFreePlacement('battery-9v', [45, -10], [], 0);
    expect(p).not.toBeNull();
    expect(p?.instance.position).toEqual([45, 0, -10]);
    expect(p?.instance.rotation).toBe(0);
    expect(p?.pinHoles).toEqual({});
  });

  it('menolak titik di atas breadboard dan di zona board', () => {
    expect(computeFreePlacement('battery-9v', [12, 0], [], 0)).toBeNull();
    expect(computeFreePlacement('battery-9v', [20, 20], [], 0)).toBeNull();
    expect(computeFreePlacement('battery-9v', [-21, 0], [], 0)).toBeNull();
    expect(computeFreePlacement('battery-9v', [-15, -5], [], 0)).toBeNull();
  });

  it('menolak di luar area kerja alas', () => {
    expect(computeFreePlacement('battery-9v', [200, 0], [], 0)).toBeNull();
    expect(computeFreePlacement('battery-9v', [45, -100], [], 0)).toBeNull();
  });

  it('menolak tumpang tindih badan baterai lain; titik cukup jauh diterima', () => {
    expect(computeFreePlacement('battery-9v', [48, 2], [[45, 0]], 0)).toBeNull();
    expect(computeFreePlacement('battery-9v', [75, 0], [[45, 0]], 0)).not.toBeNull();
  });

  it('rotasi penempatan diteruskan ke instance (90° → π/2)', () => {
    const p = computeFreePlacement('battery-9v', [45, 0], [], 90);
    expect(p?.instance.rotation).toBeCloseTo(Math.PI / 2);
  });
});

describe('Baterai → L7805 lewat kabel component (solver nyata)', () => {
  function buildPackage() {
    const battery = computeFreePlacement('battery-9v', [45, 0], [], 0);
    const regulator = computePlacement('regulator-7805', terminalHoleId('L', 10, 0), new Set());
    expect(battery).not.toBeNull();
    expect(regulator).not.toBeNull();
    const bat = battery!.instance;
    const reg = regulator!.instance;
    const pinHoles = { [bat.id]: {}, [reg.id]: regulator!.pinHoles };
    const wires = [
      {
        id: 'w-plus',
        a: componentRef(bat.id, 'PLUS'),
        b: holeRef(regulator!.pinHoles.IN),
        color: '#EF4444',
      },
      {
        id: 'w-minus',
        a: componentRef(bat.id, 'MINUS'),
        b: holeRef(regulator!.pinHoles.GND),
        color: '#1F2937',
      },
    ];
    return { bat, reg, pinHoles, wires };
  }

  it('rel keluaran regulator ≈ 5 V dari baterai 9 V yang melayang penuh', () => {
    const { bat, reg, pinHoles, wires } = buildPackage();
    const netlist = buildNetlist([bat, reg], pinHoles, wires);
    const solution = solveCircuit(netlist.input, electricalOf);
    const regResult = solution.results.get(reg.id);
    // Vout relatif terhadap pin GND regulator sendiri (Norton melayang).
    const vOut = (regResult?.pinVoltages.OUT ?? 0) - (regResult?.pinVoltages.GND ?? 0);
    expect(vOut).toBeGreaterThan(4.9);
    expect(vOut).toBeLessThan(5.1);
    expect(regResult?.isDamaged).toBe(false);
    expect(solution.results.get(bat.id)?.isDamaged).toBe(false);
    // Baterai benar-benar menyuplai arus (Iq regulator ±6 mA).
    expect(solution.results.get(bat.id)?.branchCurrents.main ?? 0).toBeGreaterThan(0.003);
  });

  it('terminal + dan − baterai di strip yang sama: BATTERY_SHORT dari solver', () => {
    const battery = computeFreePlacement('battery-9v', [45, 0], [], 0);
    const bat = battery!.instance;
    const wires = [
      { id: 'w1', a: componentRef(bat.id, 'PLUS'), b: holeRef(terminalHoleId('L', 20, 0)), color: '#000000' },
      { id: 'w2', a: componentRef(bat.id, 'MINUS'), b: holeRef(terminalHoleId('L', 20, 1)), color: '#000000' },
    ];
    const netlist = buildNetlist([bat], { [bat.id]: {} }, wires);
    const solution = solveCircuit(netlist.input, electricalOf);
    const result = solution.results.get(bat.id);
    expect(result?.branchCurrents.main ?? 0).toBeGreaterThan(1);
    expect(result?.isDamaged).toBe(true);
    expect(result?.damageReport?.ruleId).toBe('BATTERY_SHORT');
  });
});

describe('Store — placeFreeAt, wiring component, removeInstance', () => {
  it('placeFreeAt menaruh baterai; placeAt (lubang) menolaknya', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('battery-9v');
    expect(s.placeAt(terminalHoleId('L', 10, 0))).toBe(false);
    expect(useCircuitStore.getState().instances).toHaveLength(0);
    expect(s.placeFreeAt([45, 0])).toBe(true);
    const state = useCircuitStore.getState();
    expect(state.instances).toHaveLength(1);
    expect(state.instances[0].type).toBe('battery-9v');
    expect(state.pinHoles[state.instances[0].id]).toEqual({});
    expect(state.placingType).toBeNull();
  });

  it('placeFreeAt menolak titik di atas breadboard', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('battery-9v');
    expect(s.placeFreeAt([12, 0])).toBe(false);
    expect(useCircuitStore.getState().instances).toHaveLength(0);
  });

  it('klik terminal komponen → klik lubang membuat kabel; net kedua ujung sama', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('battery-9v');
    s.placeFreeAt([45, 0]);
    const bat = useCircuitStore.getState().instances[0];
    const plus = componentRef(bat.id, 'PLUS');
    const hole = holeRef(terminalHoleId('L', 15, 2));
    s.clickTerminal(plus);
    expect(useCircuitStore.getState().pendingFrom).toEqual(plus);
    s.clickTerminal(hole);
    const state = useCircuitStore.getState();
    expect(state.wires).toHaveLength(1);
    expect(state.wires[0].a).toEqual(plus);
    expect(state.netNameOf(plus)).toBe(state.netNameOf(hole));
  });

  it('removeInstance baterai menghapus kabel berujung terminalnya + pendingFrom', () => {
    const s = useCircuitStore.getState();
    s.setPlacing('battery-9v');
    s.placeFreeAt([45, 0]);
    const bat = useCircuitStore.getState().instances[0];
    s.clickTerminal(componentRef(bat.id, 'MINUS'));
    s.clickTerminal(holeRef(terminalHoleId('L', 15, 2)));
    expect(useCircuitStore.getState().wires).toHaveLength(1);
    s.clickTerminal(componentRef(bat.id, 'PLUS'));
    expect(useCircuitStore.getState().pendingFrom).not.toBeNull();
    s.removeInstance(bat.id);
    const state = useCircuitStore.getState();
    expect(state.instances).toHaveLength(0);
    expect(state.wires).toHaveLength(0);
    expect(state.pendingFrom).toBeNull();
  });
});
