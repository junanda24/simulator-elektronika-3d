import type { BoardProfile } from '../types';

/**
 * Profil elektrik board — sumber angka untuk solver & aturan kerusakan.
 * Batch 3 menambahkan ESP32, NodeMCU, Pico (logika 3,3 V).
 */
export const UNO_PROFILE: BoardProfile = {
  id: 'uno',
  logicVolts: 5,
  pinOhms: 25,
  pinMaxMa: 40,
  adcBits: 10,
  adcRefVolts: 5,
  digitalThresholdVolts: 3.0,
  pullupOhms: 20000,
};

export const BOARD_PROFILES: Record<string, BoardProfile> = {
  uno: UNO_PROFILE,
};
