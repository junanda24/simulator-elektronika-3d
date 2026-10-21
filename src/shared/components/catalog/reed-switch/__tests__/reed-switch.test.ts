import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../../types';
import { solveCircuit } from '../../../../../features/simulation/solver/engine';
import { magnetNearOf, reedSwitchElectrical } from '../electrical';
import { REED_SWITCH_META } from '../meta';

function instance(
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id: 'reed1',
    type: 'reed-switch',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const lookup = (type: string) =>
  type === 'reed-switch' ? reedSwitchElectrical : undefined;

// A pada sumber 5 V (seri 10 Ω), B pada net keluaran.
const pinNets = { 'reed1:A': 'in', 'reed1:B': 'out' };
const sources = [{ net: 'in', volts: 5, seriesOhms: 10 }];

describe('Reed Switch — meta & state magnet', () => {
  it('pin aksial A/B pada x = ∓3, kategori input', () => {
    expect(REED_SWITCH_META.pins.map((p) => p.localPosition)).toEqual([
      [-3, 0, 0],
      [3, 0, 0],
    ]);
    expect(magnetNearOf(instance())).toBe(false);
    expect(magnetNearOf(instance({ magnet: true }))).toBe(true);
  });
});

describe('Reed Switch — kontak bermagnet lewat solver', () => {
  it('tanpa magnet: kontak terbuka — net out ditahan beban 10 kΩ ke GND di ≈0 V', () => {
    // Beban pull-down 10 kΩ pada out: bocor kontak terbuka 10 MΩ hanya
    // mengangkatnya ±5 mV. (Tanpa beban apa pun, net out memang
    // melayang mengikuti bocor 10 MΩ — perilaku fisik yang benar.)
    const sol = solveCircuit(
      {
        instances: [instance()],
        pinNets,
        sources: [...sources, { net: 'out', volts: 0, seriesOhms: 10000 }],
      },
      lookup,
    );
    expect(Math.abs(sol.voltages.get('out') ?? 0)).toBeLessThan(0.01);
  });

  it('magnet dekat: kontak menutup 0,1 Ω, net out ≈ 5 V', () => {
    const sol = solveCircuit(
      { instances: [instance({ magnet: true })], pinNets, sources },
      lookup,
    );
    // 5 V dibagi seri 10 Ω + kontak 0,1 Ω → out ≈ 4,95 V.
    expect(sol.voltages.get('out') ?? 0).toBeGreaterThan(4.9);
  });
});

describe('Reed Switch — kerusakan kontak lengket (REED_CONTACT_WELD)', () => {
  it('arus kontak 1 A memicu laporan weld', () => {
    const report = reedSwitchElectrical.checkDamage(instance(), {
      ...EMPTY_SIM_RESULT,
      branchCurrents: { main: 1 },
    });
    expect(report?.ruleId).toBe('REED_CONTACT_WELD');
    expect(report?.limit).toBe(500);
    expect(report?.unit).toBe('mA');
  });

  it('arus sinyal kecil (10 mA) aman', () => {
    expect(
      reedSwitchElectrical.checkDamage(instance(), {
        ...EMPTY_SIM_RESULT,
        branchCurrents: { main: 0.01 },
      }),
    ).toBeNull();
  });

  it('skenario nyata: kontak menutup antara rel 5 V dan beban 2 Ω ke GND → arus > 0,5 A → weld', () => {
    const inst = instance({ magnet: true });
    const sol = solveCircuit(
      {
        instances: [inst],
        pinNets,
        sources: [
          { net: 'in', volts: 5, seriesOhms: 2 },
          { net: 'out', volts: 0, seriesOhms: 2 },
        ],
      },
      lookup,
    );
    const currents = reedSwitchElectrical.computeCurrents(
      inst,
      sol.voltages,
      (id, pin) => pinNets[`${id}:${pin}` as keyof typeof pinNets] ?? `${id}:${pin}`,
    );
    expect(Math.abs(currents.main)).toBeGreaterThan(0.5);
    const report = reedSwitchElectrical.checkDamage(inst, {
      ...EMPTY_SIM_RESULT,
      branchCurrents: currents,
    });
    expect(report?.ruleId).toBe('REED_CONTACT_WELD');
  });
});
