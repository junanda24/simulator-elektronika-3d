import type { ComponentType } from 'react';

/** Kontrak global — sumber: ARCHITECTURE.md §3 (blueprint proyek). */

export type PinType = 'power' | 'ground' | 'digital' | 'analog' | 'passive' | 'terminal';

export interface PinDefinition {
  id: string;
  label: string;
  /** Posisi relatif terhadap titik tengah komponen, satuan pitch 2.54mm. */
  localPosition: [number, number, number];
  type: PinType;
}

export interface DamageReport {
  ruleId: string;
  /** Judul singkat untuk Kartu Autopsi (Bahasa Indonesia). */
  titleId: string;
  /** Penjelasan edukasi: kenapa rusak + cara mencegah (Bahasa Indonesia). */
  explanationId: string;
  /** Nilai terukur yang melanggar (mis. arus dalam mA). */
  measured: number;
  /** Batas aman yang dilampaui. */
  limit: number;
  unit: string;
}

export interface ComponentSimResult {
  pinVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  isDamaged: boolean;
  damageReport?: DamageReport;
}

export const EMPTY_SIM_RESULT: ComponentSimResult = {
  pinVoltages: {},
  branchCurrents: {},
  isDamaged: false,
};

export interface ComponentInstanceState {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: number;
  props: Record<string, unknown>;
  interactiveState: Record<string, unknown>;
  simState: ComponentSimResult;
}

/**
 * Konteks stamping MNA yang disediakan solver ke plugin.
 * Net adalah string; 'GND' adalah node referensi 0 V.
 */
export interface StampContext {
  netOf: (instanceId: string, pinId: string) => string;
  /** Tegangan net pada iterasi PWL sebelumnya (0 bila belum ada). */
  prevVoltage: (net: string) => number;
  /** Konduktansi (Siemens) antara dua net. Net 'GND' valid. */
  conductance: (netA: string, netB: string, g: number) => void;
  /** Sumber arus: arus mengalir dari netFrom menuju netTo. */
  current: (netFrom: string, netTo: string, amps: number) => void;
  /** Sumber tegangan Thevenin terhadap GND (ekuivalen Norton). */
  thevenin: (net: string, volts: number, seriesOhms: number) => void;
}

export interface ComponentElectrical {
  stamp: (ctx: StampContext, instance: ComponentInstanceState, dt: number) => void;
  /** Arus cabang setelah solver selesai, dihitung dari tegangan node final. */
  computeCurrents: (
    instance: ComponentInstanceState,
    voltages: ReadonlyMap<string, number>,
    netOf: (instanceId: string, pinId: string) => string,
  ) => Record<string, number>;
  checkDamage: (instance: ComponentInstanceState, result: ComponentSimResult) => DamageReport | null;
}

export interface ComponentRenderProps {
  instance: ComponentInstanceState;
  onInteract: (newState: Record<string, unknown>) => void;
}

export type ComponentCategory = 'passive' | 'output' | 'input' | 'sensor' | 'actuator' | 'display';

export interface ComponentPlugin {
  type: string;
  name: string;
  category: ComponentCategory;
  descriptionId: string;
  defaultProps: Record<string, unknown>;
  pins: PinDefinition[];
  Render3D: ComponentType<ComponentRenderProps>;
  electrical: ComponentElectrical;
}

/** Sumber tegangan tetap (rail board / catu daya) untuk solver. */
export interface TheveninSource {
  net: string;
  volts: number;
  seriesOhms: number;
}

/** Tautan resistif antar dua net (mis. resistor pull-up internal pin). */
export interface ResistiveLink {
  a: string;
  b: string;
  ohms: number;
}

export interface CircuitInput {
  instances: ComponentInstanceState[];
  /** Kunci `${instanceId}:${pinId}` → nama net. Pin yang tidak ada di peta = net sendiri (mengambang). */
  pinNets: Record<string, string>;
  sources: TheveninSource[];
  /** Tautan resistif antar net (opsional), di-stamp sebagai konduktansi. */
  links?: ResistiveLink[];
}

/** Mode pin GPIO mikrokontroler (diatur sketch yang berjalan). */
export type PinMode = 'INPUT' | 'INPUT_PULLUP' | 'INPUT_PULLDOWN' | 'OUTPUT';

export interface PinState {
  mode: PinMode;
  /** Mode OUTPUT: level digital saat ini. */
  high?: boolean;
  /** Mode OUTPUT dengan PWM: duty cycle 0..255 (mengalahkan high). */
  pwm?: number;
}

/** Profil elektrik sebuah board (batas & resolusi yang dipakai aturan). */
export interface BoardProfile {
  id: string;
  logicVolts: number;
  /** Resistansi dalam pin GPIO (ohm). */
  pinOhms: number;
  /** Arus maksimum per pin GPIO (mA) sebelum pin rusak. */
  pinMaxMa: number;
  adcBits: number;
  adcRefVolts: number;
  /** Ambang tegangan pin dibaca HIGH (V). */
  digitalThresholdVolts: number;
  /** Resistansi pull-up internal (ohm). */
  pullupOhms: number;
}

export interface CircuitSolution {
  /** Tegangan semua net (termasuk 'GND': 0). */
  voltages: Map<string, number>;
  /** Hasil per instance, kunci = instanceId. */
  results: Map<string, ComponentSimResult>;
  /** Laporan kerusakan baru pada tick ini. */
  damageEvents: Array<{ instanceId: string; report: DamageReport }>;
  /**
   * Self-healing solver: diisi bila SEMUA tangga pemulihan gagal
   * (buang tebakan awal → gmin bertingkat). Saat terisi, voltages &
   * results adalah solusi jujur serba-0 yang hingga — NaN/Infinity
   * tidak pernah bocor ke UI. Tidak terisi (undefined) = solve sehat.
   */
  solveError?: string;
}
