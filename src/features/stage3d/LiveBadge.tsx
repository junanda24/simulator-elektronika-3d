import { memo, type ComponentType, type CSSProperties } from 'react';
import { Html } from '@react-three/drei';
import type { BoardProfile, ComponentInstanceState } from '../../shared/types';
import { getBoardDefinition } from '../../shared/boards/definitions';
import { useCircuitStore } from '../wiring/store/circuitStore';
import { useUiSettings } from '../../app/uiSettings';

/**
 * Badge nilai live di atas komponen bintang (gelombang RASA-1, mengadopsi
 * badge melayang situs referensi learn-arduino-red). SEMUA angka berasal
 * dari hasil solver nyata (pinVoltages / branchCurrents di simState) atau
 * derivasi yang persis sama dengan yang dipakai model 3D / runtime sketch:
 *  - servo          : branchCurrents['angle'] — nilai yang sama yang
 *                     memutar tanduk di ServoRender3D.
 *  - dc-motor       : pinVoltages PLUS − MINUS (tegangan motor; model
 *                     berputar sebanding arus 'main', tak ada derivasi
 *                     duty di model, jadi yang ditampilkan tegangan).
 *  - potentiometer  : ADC dari pinVoltages['WIPER'] memakai rumus
 *                     analogRead runtime (runtime.ts) + BoardProfile aktif.
 *  - rgb-led        : branchCurrents 'r'/'g'/'b' (kunci yang sama yang
 *                     menggerakkan emissive kubah di RgbLedRender3D).
 *  - ldr            : pinVoltages['B'] — kaki titik tengah pembagi yang
 *                     dibaca A0 pada Modul 11 — + ADC rumus yang sama.
 *  - buzzer         : branchCurrents['main'] (arus osilator aktif).
 * Tidak ada fisika atau angka panggung baru yang dikarang di sini.
 */

/** Tipe yang mendapat badge; juga dipakai menghitung peringkat tampilan. */
export const BADGE_TYPES: ReadonlySet<string> = new Set([
  'servo',
  'dc-motor',
  'potentiometer',
  'rgb-led',
  'ldr',
  'buzzer',
]);

/** Maksimum badge tampil serentak (di luar yang sedang dipilih). */
const MAX_BADGES = 6;

/** Ambang "ada nilai bermakna": di bawah ini badge disembunyikan. */
const MIN_VOLTS = 0.05;
const MIN_RGB_MA = 0.05;
const MIN_BUZZER_MA = 0.5;

