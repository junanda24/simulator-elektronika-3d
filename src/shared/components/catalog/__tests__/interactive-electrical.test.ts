import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../types';
import { solveCircuit } from '../../../../features/simulation/solver/engine';
import { electricalOf } from '../../../components/electricalRegistry';
import { getComponentPlugin } from '../../../components/registry';

function instance(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: 0,
    props,
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

describe('Registry — komponen interaktif Batch 2', () => {
  it('push-button & potentiometer terdaftar di registry plugin dan elektrik', () => {
    const button = getComponentPlugin('push-button');
    expect(button?.type).toBe('push-button');
    expect(button?.name).toBe('Push Button (Tactile)');
    expect(button?.category).toBe('input');
    expect(button?.pins.map((p) => p.id)).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(electricalOf('push-button')).toBeDefined();

    const pot = getComponentPlugin('potentiometer');
    expect(pot?.type).toBe('potentiometer');
    expect(pot?.name).toBe('Potensiometer 10k');
    expect(pot?.defaultProps).toEqual({ value: 10000 });
    expect(pot?.pins.map((p) => p.id)).toEqual(['A', 'WIPER', 'B']);
    expect(electricalOf('potentiometer')).toBeDefined();
  });
});

describe('Push Button — jembatan kontak', () => {
  // A1 pada net sumber 5 V; A2 net sendiri (menguji jembatan permanen se-sisi);
  // B1 & B2 pada net 'out'.
  const pinNets = {
    'btn1:A1': 'in',
    'btn1:A2': 'a2',
    'btn1:B1': 'out',
    'btn1:B2': 'out',
  };
  const sources = [{ net: 'in', volts: 5, seriesOhms: 1 }];

  it('tidak ditekan: sisi B terpisah dari sisi A (≈0 V), pasangan se-sisi tetap terhubung', () => {
    const solution = solveCircuit(
      { instances: [instance('btn1', 'push-button')], pinNets, sources },
      electricalOf,
    );
    expect(solution.voltages.get('in') ?? 0).toBeGreaterThan(4.9);
    // Jembatan permanen A1–A2: net a2 ikut naik ke ≈5 V tanpa ditekan.
    expect(solution.voltages.get('a2') ?? 0).toBeGreaterThan(4.9);
    // Sisi B mengambang: hanya dijangkar gmin → ≈0 V.
    expect(Math.abs(solution.voltages.get('out') ?? 0)).toBeLessThan(0.01);
  });

  it('ditekan: tegangan net B ≈ 5 V (jembatan A–B tertutup)', () => {
    const solution = solveCircuit(
      {
        instances: [instance('btn1', 'push-button', {}, { pressed: true })],
        pinNets,
        sources,
      },
      electricalOf,
    );
    expect(solution.voltages.get('out') ?? 0).toBeGreaterThan(4.9);
  });
});

describe('Potensiometer — pembagi tegangan', () => {
  const pinNets = {
    'pot1:A': 'V5',
    'pot1:WIPER': 'W',
    'pot1:B': 'GND',
  };
  const sources = [{ net: 'V5', volts: 5, seriesOhms: 1 }];

  it('alpha 0.25 → tegangan wiper ≈ 3,75 V', () => {
    const solution = solveCircuit(
      {
        instances: [instance('pot1', 'potentiometer', { value: 10000 }, { alpha: 0.25 })],
        pinNets,
        sources,
      },
      electricalOf,
    );
    // Hitungan tangan: V_W = 5 · R(W–B) / (R(A–W) + R(W–B))
    // = 5 · 7500 / (2500 + 7500) = 3,75 V (resistansi seri sumber 1 Ω diabaikan).
    expect(Math.abs((solution.voltages.get('W') ?? 0) - 3.75)).toBeLessThan(0.05);
  });

  it('alpha 0.5 → tegangan wiper ≈ 2,5 V dan arus main ≈ 0,5 mA', () => {
    const solution = solveCircuit(
      {
        instances: [instance('pot1', 'potentiometer', { value: 10000 }, { alpha: 0.5 })],
        pinNets,
        sources,
      },
      electricalOf,
    );
    expect(Math.abs((solution.voltages.get('W') ?? 0) - 2.5)).toBeLessThan(0.05);
    const main = solution.results.get('pot1')?.branchCurrents.main ?? 0;
    // I = 5 V / (1 Ω + 10 kΩ) ≈ 0,49995 mA
    expect(main).toBeGreaterThan(0.0004);
    expect(main).toBeLessThan(0.0006);
  });

  it('tanpa alpha di interactiveState → default 0.5 → wiper ≈ 2,5 V', () => {
    const solution = solveCircuit(
      {
        instances: [instance('pot1', 'potentiometer', { value: 10000 })],
        pinNets,
        sources,
      },
      electricalOf,
    );
    expect(Math.abs((solution.voltages.get('W') ?? 0) - 2.5)).toBeLessThan(0.05);
  });
});
