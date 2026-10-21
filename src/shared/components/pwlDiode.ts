import type {
  ComponentElectrical,
  ComponentInstanceState,
  ComponentSimResult,
  DamageReport,
} from '../types';

/**
 * Pabrik perilaku elektrik dioda PWL dua-keadaan (pola yang sama dengan
 * LED Batch 1, digeneralisasi): OFF = resistor bocor besar;
 * ON = resistor kecil + sumber arus Norton pada tegangan maju Vf.
 * Dipakai dioda silikon, kanal LED RGB, dan segmen 7-segment.
 */

export interface PwlDiodeOptions {
  anodePin: string;
  cathodePin: string;
  vf: number;
  ronOhms: number;
  roffOhms?: number;
  /** Kunci arus cabang di branchCurrents. */
  currentKey: string;
  maxCurrentA: number;
  maxReverseV: number;
  overcurrentTitle: string;
  overcurrentExplanation: string;
  reverseTitle?: string;
  reverseExplanation?: string;
}

export function createPwlDiode(opts: PwlDiodeOptions): ComponentElectrical {
  const roff = opts.roffOhms ?? 10_000_000;
  return {
    stamp(ctx, instance) {
      const anode = ctx.netOf(instance.id, opts.anodePin);
      const cathode = ctx.netOf(instance.id, opts.cathodePin);
      const vPrev = ctx.prevVoltage(anode) - ctx.prevVoltage(cathode);
      if (vPrev >= opts.vf) {
        const g = 1 / opts.ronOhms;
        ctx.conductance(anode, cathode, g);
        ctx.current(cathode, anode, opts.vf * g);
      } else {
        ctx.conductance(anode, cathode, 1 / roff);
      }
    },
    computeCurrents(instance, voltages, netOf) {
      const va = voltages.get(netOf(instance.id, opts.anodePin)) ?? 0;
      const vc = voltages.get(netOf(instance.id, opts.cathodePin)) ?? 0;
      const v = va - vc;
      const amps = v > opts.vf ? (v - opts.vf) / opts.ronOhms : v / roff;
      return { [opts.currentKey]: amps };
    },
    checkDamage(_instance: ComponentInstanceState, result: ComponentSimResult): DamageReport | null {
      const amps = result.branchCurrents[opts.currentKey] ?? 0;
      if (amps > opts.maxCurrentA) {
        return {
          ruleId: 'DIODE_OVERCURRENT',
          titleId: opts.overcurrentTitle,
          explanationId: opts.overcurrentExplanation,
          measured: amps * 1000,
          limit: opts.maxCurrentA * 1000,
          unit: 'mA',
        };
      }
      const va = result.pinVoltages[opts.anodePin] ?? 0;
      const vc = result.pinVoltages[opts.cathodePin] ?? 0;
      if (vc - va > opts.maxReverseV && opts.reverseTitle && opts.reverseExplanation) {
        return {
          ruleId: 'DIODE_REVERSE_BREAKDOWN',
          titleId: opts.reverseTitle,
          explanationId: opts.reverseExplanation,
          measured: vc - va,
          limit: opts.maxReverseV,
          unit: 'V',
        };
      }
      return null;
    },
  };
}

/** Gabungkan beberapa perilaku elektrik menjadi satu (multi-kanal). */
export function combineElectrical(parts: ComponentElectrical[]): ComponentElectrical {
  return {
    stamp(ctx, instance, dt) {
      for (const part of parts) part.stamp(ctx, instance, dt);
    },
    computeCurrents(instance, voltages, netOf) {
      const out: Record<string, number> = {};
      for (const part of parts) Object.assign(out, part.computeCurrents(instance, voltages, netOf));
      return out;
    },
    checkDamage(instance, result) {
      for (const part of parts) {
        const report = part.checkDamage(instance, result);
        if (report) return report;
      }
      return null;
    },
  };
}
