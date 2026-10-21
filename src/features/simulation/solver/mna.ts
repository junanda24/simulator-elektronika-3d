/**
 * Builder matriks MNA (Modified Nodal Analysis) — SIMULATION_RULES.md §1.
 *
 * Menyelesaikan G · v = i untuk tegangan node DC:
 * - Net 'GND' adalah referensi 0 V dan tidak masuk matriks.
 * - Setiap net lain menerima gmin (konduktansi bocor sangat kecil) ke GND
 *   agar node mengambang tetap menghasilkan solusi hingga.
 * - Penyelesaian memakai eliminasi Gauss dengan partial pivoting.
 */

export const GND_NET = 'GND';

/** Konduktansi bocor ke GND untuk setiap net (Siemens). */
export const GMIN = 1e-9;

/** Konduktansi pengganti untuk sumber Thevenin ideal (seriesOhms <= 0). */
const IDEAL_SOURCE_G = 1e12;

export class MnaBuilder {
  private readonly nets: readonly string[];
  private readonly index: Map<string, number>;
  private readonly g: number[][];
  private readonly i: number[];

  constructor(nets: readonly string[], gmin: number = GMIN) {
    this.nets = nets;
    this.index = new Map(nets.map((net, idx) => [net, idx]));
    const n = nets.length;
    this.g = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    this.i = new Array<number>(n).fill(0);
    // gmin: jangkar lemah ke GND supaya matriks tidak singular.
    // Nilainya bisa dinaikkan engine sebagai tangga pemulihan solver
    // (self-healing): jangkar lebih kuat menenangkan matriks yang
    // nyaris singular dengan harga akurasi yang masih jauh di bawah
    // toleransi pelajaran.
    for (let k = 0; k < n; k++) this.g[k][k] += gmin;
  }

  /** Konduktansi (Siemens) antara dua net. Net 'GND' valid sebagai salah satu ujung. */
  conductance(netA: string, netB: string, g: number): void {
    if (!Number.isFinite(g) || g === 0) return;
    const a = this.index.get(netA);
    const b = this.index.get(netB);
    if (a !== undefined) this.g[a][a] += g;
    if (b !== undefined) this.g[b][b] += g;
    if (a !== undefined && b !== undefined) {
      this.g[a][b] -= g;
      this.g[b][a] -= g;
    }
  }

  /** Sumber arus: arus mengalir dari netFrom menuju netTo. */
  current(netFrom: string, netTo: string, amps: number): void {
    if (!Number.isFinite(amps) || amps === 0) return;
    const from = this.index.get(netFrom);
    const to = this.index.get(netTo);
    if (from !== undefined) this.i[from] -= amps;
    if (to !== undefined) this.i[to] += amps;
  }

  /** Sumber tegangan Thevenin terhadap GND, diubah ke ekuivalen Norton. */
  thevenin(net: string, volts: number, seriesOhms: number): void {
    const idx = this.index.get(net);
    if (idx === undefined || !Number.isFinite(volts)) return;
    const g = seriesOhms > 0 ? 1 / seriesOhms : IDEAL_SOURCE_G;
    this.g[idx][idx] += g;
    this.i[idx] += volts * g;
  }

  /** Selesaikan sistem; hasil memuat semua net plus 'GND': 0. */
  solve(): Map<string, number> {
    const result = new Map<string, number>();
    result.set(GND_NET, 0);
    const n = this.nets.length;
    if (n === 0) return result;

    // Matriks augmented [G | i] (salinan agar builder bisa dipakai ulang per iterasi).
    const a: number[][] = this.g.map((row, r) => [...row, this.i[r]]);

    // Eliminasi Gauss dengan partial pivoting.
    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      let max = Math.abs(a[col][col]);
      for (let r = col + 1; r < n; r++) {
        const v = Math.abs(a[r][col]);
        if (v > max) {
          max = v;
          pivotRow = r;
        }
      }
      if (pivotRow !== col) {
        const tmp = a[col];
        a[col] = a[pivotRow];
        a[pivotRow] = tmp;
      }
      let pivot = a[col][col];
      if (Math.abs(pivot) < 1e-15) {
        // Jaring pengaman terakhir; gmin seharusnya sudah mencegah ini.
        pivot = pivot < 0 ? -1e-15 : 1e-15;
        a[col][col] = pivot;
      }
      for (let r = col + 1; r < n; r++) {
        const factor = a[r][col] / pivot;
        if (factor === 0) continue;
        for (let c = col; c <= n; c++) a[r][c] -= factor * a[col][c];
      }
    }

    // Substitusi mundur.
    const x = new Array<number>(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let sum = a[r][n];
      for (let c = r + 1; c < n; c++) sum -= a[r][c] * x[c];
      x[r] = sum / a[r][r];
    }

    this.nets.forEach((net, idx) => result.set(net, x[idx]));
    return result;
  }
}
