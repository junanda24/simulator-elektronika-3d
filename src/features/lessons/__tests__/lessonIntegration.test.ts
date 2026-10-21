import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../../simulation/worker/simSession';
import { computePlacement } from '../../wiring/placement';
import { buildNetlist } from '../../wiring/netlist';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import { getLesson, type LessonModule } from '../curriculum';
import { evaluateAssertions, type LessonContext } from '../engine';
import type { ComponentInstanceState } from '../../../shared/types';

/**
 * Integrasi Batch 4: rangkaian awal + sketch awal sebuah modul
 * dijalankan di SimSession; assertion dievaluasi dari snapshot
 * persis seperti store melakukannya (dengan penempelan sticky).
 */

function starterParts(lesson: LessonModule) {
  const starter = lesson.starter;
  if (!starter) throw new Error('modul tanpa starter');
  const instances: ComponentInstanceState[] = [];
  const pinHoles: Record<string, Record<string, string>> = {};
  const occupied = new Set<string>();
  for (const p of starter.placements) {
    const placement = computePlacement(p.type, p.holeId, occupied);
    if (!placement) throw new Error(`placement gagal: ${p.type} @ ${p.holeId}`);
    for (const h of Object.values(placement.pinHoles)) occupied.add(h);
    instances.push({ ...placement.instance, props: { ...placement.instance.props, ...p.props } });
    pinHoles[placement.instance.id] = placement.pinHoles;
  }
  let seq = 0;
  const wires = starter.wires.map((w) => ({ ...w, id: `lw-${(seq += 1)}` }));
  return { instances, pinHoles, wires, boardId: lesson.boardId };
}

async function runLesson(
  lesson: LessonModule,
  durationMs: number,
): Promise<{ checks: boolean[]; serial: string }> {
  const session = new SimSession();
  const parts = starterParts(lesson);
  const board = getBoardDefinition(lesson.boardId);
  let checks = lesson.assertions.map(() => false);
  let serial = '';
  let lastDamageRuleId: string | null = null;
  session.setSnapshotListener((snap: SimSnapshot) => {
    serial += snap.serialChunk;
    const rule = snap.damageEvents[0]?.report.ruleId ?? snap.boardEvents[0]?.report.ruleId;
    if (rule) lastDamageRuleId = rule;
    const instances = parts.instances.map((inst) => {
      const result = snap.results[inst.id];
      return result ? { ...inst, simState: result } : inst;
    });
    const netlist = buildNetlist(instances, parts.pinHoles, parts.wires, snap.pinStates, board);
    const ctx: LessonContext = {
      boardId: lesson.boardId,
      instances,
      pinStates: snap.pinStates,
      serialText: serial,
      lastDamageRuleId,
      voltageOfBoardPin: (pinId) => snap.voltages[netlist.netOfBoardPin(pinId)],
      voltageOfComponentPin: (type, pinId) => {
        const inst = instances.find((i) => i.type === type);
        if (!inst) return undefined;
        const net = netlist.netOfPin(inst.id, pinId);
        return net ? snap.voltages[net] : undefined;
      },
    };
    const fresh = evaluateAssertions(lesson.assertions, ctx);
    checks = lesson.assertions.map((_, i) => checks[i] || fresh[i]);
  });
  session.setCircuit(parts);
  if (lesson.starter?.sketch) session.startSketch(lesson.starter.sketch);
  else session.setPowered(true);
  await new Promise((r) => setTimeout(r, durationMs));
  session.stopSketch();
  session.setPowered(false);
  return { checks, serial };
}

describe('integrasi lesson', () => {
  it('Modul 2 (Blink) lulus semua assertion dari rangkaian + sketch awalnya', async () => {
    const lesson = getLesson('modul-2-blink');
    if (!lesson) throw new Error('modul 2 hilang');
    const { checks } = await runLesson(lesson, 2600);
    expect(checks).toEqual([true, true, true]);
  }, 15000);

  it('Modul 6: assertion kerusakan terpenuhi, arus aman belum (sebelum perbaikan)', async () => {
    const lesson = getLesson('modul-6-bahaya-arus');
    if (!lesson) throw new Error('modul 6 hilang');
    const { checks } = await runLesson(lesson, 1200);
    expect(checks[0]).toBe(true); // LED_OVERCURRENT terjadi
    expect(checks[1]).toBe(false); // belum ada arus aman
  }, 15000);

  it('Modul 7 (ESP32) lulus di board ESP32', async () => {
    const lesson = getLesson('modul-7-esp32');
    if (!lesson) throw new Error('modul 7 hilang');
    const { checks } = await runLesson(lesson, 1800);
    expect(checks).toEqual([true, true, true]);
  }, 15000);
});
