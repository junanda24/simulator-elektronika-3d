import type { ComponentInstanceState, PinState } from '../../shared/types';

/**
 * Mesin assertion mode Lesson (ROADMAP Batch 4): pemeriksaan
 * terstruktur atas state rangkaian live. Murni & deterministik —
 * konteks disediakan store dari snapshot sesi + netlist terakhir.
 * Hasil tiap assertion ditempel (sticky) oleh store: sekali terpenuhi
 * selama modul aktif, tetap terpenuhi (mis. arus LED yang berkedip).
 */

export type Assertion =
  | { kind: 'board-is'; boardId: string; label: string }
  | { kind: 'component-present'; type: string; label: string }
  | {
      kind: 'branch-current';
      type: string;
      branch: string;
      minA: number;
      maxA: number;
      label: string;
    }
  | { kind: 'pin-mode'; pinId: string; mode: PinState['mode']; label: string }
  | { kind: 'pin-pwm'; pinId: string; label: string }
  | {
      kind: 'net-voltage';
      target:
        | { kind: 'board'; pinId: string }
        | { kind: 'component'; type: string; pinId: string };
      minV: number;
      maxV: number;
      label: string;
    }
  | { kind: 'serial-contains'; text: string; label: string }
  | { kind: 'serial-number-range'; min: number; max: number; label: string }
  | { kind: 'damage-occurred'; ruleId?: string; label: string };

export interface LessonContext {
  boardId: string;
  instances: ComponentInstanceState[];
  pinStates: Record<string, PinState>;
  serialText: string;
  lastDamageRuleId: string | null;
  voltageOfBoardPin: (pinId: string) => number | undefined;
  voltageOfComponentPin: (type: string, pinId: string) => number | undefined;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function evaluateAssertion(assertion: Assertion, ctx: LessonContext): boolean {
  switch (assertion.kind) {
    case 'board-is':
      return ctx.boardId === assertion.boardId;
    case 'component-present':
      return ctx.instances.some((i) => i.type === assertion.type);
    case 'branch-current': {
      return ctx.instances.some((i) => {
        if (i.type !== assertion.type) return false;
        const amps = i.simState.branchCurrents[assertion.branch];
        return amps !== undefined && inRange(Math.abs(amps), assertion.minA, assertion.maxA);
      });
    }
    case 'pin-mode':
      return ctx.pinStates[assertion.pinId]?.mode === assertion.mode;
    case 'pin-pwm': {
      const state = ctx.pinStates[assertion.pinId];
      return state?.mode === 'OUTPUT' && state.pwm !== undefined && state.pwm >= 1;
    }
    case 'net-voltage': {
      const volts =
        assertion.target.kind === 'board'
          ? ctx.voltageOfBoardPin(assertion.target.pinId)
          : ctx.voltageOfComponentPin(assertion.target.type, assertion.target.pinId);
      return volts !== undefined && inRange(volts, assertion.minV, assertion.maxV);
    }
    case 'serial-contains':
      return ctx.serialText.includes(assertion.text);
    case 'serial-number-range': {
      const numbers = ctx.serialText.match(/-?\d+(?:\.\d+)?/g) ?? [];
      return numbers.some((n) => inRange(Number(n), assertion.min, assertion.max));
    }
    case 'damage-occurred':
      return assertion.ruleId
        ? ctx.lastDamageRuleId === assertion.ruleId
        : ctx.lastDamageRuleId !== null;
    default:
      return false;
  }
}

export function evaluateAssertions(
  assertions: Assertion[],
  ctx: LessonContext,
): boolean[] {
  return assertions.map((a) => evaluateAssertion(a, ctx));
}
