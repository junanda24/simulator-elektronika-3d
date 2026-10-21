import { describe, expect, it } from 'vitest';
import {
  EMPTY_SIM_RESULT,
  type ComponentInstanceState,
} from '../../../../types';
import { solveCircuit } from '../../../../../features/simulation/solver/engine';
import { ky003Electrical, magnetNearOf } from '../electrical';
import { KY003_META } from '../meta';

function instance(
  interactiveState: Record<string, unknown> = {},
): ComponentInstanceState {
  return {
    id: 'hall1',
    type: 'ky-003',
    position: [0, 0, 0],
    rotation: 0,
    props: {},
    interactiveState,
    simState: { ...EMPTY_SIM_RESULT },
  };
}

const lookup = (type: string) =>
  type === 'ky-003' ? ky003Electrical : undefined;

const pinNets = { 'hall1:GND': 'GND', 'hall1:VCC': 'vcc', 'hall1:S': 's' };
// Pull-up 20 kΩ dari S ke rel catu — meniru INPUT_PULLUP pembaca.
const pullup = [{ a: 's', b: 'vcc', ohms: 20000 }];

function sVolts(
  interactiveState: Record<string, unknown>,
  supplyVolts: number,
  withPullup = true,
): number {
  const sol = solveCircuit(
    {
      instances: [instance(interactiveState)],
      pinNets,
      sources: [{ net: 'vcc', volts: supplyVolts, seriesOhms: 1 }],
      links: withPullup ? pullup : [],
    },
    lookup,
  );
  return sol.voltages.get('s') ?? 0;
}

describe('KY-003 — meta & state magnet', () => {
  it('urutan pin modul − / + / S (GND-VCC-S) pada z = −1/0/+1', () => {
    expect(KY003_META.pins.map((p) => p.id)).toEqual(['GND', 'VCC', 'S']);
    expect(KY003_META.pins.map((p) => p.localPosition)).toEqual([
      [0, 0, -1],
      [0, 0, 0],
      [0, 0, 1],
    ]);
    expect(magnetNearOf(instance())).toBe(false);
    expect(magnetNearOf(instance({ magnet: true }))).toBe(true);
  });
});

describe('KY-003 — open-collector lewat solver', () => {
  it('tanpa magnet + INPUT_PULLUP: S HIGH ≈ catu (S tidak di-stamp)', () => {
    expect(sVolts({}, 5)).toBeGreaterThan(4.8);
  });

  it('tanpa magnet TANPA pull-up: S melayang ke ≈0 V (pelajaran open-collector)', () => {
    expect(Math.abs(sVolts({}, 5, false))).toBeLessThan(0.01);
  });

  it('magnet dekat + catu 5 V: S ditarik LOW ≈ 0 V lewat 25 Ω', () => {
    expect(sVolts({ magnet: true }, 5)).toBeLessThan(0.05);
  });

  it('magnet dekat tetapi catu 3,3 V (di bawah rating 4,5 V): saklar tidak beroperasi, S tetap HIGH oleh pull-up', () => {
    expect(sVolts({ magnet: true }, 3.3)).toBeGreaterThan(3.1);
  });

  it('computeCurrents: arus S hanya mengalir saat keluaran aktif', () => {
    const inst = instance({ magnet: true });
    const sol = solveCircuit(
      {
        instances: [inst],
        pinNets,
        sources: [{ net: 'vcc', volts: 5, seriesOhms: 1 }],
        links: pullup,
      },
      lookup,
    );
    const currents = ky003Electrical.computeCurrents(
      inst,
      sol.voltages,
      (id, pin) => pinNets[`${id}:${pin}` as keyof typeof pinNets] ?? `${id}:${pin}`,
    );
    // Arus pull-up 5 V/20 kΩ ≈ 0,25 mA tenggelam ke transistor keluaran.
    expect(currents.s).toBeGreaterThan(0.0001);
    expect(currents.s).toBeLessThan(0.001);
  });

  it('tidak ada aturan kerusakan khusus', () => {
    expect(
      ky003Electrical.checkDamage(instance(), {
        ...EMPTY_SIM_RESULT,
        pinVoltages: { VCC: 24, GND: 0, S: 0 },
        branchCurrents: { s: 1 },
      }),
    ).toBeNull();
  });
});
