import { describe, expect, it } from 'vitest';
import { SimSession, type SimSnapshot } from '../../simulation/worker/simSession';
import { computePlacement } from '../../wiring/placement';
import { buildNetlist } from '../../wiring/netlist';
import { getBoardDefinition } from '../../../shared/boards/definitions';
import { LESSONS, getLesson, type LessonModule } from '../curriculum';
import { evaluateAssertions, type LessonContext } from '../engine';
import type { ComponentInstanceState } from '../../../shared/types';

/**
 * Integrasi Batch 4: rangkaian awal + sketch awal sebuah modul
 * dijalankan di SimSession; assertion dievaluasi dari snapshot
 * persis seperti store melakukannya (dengan penempelan sticky).
 *
 * Perluasan audit 2026-10-21 (T6): SEMUA modul 1–24 kini dijalankan
 * end-to-end — fase A keadaan bawaan, lalu fase interaksi yang
 * diperintahkan goal modul (tombol ditekan, knop diputar ke dua
 * ujung, LDR digelapkan, PIR digerakkan, LM35 dipanaskan). Aturan
 * globalnya: tidak ada starter yang boleh memicu event kerusakan
 * board/komponen, KECUALI LED_OVERCURRENT modul 6 yang memang
 * pelajarannya. Aturan inilah yang menangkap T1 (modul 8 tak bisa
 * tamat) dan T2 (starter modul 10 membakar pin D8) secara permanen.
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

interface RunPhase {
  waitMs: number;
  /** Mutasi interactiveState di awal fase (meniru interaksi pengguna). */
  mutate?: (instances: ComponentInstanceState[]) => ComponentInstanceState[];
}

interface RunResult {
  /** Keadaan checks (sticky) di akhir setiap fase. */
  checksByPhase: boolean[][];
  checks: boolean[];
  serial: string;
  /** Semua ruleId kerusakan (komponen + board) yang terpicu selama run. */
  damageRules: Set<string>;
  sketchError: string | null;
}