/** Angka ke format Indonesia: koma desimal (4,87 bukan 4.87). */
function fmt(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

function finite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Konversi tegangan → hitungan ADC. Rumus disalin persis dari analogRead
 * di src/features/sketch/runtime.ts: clamp 0..1 terhadap adcRefVolts,
 * diskalakan ke 2^adcBits − 1, dibulatkan.
 */
function adcOf(volts: number, profile: BoardProfile): number {
  const maxCount = 2 ** profile.adcBits - 1;
  const ratio = Math.min(1, Math.max(0, volts / profile.adcRefVolts));
  return Math.round(ratio * maxCount);
}

/**
 * Teks badge untuk satu instance, atau null bila datanya belum ada /
 * tidak bermakna (belum pernah disolve, rangkaian mati, nilai ~0).
 * Murni dari simState + profil board aktif.
 */
export function computeBadgeText(
  instance: ComponentInstanceState,
  profile: BoardProfile,
): string | null {
  const pv = instance.simState.pinVoltages;
  const bc = instance.simState.branchCurrents;

  switch (instance.type) {
    case 'servo': {
      const angle = bc['angle'];
      if (!finite(angle)) return null;
      return `${Math.round(angle)}°`;
    }
    case 'dc-motor': {
      if (!finite(pv['PLUS']) || !finite(pv['MINUS'])) return null;
      const volts = pv['PLUS'] - pv['MINUS'];
      if (Math.abs(volts) < MIN_VOLTS) return null;
      return `${fmt(volts, 2)} V`;
    }
    case 'potentiometer': {
      if (!finite(pv['WIPER'])) return null;
      // Gerbang bermakna: potensiometer benar-benar berada di rangkaian
      // bertegangan (salah satu ujung jalurnya hidup), bukan melayang.
      const live = Math.max(Math.abs(pv['A'] ?? 0), Math.abs(pv['B'] ?? 0));
      if (live < MIN_VOLTS) return null;
      return `ADC ${adcOf(pv['WIPER'], profile)}`;
    }
    case 'rgb-led': {
      if (!finite(bc['r']) && !finite(bc['g']) && !finite(bc['b'])) return null;
      const r = (bc['r'] ?? 0) * 1000;
      const g = (bc['g'] ?? 0) * 1000;
      const b = (bc['b'] ?? 0) * 1000;
      if (Math.max(r, g, b) < MIN_RGB_MA) return null;
      return `R ${fmt(r, 1)} · G ${fmt(g, 1)} · B ${fmt(b, 1)} mA`;
    }
    case 'ldr': {
      if (!finite(pv['B'])) return null;
      const live = Math.max(Math.abs(pv['A'] ?? 0), Math.abs(pv['B']));
      if (live < MIN_VOLTS) return null;
      return `${fmt(pv['B'], 2)} V · ADC ${adcOf(pv['B'], profile)}`;
    }
    case 'buzzer': {
      const main = bc['main'];
      if (!finite(main)) return null;
      const ma = Math.abs(main) * 1000;
      if (ma < MIN_BUZZER_MA) return null;
      return `${fmt(ma, 1)} mA`;
    }
    default:
      return null;
  }
}

const PILL_STYLE: CSSProperties = {
  background: 'rgba(18, 21, 28, 0.95)',
  border: '1px solid #282E3D',
  borderRadius: 999,
  padding: '5px 11px',
  color: '#F4F4F5',
  fontFamily: "'JetBrains Mono', monospace",
  fontVariantNumeric: 'tabular-nums',
  // Standar keterbacaan indikator melayang (audit hover): 13px semibold di
  // ruang layar — JANGAN pakai distanceFactor di Html, teks menyusut
  // mengikuti zoom dan jadi tak terbaca (keluhan user 2026-10-21).
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
  userSelect: 'none',
  pointerEvents: 'none',
};

const PILL_DAMAGED_STYLE: CSSProperties = {
  ...PILL_STYLE,
  border: '1px solid #FF2A54',
  color: '#FECDD3',
};

/**
 * Pill DOM badge, di-memo pada STRING hasil format: snapshot simulasi
 * boleh datang 60×/detik, pill hanya benar-benar render ulang bila teks
 * tampilnya berubah (atau status rusaknya berbalik).
 */
const BadgePill = memo(function BadgePill({
  text,
  damaged,
}: {
  text: string;
  damaged: boolean;
}) {
  return (
    <div style={damaged ? PILL_DAMAGED_STYLE : PILL_STYLE}>
      {damaged ? `${text} · RUSAK` : text}
    </div>
  );
});

export interface LiveBadgeProps {
  instance: ComponentInstanceState;
  /** Offset Y lokal di atas komponen (mengikuti tinggi model per tipe). */
  y: number;
}

/**
 * Badge live satu instance. Dirender dari dalam model 3D tipe bintang.
 * Aturan tampil: flag showBadges menyala DAN ada teks bermakna DAN
 * (instance sedang dipilih — selalu tampil — ATAU simulasi berjalan dan
 * peringkat instance di antara tipe-badge ≤ 6 pertama urutan pembuatan).
 * Langganan store memakai selector boolean/angka agar komponen ini tidak
 * ikut render ulang oleh snapshot yang tidak mengubah nasibnya.
 * Tanpa animasi masuk (reduced-motion aman secara bawaan).
 */
export const LiveBadge: ComponentType<LiveBadgeProps> = ({ instance, y }) => {
  const showBadges = useUiSettings((s) => s.showBadges);
  const running = useCircuitStore((s) => s.running);
  const boardId = useCircuitStore((s) => s.boardId);
  const instanceId = instance.id;
  // 2 = sedang dipilih (selalu tampil), 1 = masuk 6 pertama, 0 = sisanya.
  const rankState = useCircuitStore((s) => {
    if (s.selectedInstanceId === instanceId) return 2;
    let rank = 0;
    for (const inst of s.instances) {
      if (!BADGE_TYPES.has(inst.type)) continue;
      if (inst.id === instanceId) return rank < MAX_BADGES ? 1 : 0;
      rank += 1;
    }
    return 0;
  });

  if (!showBadges) return null;
  if (rankState === 0) return null;
  if (rankState === 1 && !running) return null;

  const profile = getBoardDefinition(boardId).profile;
  const text = computeBadgeText(instance, profile);
  if (text === null) return null;

  return (
    <Html
      center
      zIndexRange={[90, 0]}
      position={[0, y, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <BadgePill text={text} damaged={instance.simState.isDamaged} />
    </Html>
  );
};
