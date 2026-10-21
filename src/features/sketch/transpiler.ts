/**
 * Transpiler sketch Arduino (C++) -> JavaScript async — TECH_STACK.md §3,
 * ROADMAP.md Batch 2.
 *
 * Kontrak hasil: `transpileSketch(source)` mengembalikan `{ code, error }`.
 * Bila sukses, `code` adalah ISI fungsi JS yang dijalankan runtime sebagai:
 *
 *   const factory = new Function('__api', code);
 *   const { setup, loop } = await factory(api);
 *
 * Jadi `code` diakhiri `return { setup, loop };` dan `setup`/`loop`/fungsi
 * buatan user semuanya `async function` — karena di dalamnya boleh ada
 * `delay()`. Konsekuensinya SEMUA pemanggilan fungsi di kode user di-await
 * oleh codegen (kecuali di konteks yang tidak boleh async: inisialisasi
 * variabel global, label `case`, dan nilai default parameter).
 *
 * Perlindungan loop tak hingga: `await guard();` disisipkan di awal body
 * `loop()` dan di awal body setiap `for`/`while`/`do-while`, sehingga
 * `while(true){}` tanpa `delay()` tidak akan membekukan runtime — guard
 * milik runtime yang memutuskan kapan harus menyerah/menjadwal ulang.
 *
 * Sorot baris eksekusi: codegen menyisipkan `__line(n);` tepat SEBELUM
 * setiap pernyataan yang berada dalam daftar pernyataan sebuah blok
 * (body fungsi, blok bersarang, badan `case` pada switch) — n = nomor
 * baris sumber token pertama pernyataan itu. Runtime meneruskannya ke
 * sesi (hooks.onLine) agar editor menyorot baris yang sedang berjalan.
 * Pernyataan tunggal tanpa kurung kurawal sebagai body if/loop TIDAK
 * ditandai sendiri (menyisipkan pernyataan di posisi itu akan mengubah
 * ikatan else/makna) — pernyataan kontrol induknyalah yang ditandai;
 * body berkurung kurawal ditandai per pernyataan di dalam bloknya.
 * Deklarasi global juga tidak ditandai (dijalankan sekali saat factory).
 *
 * Implementasi: tokenizer + parser recursive-descent/Pratt tulisan tangan
 * (tanpa library parser eksternal), codegen langsung saat parsing.
 *
 * Penyederhanaan yang disengaja (dokumenkan bila ditambah):
 * - `#define` hanya substitusi token object-like; macro berparameter diabaikan.
 *   Direktif lain (#include, #ifdef, ...) diabaikan — isi blok #ifdef tetap
 *   diproses apa adanya.
 * - Pembagian bilangan bulat mengikuti semantik JS (tidak dipotong seperti
 *   C++); cast ke tipe integer memakai Math.trunc, cast lain diteruskan.
 * - Deklarasi bertipe tak dikenal (kelas library: Servo, LiquidCrystal_I2C,
 *   DHT, ...) menjadi stub `__libStub('NamaLibrary')` dari PREAMBLE — Proxy
 *   yang melempar error Bahasa Indonesia menyebut library & method pada
 *   pemanggilan pertama. (Dulu `null`, yang menghasilkan "Cannot read
 *   properties of null" — tak berarti apa-apa bagi pemula.)
 * - Fungsi Arduino murni yang murah disediakan PREAMBLE sebagai JS polos:
 *   random/randomSeed, pow/sqrt/sq/sin/cos/tan, konstanta PI/TWO_PI/HALF_PI
 *   dan DEC/HEX/OCT/BIN, micros (dari millis), delayMicroseconds (dari
 *   delay). Fungsi yang belum bisa didukung jujur (tone/noTone, pulseIn,
 *   shiftOut/shiftIn, attachInterrupt/detachInterrupt) adalah stub yang
 *   melempar error "belum didukung" menyebut nama fungsinya — bukan
 *   ReferenceError mentah.
 * - `struct`/`class`/`enum`/`union`/`typedef`, label/goto, dan lambda belum
 *   didukung — parser menolaknya dengan pesan Bahasa Indonesia.
 * - Parameter referensi (`int &x`) dan pointer (`int *p`) diterima tapi
 *   semantik referensinya diabaikan (lewat-nilai seperti JS).
 * - Variabel lokal `static` tidak persisten antar pemanggilan (menjadi `let`).
 * - `sizeof(x)` selalu menghasilkan 4.
 */

export interface TranspileResult {
  code: string | null;
  error: string | null;
}

