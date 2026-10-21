import { beforeEach, describe, expect, it } from 'vitest';
import { useCircuitStore } from '../store/circuitStore';
import {
  DEFAULT_WIRE_COLOR,
  WIRE_COLORS,
  isWireColorHex,
  normalizeWireColor,
} from '../wireColors';
import type { TerminalRef } from '../netlist';
import { railHoleId, terminalHoleId } from '../../../shared/boards/breadboard';

/**
 * WARNA KABEL AKTIF — perilaku RADIO dikunci di level store:
 * tepat SATU warna dari palet kanonik selalu aktif dan pilihan tidak
 * pernah bisa kosong. Regresi yang dicegah: state wireColor berupa
 * string bebas + setter tanpa validasi — nilai di luar palet membuat
 * dock merender NOL swatch aktif (tampilan "warna mati") sementara
 * kabel baru tetap dicap warna nyasar itu secara diam-diam.
 */

const hole = (holeId: string): TerminalRef => ({ kind: 'hole', holeId });

function resetStore() {
  useCircuitStore.setState({
    instances: [],
    pinHoles: {},
    wires: [],
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    toolMode: 'build',
    placingType: null,
    pendingFrom: null,
    wireColor: DEFAULT_WIRE_COLOR,
    selectedInstanceId: null,
    selectedWireId: null,
  });
}

const active = () => useCircuitStore.getState().wireColor;
const setColor = (c: unknown) =>
  useCircuitStore.getState().setWireColor(c as string);

beforeEach(resetStore);

describe('wireColor — keadaan awal & invariant palet', () => {
  it('bawaan adalah warna kanonik dan anggota palet', () => {
    expect(active()).toBe(DEFAULT_WIRE_COLOR);
    expect(isWireColorHex(active())).toBe(true);
    expect(WIRE_COLORS.some((c) => c.hex === active())).toBe(true);
  });

  it('palet kanonik berisi tepat 7 warna berhex unik', () => {
    expect(WIRE_COLORS).toHaveLength(7);
    expect(new Set(WIRE_COLORS.map((c) => c.hex)).size).toBe(7);
  });
});

describe('wireColor — radio: klik warna aktif tidak pernah mematikan', () => {
  it('setWireColor(warna aktif) berulang-ulang tidak mengubah apa pun', () => {
    for (let i = 0; i < 5; i += 1) setColor(active());
    expect(active()).toBe(DEFAULT_WIRE_COLOR);
  });

  it('mengklik warna aktif lewat bentuk huruf kecilnya pun tetap aktif', () => {
    // Jalur lama menyimpan bawaan huruf kecil ('#3b82f6'); klik swatch
    // mengirim hex kanonik — keduanya harus berakhir di warna yang sama.
    setColor(DEFAULT_WIRE_COLOR.toLowerCase());
    expect(active()).toBe(DEFAULT_WIRE_COLOR);
    setColor(DEFAULT_WIRE_COLOR);
    expect(active()).toBe(DEFAULT_WIRE_COLOR);
  });

  it('setiap warna palet bisa dipilih dan berpindah antar warna', () => {
    for (const c of WIRE_COLORS) {
      setColor(c.hex);
      expect(active()).toBe(c.hex);
    }
    // Berpindah kembali ke awal tetap berfungsi (bukan toggle mati).
    setColor(WIRE_COLORS[0].hex);
    expect(active()).toBe(WIRE_COLORS[0].hex);
  });
});

describe('wireColor — API store tidak menyediakan jalan mengosongkan', () => {
  it('string kosong / spasi / sampah ditolak, warna aktif dipertahankan', () => {
    setColor('#A855F7');
    for (const bad of ['', '   ', 'garbage', 'red', 'biru', '#', '##']) {
      setColor(bad);
      expect(active()).toBe('#A855F7');
    }
  });

  it('hex di luar palet ditolak', () => {
    setColor('#22C55E');
    for (const bad of ['#000000', '#FFFFFF', '#123456', '#3B82F', '#3B82F60']) {
      setColor(bad);
      expect(active()).toBe('#22C55E');
    }
  });

  it('nilai bukan string (null/undefined/angka/objek) ditolak', () => {
    setColor('#EF4444');
    for (const bad of [null, undefined, 3, Number.NaN, {}, []]) {
      setColor(bad);
      expect(active()).toBe('#EF4444');
    }
  });

  it('invariant bertahan sesudah rentetan campuran valid + tidak valid', () => {
    const seq: unknown[] = [
      '#EAB308', '', '#F97316', null, '#1F2937', 'sampah', '#A855F7', '#000',
    ];
    for (const v of seq) {
      setColor(v);
      // Sesudah SETIAP panggilan: selalu ada tepat satu warna palet aktif.
      expect(isWireColorHex(active())).toBe(true);
    }
    expect(active()).toBe('#A855F7');
  });
});

describe('normalizeWireColor — normalisasi palet', () => {
  it('hex palet huruf kecil/campuran dinormalkan ke bentuk kanonik', () => {
    expect(normalizeWireColor('#ef4444')).toBe('#EF4444');
    expect(normalizeWireColor('#a855F7')).toBe('#A855F7');
    expect(normalizeWireColor(' #22c55e ')).toBe('#22C55E');
  });

  it('di luar palet menghasilkan null', () => {
    expect(normalizeWireColor('')).toBeNull();
    expect(normalizeWireColor('#000000')).toBeNull();
    expect(normalizeWireColor(null)).toBeNull();
    expect(normalizeWireColor(undefined)).toBeNull();
    expect(normalizeWireColor(7)).toBeNull();
  });
});

describe('wireColor — jalur penempatan kabel membaca warna aktif tunggal', () => {
  it('kabel baru dicap warna aktif; percobaan mengosongkan tidak mengubah cap berikutnya', () => {
    const s = useCircuitStore.getState();
    s.setWireColor('#A855F7');
    s.clickTerminal(hole(terminalHoleId('L', 10, 0)));
    s.clickTerminal(hole(railHoleId('R-', 4)));
    let st = useCircuitStore.getState();
    expect(st.wires).toHaveLength(1);
    expect(st.wires[0].color).toBe('#A855F7');

    // Upaya mematikan pilihan (string kosong) — kabel berikutnya harus
    // tetap memakai warna aktif terakhir yang sah, bukan warna kosong.
    useCircuitStore.getState().setWireColor('');
    useCircuitStore.getState().clickTerminal(hole(terminalHoleId('L', 12, 0)));
    useCircuitStore.getState().clickTerminal(hole(railHoleId('R-', 6)));
    st = useCircuitStore.getState();
    expect(st.wires).toHaveLength(2);
    expect(st.wires[1].color).toBe('#A855F7');
  });
});
