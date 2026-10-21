import { describe, expect, it } from 'vitest';
import { transpileSketch } from '../transpiler';

/**
 * Sorot baris eksekusi (RASA-2): codegen menyisipkan `__line(n);` tepat
 * SEBELUM setiap pernyataan dalam daftar pernyataan blok, n = baris
 * sumber token pertama pernyataan itu. Asersi di sini terarah pada
 * pasangan penanda + pernyataan kunci — bukan snapshot kode penuh.
 */

const SKETCH = [
  'int pinLed = 13;', //            baris 1 — deklarasi global: TIDAK ditandai
  'void setup() {', //              baris 2
  '  pinMode(13, OUTPUT);', //      baris 3
  '}', //                           baris 4
  'void kedip() {', //              baris 5
  '  digitalWrite(13, HIGH);', //   baris 6
  '  delay(100);', //               baris 7
  '  digitalWrite(13, LOW);', //    baris 8
  '  delay(100);', //               baris 9
  '}', //                           baris 10
  'void loop() {', //               baris 11
  '  kedip();', //                  baris 12
  '}', //                           baris 13
].join('\n');

describe('transpiler — penanda __line', () => {
  it('memancarkan __line tepat sebelum pernyataan kunci dengan nomor baris sumber yang benar', () => {
    const { code, error } = transpileSketch(SKETCH);
    expect(error).toBeNull();
    expect(code).not.toBeNull();
    // setup(): pinMode di baris 3.
    expect(code).toContain('__line(3); (await pinMode(13, OUTPUT));');
    // Fungsi user kedip(): kedua digitalWrite blink (baris 6 & 8).
    expect(code).toContain('__line(6); (await digitalWrite(13, HIGH));');
    expect(code).toContain('__line(8); (await digitalWrite(13, LOW));');
    // loop(): pemanggilan fungsi user di baris 12.
    expect(code).toContain('__line(12); (await kedip());');
  });

  it('tidak menandai deklarasi global, dan jumlah penanda = jumlah pernyataan blok', () => {
    const { code } = transpileSketch(SKETCH);
    expect(code).not.toBeNull();
    expect(code).not.toContain('__line(1);');
    // Pernyataan blok: baris 3, 6, 7, 8, 9, 12 → tepat 6 penanda.
    const marks = code!.match(/__line\(\d+\);/g) ?? [];
    expect(marks).toHaveLength(6);
  });

  it('pernyataan di dalam blok if berkurung ditandai dengan barisnya sendiri', () => {
    const sketch = [
      'void setup() { }', //          baris 1
      'void loop() {', //             baris 2
      '  if (true) {', //             baris 3 — pernyataan if ditandai di level loop
      '    digitalWrite(13, HIGH);', // baris 4 — ditandai di level blok if
      '  }',
      '}',
    ].join('\n');
    const { code, error } = transpileSketch(sketch);
    expect(error).toBeNull();
    expect(code).toContain('__line(3); if');
    expect(code).toContain('__line(4); (await digitalWrite(13, HIGH));');
  });

  it('body if/while TANPA kurung tetap tertranspilasi (penanda tidak disisipkan di posisi pernyataan tunggal)', () => {
    const sketch = [
      'void setup() { }',
      'void loop() {',
      '  if (digitalRead(2)) digitalWrite(13, HIGH); else digitalWrite(13, LOW);',
      '  while (false) digitalWrite(13, LOW);',
      '}',
    ].join('\n');
    const { code, error } = transpileSketch(sketch);
    expect(error).toBeNull();
    expect(code).not.toBeNull();
  });

  it('format error lama tidak berubah: titik koma hilang dilaporkan pada baris pernyataan itu', () => {
    const broken = [
      'void setup() {',
      '  digitalWrite(13, HIGH)', // <- tanpa ';' — kesalahan di baris 2
      '  delay(100);',
      '}',
      'void loop() { }',
    ].join('\n');
    const { code, error } = transpileSketch(broken);
    expect(code).toBeNull();
    expect(error).toMatch(/^Baris 2: /);
  });
});