/** Awalan wajib kode hasil: destrukturisasi API + konstanta Arduino. */
const PREAMBLE = [
  "const { pinMode, digitalWrite, digitalRead, analogWrite, analogRead, delay, millis, guard, Serial, map, constrain, min, max, abs, __line } = __api;",
  "const HIGH = 1, LOW = 0, INPUT = 'INPUT', OUTPUT = 'OUTPUT', INPUT_PULLUP = 'INPUT_PULLUP';",
  "const A0='A0',A1='A1',A2='A2',A3='A3',A4='A4',A5='A5';",
  'const LED_BUILTIN = 13;',
  // Builtin Arduino murni-JS (tidak butuh runtime): konstanta & matematika.
  'const PI = Math.PI, TWO_PI = Math.PI * 2, HALF_PI = Math.PI / 2;',
  'const DEC = 10, HEX = 16, OCT = 8, BIN = 2;',
  'const pow = Math.pow, sqrt = Math.sqrt, sq = (x) => x * x, sin = Math.sin, cos = Math.cos, tan = Math.tan;',
  // random Arduino: random(hi) -> [0, hi); random(lo, hi) -> [lo, hi).
  'const random = (a, b) => { const lo = b === undefined ? 0 : a; const hi = b === undefined ? a : b; return Math.floor(Math.random() * (hi - lo)) + lo; };',
  'const randomSeed = () => {};',
  'const micros = () => Math.floor(millis() * 1000);',
  'const delayMicroseconds = async (us) => { await delay(Math.max(0, Number(us) || 0) / 1000); };',
  // Fungsi yang belum didukung: stub yang melempar error jelas menyebut
  // nama fungsi (+ saran pengganti bila ada), bukan ReferenceError mentah.
  "const __belumDidukung = (nama, saran) => { throw new Error('Fungsi ' + nama + '() belum didukung simulator' + (saran ? ' — ' + saran : '') + '. Sketch berhenti.'); };",
  "const tone = () => __belumDidukung('tone', 'bunyi buzzer di simulator dibuat dengan digitalWrite HIGH/LOW pada pin buzzer');",
  "const noTone = () => __belumDidukung('noTone', 'bunyi buzzer di simulator dibuat dengan digitalWrite HIGH/LOW pada pin buzzer');",
  "const pulseIn = () => __belumDidukung('pulseIn', 'sensor ultrasonik HC-SR04 belum tersedia di simulator');",
  "const shiftOut = () => __belumDidukung('shiftOut');",
  "const shiftIn = () => __belumDidukung('shiftIn');",
  "const attachInterrupt = () => __belumDidukung('attachInterrupt');",
  "const detachInterrupt = () => __belumDidukung('detachInterrupt');",
  // Stub objek library: akses method apa pun menghasilkan fungsi yang
  // melempar error menyebut library & method yang dipanggil.
  "const __libStub = (nama) => new Proxy({}, { get: (_t, prop) => { if (typeof prop === 'symbol') return undefined; return () => { throw new Error(\"Fungsi '\" + String(prop) + \"' dari library '\" + nama + \"' belum didukung simulator — objek library seperti Servo, DHT, dan LCD belum tersedia di simulator ini, jadi sketch berhenti. Sementara pakai fungsi bawaan dasar: pinMode, digitalWrite, analogWrite, digitalRead, analogRead, Serial, delay, millis.\"); }; } });",
].join('\n');

/* ================================================================== */
/* Tokenizer                                                           */
/* ================================================================== */

type TokenKind = 'ident' | 'num' | 'str' | 'char' | 'punct' | 'eof';

interface Token {
  kind: TokenKind;
  /** Untuk str/char: nilai yang sudah di-decode. Untuk num: literal mentah. */
  value: string;
  line: number;
}

class SketchError extends Error {
  readonly line: number;
  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

/** Operator multi-karakter, diurutkan dari yang terpanjang. */
const MULTI_OPS = [
  '<<=',
  '>>=',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '<<',
  '>>',
  '->',
  '::',
];

/** Decode escape sequence C++ sederhana (\n, \t, \x41, \101, \\, ...). */
function decodeEscape(src: string, i: number): { ch: string; next: number } {
  const c = src[i];
  switch (c) {
    case 'n':
      return { ch: '\n', next: i + 1 };
    case 't':
      return { ch: '\t', next: i + 1 };
    case 'r':
      return { ch: '\r', next: i + 1 };
    case '0':
      return { ch: '\0', next: i + 1 };
    case 'a':
      return { ch: '\x07', next: i + 1 };
    case 'b':
      return { ch: '\b', next: i + 1 };
    case 'f':
      return { ch: '\f', next: i + 1 };
    case 'v':
      return { ch: '\v', next: i + 1 };
    case 'x': {
      let hex = '';
      let j = i + 1;
      while (j < src.length && /[0-9a-fA-F]/.test(src[j]) && hex.length < 2) {
        hex += src[j];
        j++;
      }
      return hex
        ? { ch: String.fromCharCode(parseInt(hex, 16)), next: j }
        : { ch: 'x', next: i + 1 };
    }
    default:
      if (c >= '0' && c <= '7') {
        let oct = c;
        let j = i + 1;
        while (j < src.length && src[j] >= '0' && src[j] <= '7' && oct.length < 3) {
          oct += src[j];
          j++;
        }
        return { ch: String.fromCharCode(parseInt(oct, 8)), next: j };
      }
      // \\, \", \', dan escape tak dikenal -> karakter itu sendiri.
      return { ch: c, next: i + 1 };
  }
}

/**
 * Tokenisasi satu fragmen sumber (dipakai juga untuk nilai #define).
 * Mengisi `macros` bila menemukan direktif #define object-like.
 */
function tokenizeFragment(
  src: string,
  startLine: number,
  macros: Map<string, Token[]>,
  allowDirectives: boolean,
): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = startLine;
  let atLineStart = true; // hanya spasi sejak awal baris (untuk deteksi '#')

  const push = (kind: TokenKind, value: string, tokLine: number) => {
    tokens.push({ kind, value, line: tokLine });
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '\n') {
      line++;
      i++;
      atLineStart = true;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }

    // Direktif preprocessor: '#' di awal baris -> konsumsi sampai akhir baris.
    if (c === '#' && atLineStart && allowDirectives) {
      let end = src.indexOf('\n', i);
      if (end === -1) end = src.length;
      const text = src.slice(i, end);
      const m = /^#\s*([A-Za-z]+)\s*(.*)$/.exec(text);
      if (m && m[1] === 'define') {
        const rest = m[2];
        const nameMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
        if (nameMatch) {
          const name = nameMatch[0];
          const after = rest.slice(name.length);
          // Macro berparameter: '(' menempel langsung -> abaikan (penyederhanaan).
          if (!after.startsWith('(')) {
            const valueTokens = tokenizeFragment(after, line, macros, false);
            macros.set(
              name,
              valueTokens.filter((t) => t.kind !== 'eof'),
            );
          }
        }
      }
      i = end;
      continue;
    }
    atLineStart = false;