async function runLessonPhased(lesson: LessonModule, phases: RunPhase[]): Promise<RunResult> {
  const session = new SimSession();
  let parts = starterParts(lesson);
  const board = getBoardDefinition(lesson.boardId);
  let checks = lesson.assertions.map(() => false);
  const checksByPhase: boolean[][] = [];
  let serial = '';
  let lastDamageRuleId: string | null = null;
  const damageRules = new Set<string>();
  let sketchError: string | null = null;
  session.setSnapshotListener((snap: SimSnapshot) => {
    serial += snap.serialChunk;
    for (const e of snap.damageEvents) {
      damageRules.add(e.report.ruleId);
      lastDamageRuleId = e.report.ruleId;
    }
    for (const e of snap.boardEvents) {
      damageRules.add(e.report.ruleId);
      lastDamageRuleId = e.report.ruleId;
    }
    if (snap.sketchError) sketchError = snap.sketchError;
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
  for (const phase of phases) {
    if (phase.mutate) {
      parts = { ...parts, instances: phase.mutate(parts.instances) };
      session.setCircuit(parts);
    }
    await new Promise((r) => setTimeout(r, phase.waitMs));
    checksByPhase.push([...checks]);
  }
  session.stopSketch();
  session.setPowered(false);
  return { checksByPhase, checks, serial, damageRules, sketchError };
}

async function runLesson(
  lesson: LessonModule,
  durationMs: number,
): Promise<{ checks: boolean[]; serial: string }> {
  const { checks, serial } = await runLessonPhased(lesson, [{ waitMs: durationMs }]);
  return { checks, serial };
}

/** Mutasi interactiveState semua instance satu tipe (interaksi pengguna). */
const patchInteractive =
  (type: string, patch: Record<string, unknown>) =>
  (instances: ComponentInstanceState[]): ComponentInstanceState[] =>
    instances.map((inst) =>
      inst.type === type
        ? { ...inst, interactiveState: { ...inst.interactiveState, ...patch } }
        : inst,
    );

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

describe('integrasi lesson — audit menyeluruh 24 modul (T6)', () => {
  interface AuditCase {
    phases: RunPhase[];
    /** Checks yang diharapkan di akhir fase A (keadaan bawaan). */
    expectPhaseA: boolean[];
    /** RuleId kerusakan yang diizinkan; bawaan: tidak ada sama sekali. */
    allowedDamage?: string[];
    /** Checks akhir yang diharapkan; bawaan: semua true. */
    expectFinal?: boolean[];
  }

  const T = true;
  const F = false;

  // Penolong khusus modul 24: tambal FC-51 ke-idx berdasarkan urutan
  // penempatan (patchInteractive bawaan menambal SEMUA instance satu
  // tipe — tidak bisa membedakan dua sinar). Kontrak: FC-51 luar =
  // indeks 0, dalam = indeks 1, sesuai urutan placements di starter.
  const patchFc51 =
    (idx: number, patch: Record<string, unknown>) =>
    (instances: ComponentInstanceState[]): ComponentInstanceState[] => {
      let seen = -1;
      return instances.map((inst) => {
        if (inst.type !== 'fc-51') return inst;
        seen += 1;
        return seen === idx
          ? { ...inst, interactiveState: { ...inst.interactiveState, ...patch } }
          : inst;
      });
    };
  const SINAR_PUTUS = { distanceCm: 10 }; // <= ambang 20 cm -> OUT LOW
  const SINAR_BEBAS = { distanceCm: 35 }; // bawaan gizmo -> OUT HIGH

  // Fase modul 23 dipakai bersama oleh CASES dan tes bespoke
  // histeresis di bawah — satu sumber kebenaran.
  const PHASES_23: RunPhase[] = [
    // Fase A BUKAN bawaan gizmo: suhu disetel ke 35 °C (ADC 602
    // terukur, pita tengah histeresis) sejak awal.
    { waitMs: 2400, mutate: patchInteractive('ntc-thermistor', { tempC: 35 }) },
    { waitMs: 1200, mutate: patchInteractive('ntc-thermistor', { tempC: 45 }) },
    { waitMs: 1000, mutate: patchInteractive('ntc-thermistor', { tempC: 35 }) },
    { waitMs: 1200, mutate: patchInteractive('rain-sensor', { wetness: 1 }) },
    { waitMs: 1000, mutate: patchInteractive('ldr', { light: 0 }) },
  ];

  // Fase modul 24 (15 fase: diam, batal, masuk x2, keluar) — juga
  // satu sumber kebenaran untuk CASES dan tes bespoke pembatalan.
  const PHASES_24: RunPhase[] = [
    { waitMs: 2400 }, // A diam
    { waitMs: 600, mutate: patchFc51(0, SINAR_PUTUS) }, // B batal-1
    { waitMs: 600, mutate: patchFc51(0, SINAR_BEBAS) }, // C batal-2
    { waitMs: 500, mutate: patchFc51(0, SINAR_PUTUS) }, // D masuk1-1
    { waitMs: 500, mutate: patchFc51(1, SINAR_PUTUS) }, // E masuk1-2
    { waitMs: 500, mutate: patchFc51(0, SINAR_BEBAS) }, // F masuk1-3
    { waitMs: 700, mutate: patchFc51(1, SINAR_BEBAS) }, // G masuk1-4 (commit 1)
    { waitMs: 500, mutate: patchFc51(0, SINAR_PUTUS) }, // H masuk2-1
    { waitMs: 500, mutate: patchFc51(1, SINAR_PUTUS) }, // I masuk2-2
    { waitMs: 500, mutate: patchFc51(0, SINAR_BEBAS) }, // J masuk2-3
    { waitMs: 700, mutate: patchFc51(1, SINAR_BEBAS) }, // K masuk2-4 (commit 2)
    { waitMs: 500, mutate: patchFc51(1, SINAR_PUTUS) }, // L keluar-1
    { waitMs: 500, mutate: patchFc51(0, SINAR_PUTUS) }, // M keluar-2
    { waitMs: 500, mutate: patchFc51(1, SINAR_BEBAS) }, // N keluar-3
    { waitMs: 700, mutate: patchFc51(0, SINAR_BEBAS) }, // O keluar-4 (commit 1)
  ];

  const CASES: Record<string, AuditCase> = {
    'modul-1-led-pertama': {
      phases: [{ waitMs: 2400 }],
      expectPhaseA: [T, T, T],
    },
    'modul-2-blink': {
      phases: [{ waitMs: 2600 }],
      expectPhaseA: [T, T, T],
    },
    'modul-3-tombol': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 900, mutate: patchInteractive('push-button', { pressed: true }) },
      ],
      expectPhaseA: [T, T, F], // LED menunggu tombol ditekan
    },
    'modul-4-potensio': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 800, mutate: patchInteractive('potentiometer', { alpha: 0 }) },
        { waitMs: 800, mutate: patchInteractive('potentiometer', { alpha: 1 }) },
      ],
      // Posisi tengah bawaan: dua ekstrem T3 belum (dan tidak boleh) terpenuhi.
      expectPhaseA: [T, T, F, F],
    },
    'modul-5-pwm': {
      phases: [{ waitMs: 2400 }],
      expectPhaseA: [T, T],
    },
    'modul-6-bahaya-arus': {
      phases: [{ waitMs: 1800 }],
      expectPhaseA: [T, F],
      // Satu-satunya pengecualian terdokumentasi: LED_OVERCURRENT
      // adalah pelajaran modul ini; arus aman menunggu perbaikan user.
      allowedDamage: ['LED_OVERCURRENT'],
      expectFinal: [T, F],
    },
    'modul-7-esp32': {
      phases: [{ waitMs: 2400 }],
      expectPhaseA: [T, T, T],
    },
    'modul-8-proyek-akhir': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 900, mutate: patchInteractive('push-button', { pressed: true }) },
      ],
      // Regresi T1: tanpa kabel ground rel R-, dua checks terakhir
      // TIDAK PERNAH terpenuhi bahkan dengan tombol ditekan.
      expectPhaseA: [T, T, F, F],
    },
    'modul-9-transistor-saklar': {
      phases: [{ waitMs: 2600 }],
      expectPhaseA: [T, T, T, T, T],
    },
    'modul-10-relay-motor': {
      phases: [{ waitMs: 2800 }],
      // Regresi T2: keempat checks memang ter-latch, tetapi starter
      // lama memicu MCU_PIN_OVERCURRENT — ditangkap aturan damage di
      // bawah (allowedDamage kosong), bukan oleh checks.
      expectPhaseA: [T, T, T, T],
    },
    'modul-11-ldr-lampu-otomatis': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 1000, mutate: patchInteractive('ldr', { light: 0 }) },
      ],
      // Terang bawaan: serial pita gelap, tegangan pita gelap, dan LED
      // semua belum terpenuhi (asersi T7 yang diperkuat).
      expectPhaseA: [T, F, F, F],
    },
    'modul-12-pir-buzzer': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 900, mutate: patchInteractive('pir', { motion: true }) },
      ],
      expectPhaseA: [T, T, T, F], // buzzer menunggu gerakan
    },
    'modul-13-servo-potensio': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 800, mutate: patchInteractive('potentiometer', { alpha: 0 }) },
        { waitMs: 800, mutate: patchInteractive('potentiometer', { alpha: 1 }) },
      ],
      // Urutan checks: [servo ada, pot ada, PWM, sudut tengah, serial
      // ujung bawah, serial ujung atas, sudut 180°, wiper tengah].
      // Lima terpenuhi dari posisi bawaan; tiga ekstrem T4 belum —
      // modul tidak lagi lulus tanpa interaksi.
      expectPhaseA: [T, T, T, T, F, F, F, T],
    },
    'modul-14-lm35-termometer': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 1000, mutate: patchInteractive('lm35', { tempC: 40 }) },
      ],
      expectPhaseA: [T, T, F], // LED peringatan menunggu suhu > 30 °C
    },
    'modul-15-rgb-pwm': {
      phases: [{ waitMs: 3600 }],
      // Tanpa interaksi: siklus warna starter yang memenuhi semuanya —
      // Merah (0–1 dtk) melatch pin-pwm D9 + arus kanal r, Biru
      // (2–3 dtk) melatch arus kanal b; asersi sticky menahannya.
      expectPhaseA: [T, T, T, T],
    },
    'modul-16-joystick': {
      phases: [{ waitMs: 2400 }],
      // Tuas diam di tengah: VRX ±2,5 V dan cetakan X/Y ±512 memenuhi
      // keempat checks langsung dari keadaan bawaan.
      expectPhaseA: [T, T, T, T],
    },
    'modul-17-kipas-otomatis': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 1000, mutate: patchInteractive('lm35', { tempC: 40 }) },
      ],
      // Suhu ruangan (25 °C → ADC 51): serial terbaca, tetapi D7 masih
      // LOW — arus kolektor & motor menunggu suhu melewati 30 °C.
      expectPhaseA: [T, T, T, T, F, F],
    },
    'modul-18-lampu-lalu-lintas': {
      phases: [{ waitMs: 5600 }],
      // Tanpa interaksi: siklus berjalan sendiri — 5,6 dtk cukup
      // melewati MERAH (3 dtk) + MERAH+KUNING (1 dtk) sampai keadaan
      // HIJAU tercetak dan kelima checks ter-latch.
      expectPhaseA: [T, T, T, T, T],
    },
    'modul-19-sistem-keamanan': {
      phases: [
        { waitMs: 2400 },
        {
          waitMs: 1000,
          // Logika AND butuh KEDUA sensor aktif bersamaan: kubah PIR
          // digerakkan DAN tabung tilt dimiringkan dalam satu fase.
          mutate: (instances) =>
            patchInteractive('tilt-switch', { tilted: true })(
              patchInteractive('pir', { motion: true })(instances),
            ),
        },
      ],
      // Diam: sensor tidak sepakat — relay tidak aktif, buzzer diam.
      expectPhaseA: [T, T, T, T, F, F],
    },
    'modul-20-penghitung-7segmen': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 700, mutate: patchInteractive('push-button', { pressed: true }) },
        { waitMs: 700, mutate: patchInteractive('push-button', { pressed: false }) },
        { waitMs: 1000, mutate: patchInteractive('push-button', { pressed: true }) },
      ],
      // Angka 0 tampil sejak setup: segmen A menyala & Serial
      // mengumumkan, tetapi segmen G menunggu dua tepi turun tombol
      // (hitungan mencapai 2) di fase-fase berikutnya.
      expectPhaseA: [T, T, T, T, F, T],
    },
    'modul-21-alarm-gas-api': {
      phases: [
        { waitMs: 2400 },
        { waitMs: 1500, mutate: patchInteractive('mq2', { ppm: 5000 }) },
        {
          waitMs: 1500,
          // Gas dibersihkan DAN api dinyalakan dalam satu fase
          // gabungan (pola mutasi majemuk Modul 19).
          mutate: (instances) =>
            patchInteractive('flame-sensor', { flame: 0.85 })(
              patchInteractive('mq2', { ppm: 0 })(instances),
            ),
        },
      ],
      // Udara bersih: tujuh checks dasar terpenuhi; lima checks
      // bahaya (s7, motor, buzzer, dua teks Serial) HARUS tetap
      // false — alarm tidak boleh berbunyi di dapur yang bersih.
      expectPhaseA: [T, T, T, T, T, T, T, F, F, F, F, F],
    },
    'modul-22-sensor-parkir': {
      phases: [
        { waitMs: 2800 },
        { waitMs: 1800, mutate: patchInteractive('hc-sr04', { distanceCm: 25 }) },
        { waitMs: 1800, mutate: patchInteractive('hc-sr04', { noObstacle: true }) },
      ],
      // Rintangan bawaan 100 cm: jarak terbaca, 5 segmen menyala,
      // buzzer berbunyi. Checks jarak dekat, segmen ke-9, dan cabang
      // timeout HARUS tetap false di fase ini.
      expectPhaseA: [T, T, T, T, T, T, F, F, F],
    },
    'modul-23-rumah-kaca': {
      phases: PHASES_23,
      // Pita tengah dari sisi dingin: bacaan suhu terbaca (ADC 602),
      // tetapi ventilasi & pompa HARUS tetap diam — ambang tunggal
      // 600 akan gagal di sini, histeresis yang lulus.
      expectPhaseA: [T, T, T, T, F, F, F, F, F],
    },
    'modul-24-penghitung-pengunjung': {
      phases: PHASES_24,
      // Diam: display 0 (segmen A menyala), belum ada lintasan apa pun.
      expectPhaseA: [T, T, T, T, T, F, F, F, F, F, F],
    },
  };

  it('tabel audit mencakup tepat 24 modul kurikulum', () => {
    expect(Object.keys(CASES).sort()).toEqual(LESSONS.map((l) => l.id).sort());
  });

  for (const lesson of LESSONS) {
    it(`${lesson.id}: starter berjalan tanpa kerusakan & semua checks tercapai`, async () => {
      const auditCase = CASES[lesson.id];
      if (!auditCase) throw new Error(`kasus audit hilang untuk ${lesson.id}`);
      const result = await runLessonPhased(lesson, auditCase.phases);

      // Sketch tidak boleh error di modul mana pun.
      expect(result.sketchError, `${lesson.id}: sketchError`).toBeNull();

      // Fase A harus persis seperti bukti audit (butir yang butuh
      // interaksi tetap belum terpenuhi).
      expect(result.checksByPhase[0], `${lesson.id}: checks fase A`).toEqual(
        auditCase.expectPhaseA,
      );

      // Akhir run: semua checks tercapai (kecuali pengecualian eksplisit).
      const expectFinal =
        auditCase.expectFinal ?? lesson.assertions.map(() => true);
      expect(result.checks, `${lesson.id}: checks akhir`).toEqual(expectFinal);

      // Aturan global tanpa-kerusakan (pengunci permanen T1/T2).
      expect(
        [...result.damageRules].sort(),
        `${lesson.id}: event kerusakan yang terpicu`,
      ).toEqual([...(auditCase.allowedDamage ?? [])].sort());
    }, 30000);
  }

  it('modul-23-rumah-kaca: histeresis terbukti dua arah (fase C identik fase B)', async () => {
    const lesson = getLesson('modul-23-rumah-kaca');
    if (!lesson) throw new Error('modul 23 hilang');
    const result = await runLessonPhased(lesson, PHASES_23);

    // Fase C (suhu kembali ke 35 °C / ADC 602 — bacaan yang IDENTIK
    // dengan fase A) tidak boleh melatch check baru apa pun terhadap
    // fase B (45 °C): sistem mempertahankan keadaan panasnya. Pada
    // fase A bacaan yang sama menghasilkan checks yang berbeda
    // (ventilasi diam) — dua saksi ini bersama membuktikan
    // histeresis, bukan sekadar ambang.
    expect(result.checksByPhase[2]).toEqual(result.checksByPhase[1]);
    expect(result.checksByPhase[1]).not.toEqual(result.checksByPhase[0]);

    // Saksi independen kedua: teks penutupan karena suhu hanya
    // tercetak bila ventilasi benar-benar menutup lewat ambang
    // bawah — selama seluruh run ia tidak boleh muncul sekali pun
    // (penutupan di fase D adalah karena HUJAN, teksnya berbeda).
    expect(result.serial).not.toContain('VENT TUTUP (suhu turun)');
    expect(result.serial).toContain('VENT TUTUP (HUJAN)');

    // Fase D: walau suhu di pita tengah, prioritas hujan melatch
    // check penutupan-hujan (indeks 7).
    expect(result.checksByPhase[3][7]).toBe(true);
    expect(result.sketchError).toBeNull();
    expect([...result.damageRules]).toEqual([]);
  }, 30000);

  it('modul-24-penghitung-pengunjung: lintasan yang dibatalkan tidak mengubah apa pun', async () => {
    const lesson = getLesson('modul-24-penghitung-pengunjung');
    if (!lesson) throw new Error('modul 24 hilang');
    const result = await runLessonPhased(lesson, PHASES_24);

    // Fase B–C: sinar luar putus lalu bebas lagi tanpa sinar dalam
    // tersentuh (orang mundur). Checks di akhir fase C HARUS sama
    // persis dengan fase A — mesin yang menghitung di tepi pertama
    // akan mencetak "Masuk. Pengunjung: 1" di sini dan ketahuan.
    expect(result.checksByPhase[2]).toEqual(result.checksByPhase[0]);
    expect(result.checksByPhase[1]).toEqual(result.checksByPhase[0]);
    expect(result.serial).not.toContain('Keluar. Pengunjung: 0');

    // Sesudah dua lintasan masuk penuh dan satu keluar, ketiga teks
    // hitungan hadir — urutan lengkap mesin keadaan bekerja.
    expect(result.serial).toContain('Masuk. Pengunjung: 1');
    expect(result.serial).toContain('Masuk. Pengunjung: 2');
    expect(result.serial).toContain('Keluar. Pengunjung: 1');
    expect(result.sketchError).toBeNull();
    expect([...result.damageRules]).toEqual([]);
  }, 30000);
});
