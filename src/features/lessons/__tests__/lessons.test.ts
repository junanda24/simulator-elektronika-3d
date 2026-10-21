import { describe, expect, it } from 'vitest';
import { evaluateAssertion, type LessonContext } from '../engine';
import { projectFromFileJson, projectFromHash, projectToFileJson, projectToHash, toSharedProject } from '../../share/projectShare';
import { EMPTY_SIM_RESULT } from '../../../shared/types';

function ctx(overrides: Partial<LessonContext> = {}): LessonContext {
  return {
    boardId: 'uno',
    instances: [],
    pinStates: {},
    serialText: '',
    lastDamageRuleId: null,
    voltageOfBoardPin: () => undefined,
    voltageOfComponentPin: () => undefined,
    ...overrides,
  };
}

const ledInstance = (amps: number) => ({
  id: 'led-1',
  type: 'led-5mm',
  position: [0, 3, 0] as [number, number, number],
  rotation: 0,
  props: {},
  interactiveState: {},
  simState: { pinVoltages: {}, branchCurrents: { led: amps }, isDamaged: false },
});

describe('lesson engine', () => {
  it('branch-current menilai arus cabang instance pertama yang cocok', () => {
    const a = { kind: 'branch-current', type: 'led-5mm', branch: 'led', minA: 0.004, maxA: 0.025, label: 'x' } as const;
    expect(evaluateAssertion(a, ctx({ instances: [ledInstance(0.013)] }))).toBe(true);
    expect(evaluateAssertion(a, ctx({ instances: [ledInstance(0.5)] }))).toBe(false);
    expect(evaluateAssertion(a, ctx())).toBe(false);
  });

  it('pin-mode & pin-pwm dari state pin', () => {
    const mode = { kind: 'pin-mode', pinId: 'D2', mode: 'INPUT_PULLUP', label: 'x' } as const;
    expect(evaluateAssertion(mode, ctx({ pinStates: { D2: { mode: 'INPUT_PULLUP' } } }))).toBe(true);
    expect(evaluateAssertion(mode, ctx({ pinStates: { D2: { mode: 'INPUT' } } }))).toBe(false);
    const pwm = { kind: 'pin-pwm', pinId: 'D9', label: 'x' } as const;
    expect(evaluateAssertion(pwm, ctx({ pinStates: { D9: { mode: 'OUTPUT', pwm: 128 } } }))).toBe(true);
    expect(evaluateAssertion(pwm, ctx({ pinStates: { D9: { mode: 'OUTPUT', pwm: 0 } } }))).toBe(false);
  });

  it('serial & damage & net-voltage', () => {
    expect(
      evaluateAssertion(
        { kind: 'serial-contains', text: 'LED nyala', label: 'x' },
        ctx({ serialText: 'Blink!\nLED nyala\n' }),
      ),
    ).toBe(true);
    expect(
      evaluateAssertion(
        { kind: 'serial-number-range', min: 10, max: 1010, label: 'x' },
        ctx({ serialText: '512\n513\n' }),
      ),
    ).toBe(true);
    expect(
      evaluateAssertion(
        { kind: 'damage-occurred', ruleId: 'LED_OVERCURRENT', label: 'x' },
        ctx({ lastDamageRuleId: 'LED_OVERCURRENT' }),
      ),
    ).toBe(true);
    expect(
      evaluateAssertion(
        {
          kind: 'net-voltage',
          target: { kind: 'component', type: 'potentiometer', pinId: 'WIPER' },
          minV: 0.3,
          maxV: 4.7,
          label: 'x',
        },
        ctx({ voltageOfComponentPin: () => 2.5 }),
      ),
    ).toBe(true);
  });
});

describe('project share', () => {
  const project = toSharedProject({
    boardId: 'esp32',
    instances: [
      {
        id: 'led-1',
        type: 'led-5mm',
        position: [12, 3, -5],
        rotation: 0,
        props: { color: 'red' },
        interactiveState: {},
        simState: EMPTY_SIM_RESULT,
      },
    ],
    pinHoles: { 'led-1': { ANODE: 't:R:20:4', CATHODE: 't:R:22:4' } },
    wires: [
      { id: 'w1', a: { kind: 'board', pinId: 'D2' }, b: { kind: 'hole', holeId: 't:R:24:2' }, color: '#3b82f6' },
    ],
    sketchCode: 'void setup() {}\nvoid loop() {}\n',
  });

  it('round-trip hash URL mengembalikan proyek yang sama', () => {
    const hash = projectToHash(project);
    expect(hash.startsWith('#s=')).toBe(true);
    expect(projectFromHash(hash)).toEqual(project);
  });

  it('round-trip JSON .rangkai', () => {
    const text = projectToFileJson(project);
    expect(projectFromFileJson(text)).toEqual(project);
  });

  it('masukan rusak ditolak dengan null', () => {
    expect(projectFromHash('#s=!!!bukan-data')).toBeNull();
    expect(projectFromHash('#lainnya')).toBeNull();
    expect(projectFromFileJson('{bukan json')).toBeNull();
    expect(projectFromFileJson('{"v":2}')).toBeNull();
  });
});