    // Komentar baris & blok dibuang.
    if (c === '/' && src[i + 1] === '/') {
      let end = src.indexOf('\n', i);
      if (end === -1) end = src.length;
      i = end;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end === -1) throw new SketchError(line, "komentar blok '/*' tidak ditutup.");
      for (let k = i; k < end; k++) if (src[k] === '\n') line++;
      i = end + 2;
      continue;
    }

    // Literal string.
    if (c === '"') {
      let j = i + 1;
      let out = '';
      let closed = false;
      while (j < src.length) {
        const ch = src[j];
        if (ch === '"') {
          closed = true;
          j++;
          break;
        }
        if (ch === '\n') break;
        if (ch === '\\' && j + 1 < src.length) {
          const d = decodeEscape(src, j + 1);
          out += d.ch;
          j = d.next;
          continue;
        }
        out += ch;
        j++;
      }
      if (!closed) throw new SketchError(line, 'literal string tidak ditutup.');
      push('str', out, line);
      i = j;
      continue;
    }

    // Literal char -> diperlakukan sebagai string satu karakter.
    if (c === "'") {
      let j = i + 1;
      let out = '';
      let closed = false;
      while (j < src.length) {
        const ch = src[j];
        if (ch === "'") {
          closed = true;
          j++;
          break;
        }
        if (ch === '\n') break;
        if (ch === '\\' && j + 1 < src.length) {
          const d = decodeEscape(src, j + 1);
          out += d.ch;
          j = d.next;
          continue;
        }
        out += ch;
        j++;
      }
      if (!closed) throw new SketchError(line, 'literal karakter tidak ditutup.');
      push('char', out, line);
      i = j;
      continue;
    }

    // Angka: desimal, float, heksadesimal 0x, biner 0b.
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      if (src[j] === '0' && (src[j + 1] === 'x' || src[j + 1] === 'X')) {
        j += 2;
        while (j < src.length && /[0-9a-fA-F_]/.test(src[j])) j++;
      } else if (src[j] === '0' && (src[j + 1] === 'b' || src[j + 1] === 'B')) {
        j += 2;
        while (j < src.length && /[01_]/.test(src[j])) j++;
      } else {
        while (j < src.length && /[0-9_.]/.test(src[j])) j++;
        if (src[j] === 'e' || src[j] === 'E') {
          j++;
          if (src[j] === '+' || src[j] === '-') j++;
          while (j < src.length && /[0-9]/.test(src[j])) j++;
        }
      }
      // Sufiks tipe C++ (UL, L, f, ...) dibuang.
      while (j < src.length && /[uUlLfF]/.test(src[j])) j++;
      push('num', src.slice(i, j).replace(/_/g, ''), line);
      i = j;
      continue;
    }

    // Identifier / kata kunci.
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      push('ident', src.slice(i, j), line);
      i = j;
      continue;
    }

    // Operator / tanda baca.
    let matched = '';
    for (const op of MULTI_OPS) {
      if (src.startsWith(op, i)) {
        matched = op;
        break;
      }
    }
    if (matched) {
      push('punct', matched, line);
      i += matched.length;
      continue;
    }
    if ('+-*/%=<>!&|^~?:;,.()[]{}'.includes(c)) {
      push('punct', c, line);
      i++;
      continue;
    }

    throw new SketchError(line, `karakter tidak dikenal: '${c}'.`);
  }

  push('eof', '', line);
  return tokens;
}

/** Substitusi #define: ganti token identifier dengan token nilainya (berulang terbatas). */
function applyMacros(tokens: Token[], macros: Map<string, Token[]>): Token[] {
  let current = tokens;
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const next: Token[] = [];
    for (const tok of current) {
      if (tok.kind === 'ident' && macros.has(tok.value)) {
        changed = true;
        for (const mt of macros.get(tok.value)!) {
          next.push({ ...mt, line: tok.line });
        }
      } else {
        next.push(tok);
      }
    }
    current = next;
    if (!changed) break;
  }
  return current;
}

/* ================================================================== */
/* Parser + codegen                                                    */
/* ================================================================== */

/** Semua kata yang boleh muncul dalam spesifikasi tipe (termasuk kualifikasi). */
const TYPE_WORDS = new Set([
  'const',
  'static',
  'unsigned',
  'signed',
  'int',
  'long',
  'short',
  'float',
  'double',
  'bool',
  'boolean',
  'char',
  'byte',
  'word',
  'String',
  'void',
  'size_t',
  'uint8_t',
  'uint16_t',
  'uint32_t',
  'int8_t',
  'int16_t',
  'int32_t',
  'uint64_t',
  'int64_t',
]);
/** Kata tipe dasar (tanpa kualifikasi) — untuk deteksi cast. */
const BASE_TYPE_WORDS = new Set(
  [...TYPE_WORDS].filter((w) => w !== 'const' && w !== 'static' && w !== 'signed'),
);
const INT_TYPE_WORDS = new Set([
  'int',
  'long',
  'short',
  'char',
  'byte',
  'word',
  'size_t',
  'uint8_t',
  'uint16_t',
  'uint32_t',
  'int8_t',
  'int16_t',
  'int32_t',
  'uint64_t',
  'int64_t',
  'unsigned',
]);

type TypeFamily = 'num' | 'str' | 'bool' | 'char' | 'void' | 'object';

