import { describe, expect, it } from 'vitest';
import { LESSONS } from '../curriculum';
import { computePlacement } from '../../wiring/placement';
import { getBoardDefinition, boardPinById, BOARD_DEFINITIONS } from '../../../shared/boards/definitions';
import { parseHole } from '../../../shared/boards/breadboard';
import { getComponentMeta } from '../../../shared/components/catalogMeta';
import type { TerminalRef } from '../../wiring/netlist';

/**
 * Integritas kurikulum: setiap modul (lama & baru) harus bisa
 * dibangun persis seperti yang dijanjikan ke pengguna — penempatan
 * starter tidak boleh gagal, referensi kabel harus menunjuk lubang /
 * pin yang sah, dan assertion hanya boleh merujuk board, komponen,
 * dan pin yang benar-benar ada.
 */

/** RuleId kerusakan yang dikenal engine/komponen (dari kode sumber). */
const KNOWN_RULE_IDS = new Set([
  'CAP_OVERVOLTAGE',
  'CAP_REVERSE_POLARITY',
  'DIODE_OVERCURRENT',
  'DIODE_REVERSE_BREAKDOWN',
  'FUSE_BLOWN',
  'LED_OVERCURRENT',
  'LED_REVERSE_BREAKDOWN',
  'MCU_PIN_OVERCURRENT',
  'MCU_PIN_OVERVOLTAGE',
  'MOTOR_STALL',
  'POWER_SHORT_CIRCUIT',
  'TRANSISTOR_OVERCURRENT',
]);

function expectRefValid(ref: TerminalRef, boardId: string, where: string) {
  if (ref.kind === 'hole') {
    expect(parseHole(ref.holeId), `${where}: lubang ${ref.holeId} harus ter-parse`).not.toBeNull();
  } else {
    const board = getBoardDefinition(boardId);
    expect(
      boardPinById(board, ref.pinId),
      `${where}: pin board ${ref.pinId} harus ada di board ${boardId}`,
    ).toBeDefined();
  }
}

describe('integritas kurikulum', () => {
  it('kurikulum berisi tepat 14 modul dengan id unik', () => {
    expect(LESSONS).toHaveLength(14);
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lesson of LESSONS) {
    describe(lesson.id, () => {
      it('boardId sah', () => {
        expect(BOARD_DEFINITIONS[lesson.boardId]).toBeDefined();
      });

      it('semua penempatan starter berhasil secara berurutan', () => {
        const starter = lesson.starter;
        if (!starter) return;
        const occupied = new Set<string>();
        for (const p of starter.placements) {
          expect(
            getComponentMeta(p.type),
            `tipe komponen ${p.type} harus terdaftar di katalog`,
          ).toBeDefined();
          const placement = computePlacement(p.type, p.holeId, occupied);
          expect(
            placement,
            `penempatan ${p.type} @ ${p.holeId} tidak boleh null (tabrakan / lubang jangkar tidak sah)`,
          ).not.toBeNull();
          if (!placement) continue;
          for (const h of Object.values(placement.pinHoles)) occupied.add(h);
        }
      });

      it('semua referensi kabel starter sah', () => {
        const starter = lesson.starter;
        if (!starter) return;
        starter.wires.forEach((w, i) => {
          expectRefValid(w.a, lesson.boardId, `${lesson.id} kabel#${i + 1} ujung a`);
          expectRefValid(w.b, lesson.boardId, `${lesson.id} kabel#${i + 1} ujung b`);
        });
      });

      it('semua assertion merujuk entitas yang ada', () => {
        const board = getBoardDefinition(lesson.boardId);
        for (const a of lesson.assertions) {
          switch (a.kind) {
            case 'board-is':
              expect(BOARD_DEFINITIONS[a.boardId]).toBeDefined();
              break;
            case 'component-present':
            case 'branch-current':
              expect(
                getComponentMeta(a.type),
                `assertion ${a.kind}: tipe ${a.type} harus terdaftar`,
              ).toBeDefined();
              break;
            case 'pin-mode':
            case 'pin-pwm':
              expect(
                boardPinById(board, a.pinId),
                `assertion ${a.kind}: pin ${a.pinId} harus ada di board ${lesson.boardId}`,
              ).toBeDefined();
              break;
            case 'net-voltage':
              if (a.target.kind === 'board') {
                expect(boardPinById(board, a.target.pinId)).toBeDefined();
              } else {
                const meta = getComponentMeta(a.target.type);
                expect(meta, `net-voltage: tipe ${a.target.type} harus terdaftar`).toBeDefined();
                expect(
                  meta?.pins.some((p) => p.id === a.target.pinId),
                  `net-voltage: pin ${a.target.pinId} harus ada di meta ${a.target.type}`,
                ).toBe(true);
              }
              break;
            case 'damage-occurred':
              if (a.ruleId) {
                expect(
                  KNOWN_RULE_IDS.has(a.ruleId),
                  `damage-occurred: ruleId ${a.ruleId} harus dikenal`,
                ).toBe(true);
              }
              break;
            default:
              break;
          }
        }
      });
    });
  }
});
