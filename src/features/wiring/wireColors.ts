/**
 * Palet warna kabel KANONIK — satu sumber kebenaran untuk pilihan warna
 * aktif (dock bawah ToolbarBar, shortcut angka di App, dan state store).
 *
 * Perilaku RADIO adalah invariant proyek: tepat SATU warna dari palet ini
 * selalu aktif; pilihan tidak pernah bisa kosong. Invariant itu dijaga di
 * store (setWireColor menormalkan + menolak nilai di luar palet), bukan
 * hanya oleh niat baik pemanggil — API store tidak menyediakan jalan apa
 * pun untuk mengosongkan pilihan.
 *
 * Urutan + hex 1–6 dipertahankan persis (memori otot + STYLE_GUIDE §C);
 * Ungu #7 = PWM. Nama/peran semantik mengikuti kartu Warna Kabel di App.
 */
export const WIRE_COLORS = [
  { hex: '#EF4444', name: 'Merah', role: '5V' },
  { hex: '#1F2937', name: 'Hitam', role: 'GND' },
  { hex: '#3B82F6', name: 'Biru', role: 'sinyal' },
  { hex: '#22C55E', name: 'Hijau', role: 'sinyal' },
  { hex: '#EAB308', name: 'Kuning', role: 'analog' },
  { hex: '#F97316', name: 'Oranye', role: '3V3' },
  { hex: '#A855F7', name: 'Ungu', role: 'sinyal PWM' },
] as const;

/** Union literal hex palet — tipe wireColor di store, bukan string bebas. */
export type WireColorHex = (typeof WIRE_COLORS)[number]['hex'];

/** Warna aktif bawaan (Biru #3 — sama seperti bawaan lama '#3b82f6'). */
export const DEFAULT_WIRE_COLOR: WireColorHex = '#3B82F6';

const CANONICAL_BY_LOWER = new Map<string, WireColorHex>(
  WIRE_COLORS.map((c) => [c.hex.toLowerCase(), c.hex]),
);

/**
 * Normalkan masukan apa pun menjadi hex kanonik palet (huruf besar,
 * persis seperti tertulis di WIRE_COLORS). Mengembalikan null bila
 * masukan bukan salah satu dari 7 warna palet (string kosong, hex di
 * luar palet, bukan string, dsb.) — pemanggil wajib memperlakukan null
 * sebagai "tolak, pertahankan warna aktif sekarang".
 */
export function normalizeWireColor(input: unknown): WireColorHex | null {
  if (typeof input !== 'string') return null;
  return CANONICAL_BY_LOWER.get(input.trim().toLowerCase()) ?? null;
}

/** true bila nilai adalah salah satu hex palet (sudah ternormalkan). */
export function isWireColorHex(value: unknown): value is WireColorHex {
  return normalizeWireColor(value) === value;
}