interface TypeInfo {
  family: TypeFamily;
  /** Nilai default C++ untuk variabel tak terinisialisasi (sebagai kode JS). */
  defaultCode: string;
  /** Nama tipe untuk keluarga 'object' (kelas library) — untuk stub error. */
  objectName?: string;
}

function typeInfoFrom(
  words: string[],
  objectType: boolean,
  objectName?: string,
): TypeInfo {
  if (objectType) return { family: 'object', defaultCode: 'null', objectName };
  if (words.includes('String')) return { family: 'str', defaultCode: "''" };
  if (words.includes('bool') || words.includes('boolean'))
    return { family: 'bool', defaultCode: 'false' };
  // char: mengikuti kontrak tugas — diperlakukan seperti string satu karakter.
  if (words.includes('char')) return { family: 'char', defaultCode: "''" };
  if (words.includes('void')) return { family: 'void', defaultCode: '0' };
  return { family: 'num', defaultCode: '0' };
}

const ASSIGN_OPS = new Set([
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '<<=',
  '>>=',
]);

const BIN_PREC: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '&': 5,
  '==': 6,
  '!=': 6,
  '<': 7,
  '<=': 7,
  '>': 7,
  '>=': 7,
  '<<': 8,
  '>>': 8,
  '+': 9,
  '-': 9,
  '*': 10,
  '/': 10,
  '%': 10,
};

class Parser {
  private tokens: Token[];
  private pos = 0;
  /** >0 berarti pemanggilan fungsi tidak di-await (global init, label case, default param). */
  private suppressAwait = 0;
  /** Nama fungsi yang berhasil didefinisikan (untuk cek setup/loop). */
  readonly functions = new Set<string>();

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /* ---------- utilitas token ---------- */

  private peek(offset = 0): Token {
    const idx = Math.min(this.pos + offset, this.tokens.length - 1);
    return this.tokens[idx];
  }

  private next(): Token {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return tok;
  }

  private at(value: string): boolean {
    return this.peek().value === value && this.peek().kind !== 'eof';
  }

  private eat(value: string): boolean {
    if (this.at(value)) {
      this.next();
      return true;
    }
    return false;
  }

  private expect(value: string, message: string): Token {
    const tok = this.peek();
    if (tok.value !== value) throw new SketchError(tok.line, message);
    return this.next();
  }

  /**
   * Harapkan ';' di akhir pernyataan. Bila token saat ini bukan ';',
   * kesalahan yang sebenarnya hampir selalu titik koma yang HILANG di
   * akhir pernyataan sebelumnya — jadi baris yang dilaporkan adalah baris
   * token terakhir pernyataan itu (tempat ';' seharusnya berada), bukan
   * baris token berikutnya yang bisa beberapa baris lebih jauh dan
   * menunjuk baris yang salah (temuan audit runner: `digitalWrite(...)\n
   * delay(...);` dulu dilaporkan "Baris 4" padahal ';' hilang di baris 3).
   */
  private expectSemicolon(message: string): void {
    const tok = this.peek();
    if (tok.kind !== 'eof' && tok.value === ';') {
      this.next();
      return;
    }
    const prev = this.tokens[Math.max(0, this.pos - 1)];
    throw new SketchError(prev ? prev.line : tok.line, message);
  }

  private expectIdent(message: string): Token {
    const tok = this.peek();
    if (tok.kind !== 'ident') throw new SketchError(tok.line, message);
    return this.next();
  }

  private withSuppressedAwait<T>(fn: () => T): T {
    this.suppressAwait++;
    try {
      return fn();
    } finally {
      this.suppressAwait--;
    }
  }

  /* ---------- program ---------- */

  parseProgram(): string {
    const parts: string[] = [];
    while (this.peek().kind !== 'eof') {
      if (this.eat(';')) continue;
      const tok = this.peek();
      if (
        tok.kind === 'ident' &&
        ['struct', 'class', 'enum', 'union', 'typedef'].includes(tok.value)
      ) {
        throw new SketchError(
          tok.line,
          `definisi '${tok.value}' belum didukung transpiler.`,
        );
      }
      parts.push(this.parseTopLevel());
    }
    return parts.join('\n');
  }

  /**
   * Satu item tingkat atas: definisi fungsi, prototipe (diabaikan),
   * deklarasi variabel global, atau instansiasi objek library.
   */
  private parseTopLevel(): string {
    const type = this.parseTypeHead();
    // Abaikan penanda pointer pada tipe kembalian / variabel.
    while (this.eat('*')) {
      /* pointer diabaikan */
    }
    const nameTok = this.expectIdent(
      'nama fungsi atau variabel diharapkan setelah tipe.',
    );
    const name = nameTok.value;

    if (this.at('(')) {
      // Bedakan definisi fungsi dari deklarasi konstruktor ala `Tipe nama(args);`
      const closeIdx = this.findMatching(this.pos, '(', ')');
      const after = this.tokens[closeIdx + 1];
      const isDef = after !== undefined && after.value === '{';
      if (isDef) {
        const params = this.parseParams();
        const body = this.parseBlock(name === 'loop');
        this.functions.add(name);
        return `async function ${name}(${params}) ${body}`;
      }
      // Bukan definisi: prototipe fungsi (tipe kata kunci) diabaikan; deklarasi
      // objek (tipe tak dikenal / String dengan argumen ekspresi) diteruskan
      // ke jalur deklarator sebagai inisialisasi konstruktor.
      if (type.family !== 'object' && !this.argsLookLikeValues()) {
        // Prototipe: lewati sampai ';'.
        while (this.peek().kind !== 'eof' && !this.at(';')) this.next();
        this.expectSemicolon("titik koma ';' diharapkan setelah prototipe fungsi.");
        return '';
      }
      const decl = this.withSuppressedAwait(() =>
        this.parseDeclaratorList(type, name),
      );
      this.expectSemicolon("titik koma ';' diharapkan setelah deklarasi.");
      return `${decl};`;
    }

    const decl = this.withSuppressedAwait(() =>
      this.parseDeclaratorList(type, name),
    );
    this.expectSemicolon("titik koma ';' diharapkan setelah deklarasi.");
    return `${decl};`;
  }

  /** Indeks token penutup yang cocok untuk token buka di `openIdx`. */
  private findMatching(openIdx: number, open: string, close: string): number {
    let depth = 0;
    for (let i = openIdx; i < this.tokens.length; i++) {
      const v = this.tokens[i].value;
      if (v === open) depth++;
      else if (v === close) {
        depth--;
        if (depth === 0) return i;
      }
    }
    const tok = this.tokens[openIdx];
    throw new SketchError(tok.line, `'${open}' tidak ditutup dengan '${close}'.`);
  }

  /**
   * Heuristik untuk `Tipe nama ( ... ) ;`: argumen dianggap "nilai" bila ada
   * token yang bukan spesifikasi tipe (literal, operator, dsb.) — menandakan
   * inisialisasi konstruktor, bukan prototipe.
   */
  private argsLookLikeValues(): boolean {
    const closeIdx = this.findMatching(this.pos, '(', ')');
    for (let i = this.pos + 1; i < closeIdx; i++) {
      const t = this.tokens[i];
      if (t.kind === 'num' || t.kind === 'str' || t.kind === 'char') return true;
      if (
        t.kind === 'punct' &&
        !['*', '&', '[', ']', ','].includes(t.value)
      )
        return true;
      if (t.kind === 'ident' && !TYPE_WORDS.has(t.value)) {
        // Identifier kedua setelah tipe bisa jadi nama parameter prototipe;
        // identifier pertama yang bukan kata tipe adalah nilai (variabel).
        const prev = this.tokens[i - 1];
        if (!(prev && prev.kind === 'ident' && TYPE_WORDS.has(prev.value)))
          return true;
      }
    }
    return false;
  }

  /* ---------- tipe & deklarasi ---------- */

  /** Baca kepala tipe: deretan kata tipe ATAU satu identifier tipe objek. */
  private parseTypeHead(): TypeInfo {
    const tok = this.peek();
    if (tok.kind === 'ident' && TYPE_WORDS.has(tok.value)) {
      const words: string[] = [];
      while (
        this.peek().kind === 'ident' &&
        TYPE_WORDS.has(this.peek().value)
      ) {
        words.push(this.next().value);
      }
      return typeInfoFrom(words, false);
    }
    if (tok.kind === 'ident') {
      this.next(); // nama tipe objek (kelas library)
      return typeInfoFrom([], true, tok.value);
    }
    throw new SketchError(
      tok.line,
      `token tak terduga: '${tok.value || 'akhir berkas'}'.`,
    );
  }

  /** Apakah token saat ini bisa memulai deklarasi variabel? */
  private isDeclarationStart(): boolean {
    const t = this.peek();
    if (t.kind === 'ident' && TYPE_WORDS.has(t.value)) return true;
    // Pola `TipeObjek nama ...` — dua identifier berurutan.
    return t.kind === 'ident' && this.peek(1).kind === 'ident';
  }

  /** Kode stub library untuk deklarasi bertipe objek (Servo, DHT, ...). */
  private libStubCode(type: TypeInfo): string {
    return `__libStub(${JSON.stringify(type.objectName ?? 'library')})`;
  }

  /** Nilai default deklarasi: objek library memakai stub, bukan null. */
  private defaultCodeFor(type: TypeInfo): string {
    return type.family === 'object' ? this.libStubCode(type) : type.defaultCode;
  }

  /**
   * Daftar deklarator setelah tipe (dan deklarator pertama yang namanya
   * sudah dibaca bila `firstName` diberikan). Tidak mengonsumsi ';'.
   */
  private parseDeclaratorList(type: TypeInfo, firstName?: string): string {
    const parts: string[] = [];
    let pendingName = firstName;
    for (;;) {
      while (this.eat('*')) {
        /* pointer diabaikan */
      }
      let name: string;
      if (pendingName !== undefined) {
        name = pendingName;
        pendingName = undefined;
      } else {
        name = this.expectIdent('nama variabel diharapkan.').value;
      }

      let isArray = false;
      let arraySize: string | null = null;
      if (this.eat('[')) {
        isArray = true;
        if (!this.at(']')) arraySize = this.parseExpr();
        this.expect(']', "kurung siku ']' tidak ditutup.");
      }

      let init: string | null = null;
      if (this.eat('=')) {
        init = this.at('{') ? this.parseInitList() : this.parseExpr();
      } else if (this.at('{')) {
        init = this.parseInitList();
      } else if (this.at('(')) {
        // Inisialisasi konstruktor: `String s("halo")`, `Servo s(9)`, `int x(5)`.
        const args = this.parseArgList();
        init =
          type.family === 'object'
            ? this.libStubCode(type)
            : args.length === 1
              ? args[0]
              : 'null';
      }

      if (isArray) {
        if (init !== null) parts.push(`${name} = ${init}`);
        else if (arraySize !== null)
          parts.push(
            `${name} = new Array(${arraySize}).fill(${this.defaultCodeFor(type)})`,
          );
        else
          throw new SketchError(
            this.peek().line,
            `ukuran array '${name}' tidak diketahui dan tanpa nilai awal.`,
          );
      } else {
        parts.push(`${name} = ${init ?? this.defaultCodeFor(type)}`);
      }

      if (!this.eat(',')) break;
    }
    return `let ${parts.join(', ')}`;
  }

  /** Daftar inisialisasi C++ `{1, 2, 3}` -> array JS. */
  private parseInitList(): string {
    this.expect('{', "kurung kurawal '{' diharapkan untuk daftar nilai.");
    const items: string[] = [];
    if (!this.at('}')) {
      for (;;) {
        items.push(this.at('{') ? this.parseInitList() : this.parseExpr());
        if (!this.eat(',')) break;
        if (this.at('}')) break; // koma menggantung diperbolehkan
      }
    }
    this.expect('}', "kurung kurawal '}' tidak ditutup pada daftar nilai.");
    return `[${items.join(', ')}]`;
  }

  /** Daftar argumen `(a, b, c)` -> array string kode; mengonsumsi kurung. */
  private parseArgList(): string[] {
    this.expect('(', "kurung buka '(' diharapkan.");
    const args: string[] = [];
    if (!this.at(')')) {
      for (;;) {
        args.push(this.parseExpr());
        if (!this.eat(',')) break;
      }
    }
    this.expect(')', "kurung tutup ')' tidak ditemukan.");
    return args;
  }

  /** Parameter fungsi definisi: tipe dibuang, nama (+default) diteruskan. */
  private parseParams(): string {
    this.expect('(', "kurung buka '(' diharapkan setelah nama fungsi.");
    const params: string[] = [];
    if (this.at(')')) {
      this.next();
      return '';
    }
    // `void` sendirian berarti tanpa parameter.
    if (
      this.peek().value === 'void' &&
      this.peek(1).value === ')'
    ) {
      this.next();
      this.next();
      return '';
    }
    let idx = 0;
    for (;;) {
      // Tipe parameter: kata tipe atau satu identifier tipe objek.
      if (this.peek().kind === 'ident' && TYPE_WORDS.has(this.peek().value)) {
        while (
          this.peek().kind === 'ident' &&
          TYPE_WORDS.has(this.peek().value)
        ) {
          this.next();
        }
      } else if (this.peek().kind === 'ident') {
        this.next();
      } else {
        throw new SketchError(this.peek().line, 'parameter fungsi tidak valid.');
      }
      while (this.eat('*') || this.eat('&')) {
        /* pointer/referensi diabaikan */
      }
      let name: string | null = null;
      if (this.peek().kind === 'ident') name = this.next().value;
      // Abaikan dimensi array pada parameter.
      while (this.eat('[')) {
        if (!this.at(']')) this.parseExpr();
        this.expect(']', "kurung siku ']' tidak ditutup pada parameter.");
      }
      let def: string | null = null;
      if (this.eat('=')) {
        def = this.withSuppressedAwait(() => this.parseExpr());
      }
      const pname = name ?? `_p${idx}`;
      params.push(def !== null ? `${pname} = ${def}` : pname);
      idx++;
      if (!this.eat(',')) break;
    }
    this.expect(')', "kurung tutup ')' tidak ditemukan pada parameter fungsi.");
    return params.join(', ');
  }

  /* ---------- blok & pernyataan ---------- */

  /**
   * Awali kode sebuah pernyataan dengan penanda baris sumbernya
   * (`__line(n);`) agar runtime bisa memberi tahu editor baris mana yang
   * sedang dieksekusi. HANYA aman dipanggil untuk pernyataan yang berada
   * dalam daftar pernyataan (isi blok / badan case) — di posisi pernyataan
   * tunggal (body if/loop tanpa kurung) sisipan ini akan merusak ikatan.
   * Pernyataan kosong (';') tidak ditandai.
   */
  private withLineMark(line: number, code: string): string {
    return code === ';' ? code : `__line(${line}); ${code}`;
  }

  /** Blok `{ ... }`; `injectGuard` menyisipkan guard di awal (khusus loop()). */
  private parseBlock(injectGuard = false): string {
    this.expect('{', "kurung kurawal '{' diharapkan.");
    const stmts: string[] = [];
    if (injectGuard) stmts.push('await guard();');
    while (!this.at('}')) {
      if (this.peek().kind === 'eof') {
        throw new SketchError(
          this.peek().line,
          "kurung kurawal '}' tidak ditutup.",
        );
      }
      const line = this.peek().line;
      const s = this.parseStatement();
      if (s) stmts.push(this.withLineMark(line, s));
    }
    this.next(); // '}'
    return `{ ${stmts.join('\n')} }`;
  }

  /** Bungkus body perulangan dengan guard sebagai pernyataan pertama. */
  private guardWrap(body: string): string {
    if (body.startsWith('{')) return `{ await guard(); ${body.slice(1)}`;
    return `{ await guard(); ${body} }`;
  }

  private parseStatement(): string {
    const tok = this.peek();

    if (this.at('{')) return this.parseBlock();
    if (this.eat(';')) return ';';

    if (tok.kind === 'ident') {
      switch (tok.value) {
        case 'if': {
          this.next();
          this.expect('(', "kurung buka '(' diharapkan setelah 'if'.");
          const cond = this.parseExpr();
          this.expect(')', "kurung tutup ')' tidak ditemukan setelah kondisi 'if'.");
          const thenBranch = this.parseStatement();
          if (this.at('else')) {
            this.next();
            const elseBranch = this.parseStatement();
            return `if (${cond}) ${thenBranch} else ${elseBranch}`;
          }
          return `if (${cond}) ${thenBranch}`;
        }
        case 'while': {
          this.next();
          this.expect('(', "kurung buka '(' diharapkan setelah 'while'.");
          const cond = this.parseExpr();
          this.expect(')', "kurung tutup ')' tidak ditemukan setelah kondisi 'while'.");
          const body = this.parseStatement();
          return `while (${cond}) ${this.guardWrap(body)}`;
        }
        case 'do': {
          this.next();
          const body = this.parseStatement();
          const wTok = this.expectIdent(
            "kata kunci 'while' diharapkan setelah body 'do'.",
          );
          if (wTok.value !== 'while')
            throw new SketchError(wTok.line, "'while' diharapkan setelah body 'do'.");
          this.expect('(', "kurung buka '(' diharapkan setelah 'while'.");
          const cond = this.parseExpr();
          this.expect(')', "kurung tutup ')' tidak ditemukan setelah kondisi 'do-while'.");
          this.expectSemicolon("titik koma ';' diharapkan setelah 'do-while'.");
          return `do ${this.guardWrap(body)} while (${cond});`;
        }
        case 'for':
          return this.parseFor();
        case 'switch':
          return this.parseSwitch();
        case 'return': {
          this.next();
          if (this.eat(';')) return 'return;';
          const value = this.parseExpr();
          this.expectSemicolon("titik koma ';' diharapkan setelah 'return'.");
          return `return ${value};`;
        }
        case 'break':
          this.next();
          this.expectSemicolon("titik koma ';' diharapkan setelah 'break'.");
          return 'break;';
        case 'continue':
          this.next();
          this.expectSemicolon("titik koma ';' diharapkan setelah 'continue'.");
          return 'continue;';
        case 'struct':
        case 'class':
        case 'enum':
        case 'union':
        case 'typedef':
          throw new SketchError(
            tok.line,
            `definisi '${tok.value}' belum didukung transpiler.`,
          );
        case 'goto':
          throw new SketchError(tok.line, "'goto' belum didukung transpiler.");
      }
      // Label `nama:` untuk goto.
      if (this.peek(1).value === ':') {
        throw new SketchError(tok.line, 'label lompatan belum didukung transpiler.');
      }
    }

    if (this.isDeclarationStart()) {
      const type = this.parseTypeHead();
      const decl = this.parseDeclaratorList(type);
      this.expectSemicolon("titik koma ';' diharapkan setelah deklarasi.");
      return `${decl};`;
    }

    const expr = this.parseExpr();
    this.expectSemicolon("titik koma ';' diharapkan setelah ekspresi.");
    return `${expr};`;
  }

  private parseFor(): string {
    this.next(); // 'for'
    this.expect('(', "kurung buka '(' diharapkan setelah 'for'.");
    let init = '';
    if (this.eat(';')) {
      init = '';
    } else if (this.isDeclarationStart()) {
      const type = this.parseTypeHead();
      init = this.parseDeclaratorList(type);
      this.expectSemicolon("titik koma ';' diharapkan setelah inisialisasi 'for'.");
    } else {
      init = this.parseExpr();
      this.expectSemicolon("titik koma ';' diharapkan setelah inisialisasi 'for'.");
    }
    let cond = 'true';
    if (!this.at(';')) cond = this.parseExpr();
    this.expectSemicolon("titik koma ';' diharapkan setelah kondisi 'for'.");
    let incr = '';
    if (!this.at(')')) {
      const parts = [this.parseExpr()];
      while (this.eat(',')) parts.push(this.parseExpr());
      incr = parts.join(', ');
    }
    this.expect(')', "kurung tutup ')' tidak ditemukan pada 'for'.");
    const body = this.parseStatement();
    return `for (${init}; ${cond}; ${incr}) ${this.guardWrap(body)}`;
  }

  private parseSwitch(): string {
    this.next(); // 'switch'
    this.expect('(', "kurung buka '(' diharapkan setelah 'switch'.");
    const disc = this.parseExpr();
    this.expect(')', "kurung tutup ')' tidak ditemukan setelah nilai 'switch'.");
    this.expect('{', "kurung kurawal '{' diharapkan setelah 'switch (...)'.");
    const parts: string[] = [];
    while (!this.at('}')) {
      if (this.peek().kind === 'eof') {
        throw new SketchError(
          this.peek().line,
          "kurung kurawal '}' tidak ditutup pada 'switch'.",
        );
      }
      if (this.at('case')) {
        this.next();
        // Label case adalah konstanta: tidak boleh di-await.
        const label = this.withSuppressedAwait(() => this.parseExpr());
        this.expect(':', "titik dua ':' diharapkan setelah label 'case'.");
        parts.push(`case ${label}:`);
      } else if (this.at('default')) {
        this.next();
        this.expect(':', "titik dua ':' diharapkan setelah 'default'.");
        parts.push('default:');
      } else {
        const line = this.peek().line;
        const s = this.parseStatement();
        if (s) parts.push(this.withLineMark(line, s));
      }
    }
    this.next(); // '}'
    return `switch (${disc}) { ${parts.join('\n')} }`;
  }

  /* ---------- ekspresi (Pratt) ---------- */

  private parseExpr(): string {
    const left = this.parseTernary();
    const tok = this.peek();
    if (tok.kind === 'punct' && ASSIGN_OPS.has(tok.value)) {
      const op = this.next().value;
      const rhs = this.parseExpr();
      return `(${left} ${op} ${rhs})`;
    }
    return left;
  }

  private parseTernary(): string {
    const cond = this.parseBinary(1);
    if (this.eat('?')) {
      const whenTrue = this.parseExpr();
      this.expect(':', "titik dua ':' diharapkan pada ekspresi ternary.");
      const whenFalse = this.parseTernary();
      return `(${cond} ? ${whenTrue} : ${whenFalse})`;
    }
    return cond;
  }

  private parseBinary(minPrec: number): string {
    let left = this.parseUnary();
    for (;;) {
      const tok = this.peek();
      if (tok.kind !== 'punct') break;
      const prec = BIN_PREC[tok.value];
      if (prec === undefined || prec < minPrec) break;
      const op = this.next().value;
      const rhs = this.parseBinary(prec + 1);
      left = `(${left} ${op} ${rhs})`;
    }
    return left;
  }

  /** Apakah '(' saat ini membuka cast `(tipe)ekspresi`? */
  private isCastAhead(): boolean {
    let j = this.pos + 1;
    let hasBase = false;
    while (
      j < this.tokens.length &&
      this.tokens[j].kind === 'ident' &&
      TYPE_WORDS.has(this.tokens[j].value)
    ) {
      if (BASE_TYPE_WORDS.has(this.tokens[j].value)) hasBase = true;
      j++;
    }
    return hasBase && this.tokens[j]?.value === ')';
  }

  private parseUnary(): string {
    const tok = this.peek();
    if (tok.kind === 'punct') {
      if (tok.value === '-' || tok.value === '+' || tok.value === '!' || tok.value === '~') {
        const op = this.next().value;
        return `(${op}${this.parseUnary()})`;
      }
      if (tok.value === '++' || tok.value === '--') {
        const op = this.next().value;
        return `${op}${this.parseUnary()}`;
      }
      if (tok.value === '(' && this.isCastAhead()) {
        this.next(); // '('
        const words: string[] = [];
        while (
          this.peek().kind === 'ident' &&
          TYPE_WORDS.has(this.peek().value)
        ) {
          words.push(this.next().value);
        }
        this.expect(')', "kurung tutup ')' tidak ditemukan setelah cast.");
        const operand = this.parseUnary();
        const isIntCast = words.some((w) => INT_TYPE_WORDS.has(w));
        return isIntCast ? `Math.trunc(${operand})` : `(${operand})`;
      }
    }
    // sizeof(...) -> konstanta kasar 4 byte (penyederhanaan).
    if (tok.kind === 'ident' && tok.value === 'sizeof') {
      this.next();
      if (this.at('(')) {
        const closeIdx = this.findMatching(this.pos, '(', ')');
        this.pos = closeIdx + 1;
      }
      return '4';
    }
    return this.parsePostfix();
  }

  private parsePostfix(): string {
    let expr = this.parsePrimary();
    for (;;) {
      const tok = this.peek();
      if (tok.kind !== 'punct') break;
      if (tok.value === '(') {
        const args = this.parseArgList();
        const call = `${expr}(${args.join(', ')})`;
        expr = this.suppressAwait > 0 ? `(${call})` : `(await ${call})`;
      } else if (tok.value === '[') {
        this.next();
        const idx = this.parseExpr();
        this.expect(']', "kurung siku ']' tidak ditutup.");
        expr = `${expr}[${idx}]`;
      } else if (tok.value === '.' || tok.value === '->' || tok.value === '::') {
        this.next();
        const member = this.expectIdent(
          'nama anggota diharapkan setelah operator akses.',
        ).value;
        expr = `${expr}.${member}`;
      } else if (tok.value === '++' || tok.value === '--') {
        expr = `${expr}${this.next().value}`;
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): string {
    const tok = this.peek();
    switch (tok.kind) {
      case 'num':
        this.next();
        return tok.value;
      case 'str':
        this.next();
        return JSON.stringify(tok.value);
      case 'char':
        this.next();
        return JSON.stringify(tok.value);
      case 'ident':
        this.next();
        return tok.value;
      case 'punct':
        if (tok.value === '(') {
          this.next();
          const inner = this.parseExpr();
          this.expect(')', "kurung tutup ')' tidak ditemukan.");
          return `(${inner})`;
        }
        if (tok.value === '{') return this.parseInitList();
        break;
      default:
        break;
    }
    throw new SketchError(
      tok.line,
      tok.kind === 'eof'
        ? 'akhir berkas tak terduga di tengah ekspresi.'
        : `ekspresi tidak dikenal: '${tok.value}'.`,
    );
  }
}

/* ================================================================== */
/* Titik masuk                                                         */
/* ================================================================== */

/**
 * Transpile satu sketch Arduino menjadi isi fungsi JS (lihat kontrak di
 * header berkas). Kesalahan sintaks tidak dilempar, melainkan dilaporkan
 * sebagai `{ code: null, error: "Baris <n>: <pesan>" }`.
 */
export function transpileSketch(source: string): TranspileResult {
  try {
    const macros = new Map<string, Token[]>();
    const rawTokens = tokenizeFragment(source, 1, macros, true);
    const tokens = applyMacros(rawTokens, macros);
    const parser = new Parser(tokens);
    const body = parser.parseProgram();

    if (!parser.functions.has('loop')) {
      return { code: null, error: 'Fungsi loop() tidak ditemukan di sketch.' };
    }
    if (!parser.functions.has('setup')) {
      return { code: null, error: 'Fungsi setup() tidak ditemukan di sketch.' };
    }

    const code = [PREAMBLE, '', body, '', 'return { setup, loop };'].join('\n');
    return { code, error: null };
  } catch (err) {
    if (err instanceof SketchError) {
      return { code: null, error: `Baris ${err.line}: ${err.message}` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { code: null, error: `Kesalahan internal transpiler: ${message}` };
  }
}
