import type { ComponentType, SVGProps } from 'react';

/**
 * Ikon katalog komponen — SATU file, SVG inline per tipe komponen
 * (SINTESIS-FINAL §F). Semua glyph memakai viewBox 0 0 64 48 dan digambar
 * sebagai siluet FILL dua-nada datar yang diturunkan dari bentuk komponen
 * aslinya: warna material asli + satu nada shade, pin selalu abu metal
 * #9AA3B2, outline #282E3D 1.5px, maksimal 2 detail khas per komponen.
 *
 * Glyph murni dekoratif: nama komponen selalu dibawa teks tile, jadi
 * setiap svg `aria-hidden` (A4 I-10 — teks alternatif dobel hanya
 * menambah kebisingan screen reader).
 *
 * Kunci record = `type` pada meta katalog (catalogData.ts), persis 20 tipe.
 */

export type CatalogIconProps = SVGProps<SVGSVGElement>;
export type CatalogIcon = ComponentType<CatalogIconProps>;

const OUTLINE = '#282E3D';
const PIN = '#9AA3B2';
/** Plastik hitam komponen (TO-92, buzzer, saklar) + nada shade-nya. */
const BODY_DARK = '#262B38';
const SHADE_DARK = '#171B24';

function ResistorIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="4" y1="24" x2="20" y2="24" stroke={PIN} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="44" y1="24" x2="60" y2="24" stroke={PIN} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="20" y="16.5" width="24" height="15" rx="4" fill="#C89B6A" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Gelang nilai 220 Ω memakai warna gelang asli: merah, merah, cokelat, emas. */}
      <rect x="25" y="16.5" width="3" height="15" fill="#EF4444" />
      <rect x="29.5" y="16.5" width="3" height="15" fill="#EF4444" />
      <rect x="34" y="16.5" width="3" height="15" fill="#7C4A21" />
      <rect x="39.5" y="16.5" width="2.5" height="15" fill="#D4AF37" />
    </svg>
  );
}

function LedIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="28" y1="37" x2="28" y2="45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="36" y1="37" x2="36" y2="42.5" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 33.5 V20 a8 8 0 0 1 16 0 V33.5 Z" fill="#EF4444" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="24" y="29" width="16" height="4.5" fill="#B91C1C" />
      <rect x="21" y="33.5" width="22" height="3.5" rx="1.5" fill="#B91C1C" stroke={OUTLINE} strokeWidth="1.5" />
    </svg>
  );
}

function PushButtonIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="23" y1="36" x2="23" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="29" y1="36" x2="29" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="35" y1="36" x2="35" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="41" y1="36" x2="41" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <rect x="18" y="26" width="28" height="10" rx="2" fill="#343A4A" stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="32" cy="23" r="8.5" fill="#EF4444" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M23.5 23 a8.5 8.5 0 0 0 17 0 Z" fill="#B91C1C" />
    </svg>
  );
}

function PotentiometerIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <rect x="30" y="2.5" width="4" height="7.5" fill={PIN} stroke={OUTLINE} strokeWidth="1" />
      <line x1="25" y1="34" x2="25" y2="44" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="32" y1="34" x2="32" y2="44" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="39" y1="34" x2="39" y2="44" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="23" r="11.5" fill="#3B82F6" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M20.5 23 a11.5 11.5 0 0 0 23 0 Z" fill="#1D4ED8" />
      <line x1="32" y1="23" x2="27" y2="14.5" stroke="#E8EBF0" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="23" r="3.2" fill="#1D4ED8" stroke={OUTLINE} strokeWidth="1" />
    </svg>
  );
}

function CapacitorIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="28" y1="36" x2="28" y2="45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="36" y1="36" x2="36" y2="41.5" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="23" y="11" width="18" height="25" rx="3" fill="#2C4A73" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="36.5" y="14" width="3" height="19" fill={PIN} />
      <ellipse cx="32" cy="11" rx="9" ry="2.6" fill={PIN} stroke={OUTLINE} strokeWidth="1" />
      <line x1="27.5" y1="11" x2="36.5" y2="11" stroke="#5B6478" strokeWidth="1.2" />
      <line x1="32" y1="9.2" x2="32" y2="12.8" stroke="#5B6478" strokeWidth="1.2" />
    </svg>
  );
}

function DiodeIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="4" y1="24" x2="21" y2="24" stroke={PIN} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="43" y1="24" x2="60" y2="24" stroke={PIN} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="21" y="16.5" width="22" height="15" rx="3" fill={BODY_DARK} stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="22.5" y="26.5" width="19" height="3.5" rx="1.5" fill={SHADE_DARK} />
      {/* Gelang perak penanda katoda. */}
      <rect x="37.5" y="16.5" width="3.5" height="15" fill="#C7CDD8" />
    </svg>
  );
}

function TransistorIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <path d="M29 36 L27.5 45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="32" y1="36" x2="32" y2="45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M35 36 L36.5 45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      {/* TO-92: sisi kiri datar, sisi kanan melengkung. */}
      <path d="M25 13 H35 A10 11.5 0 0 1 35 36 H25 Z" fill={BODY_DARK} stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M41 18 A8.5 9.5 0 0 1 41 31" fill="none" stroke={SHADE_DARK} strokeWidth="3" />
    </svg>
  );
}

function RelayIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="25" y1="35" x2="25" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="35" x2="32" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="39" y1="35" x2="39" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <rect x="17" y="11" width="30" height="24" rx="2.5" fill="#2563EB" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="18.5" y="29.5" width="27" height="4" rx="1.5" fill="#1D4ED8" />
      {/* Label garis khas kotak relay + titik LED indikator modul. */}
      <rect x="22" y="16" width="20" height="9" fill="#E8EBF0" />
      <line x1="25" y1="19.5" x2="39" y2="19.5" stroke="#5B6478" strokeWidth="1.4" />
      <line x1="25" y1="22.5" x2="35" y2="22.5" stroke="#5B6478" strokeWidth="1.4" />
      <circle cx="42.5" cy="31.5" r="1.8" fill="#10B981" />
    </svg>
  );
}

function RgbLedIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="25.5" y1="37" x2="25.5" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="29.8" y1="37" x2="29.8" y2="45.5" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="34.2" y1="37" x2="34.2" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="38.5" y1="37" x2="38.5" y2="43" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <path d="M24 33.5 V20 a8 8 0 0 1 16 0 V33.5 Z" fill="#E8EBF0" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="24" y="30" width="16" height="3.5" fill="#C9CFDA" />
      {/* Tiga die warna kanal — pengecualian fungsional §F. */}
      <circle cx="27.5" cy="26" r="2.3" fill="#EF4444" />
      <circle cx="32" cy="26" r="2.3" fill="#22C55E" />
      <circle cx="36.5" cy="26" r="2.3" fill="#3B82F6" />
      <rect x="21" y="33.5" width="22" height="3.5" rx="1.5" fill="#B9C0CE" stroke={OUTLINE} strokeWidth="1.5" />
    </svg>
  );
}

function LdrIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="28" y1="30" x2="28" y2="43" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="36" y1="30" x2="36" y2="43" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="21" r="10" fill="#C2410C" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M22 21 a10 10 0 0 0 20 0 Z" fill="#9A3412" />
      {/* Pola gelombang jalur konduktor di wajah sensor. */}
      <path
        d="M25 17.5 c1.8 -2.6 3.7 -2.6 5.5 0 s3.7 2.6 5.5 0 s3.7 -2.6 5.5 0"
        fill="none"
        stroke="#F5D0A9"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PirIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="26" y1="36" x2="26" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="36" x2="32" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="36" x2="38" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      {/* Kubah lensa Fresnel putih di atas PCB hijau. */}
      <path d="M20.5 28 a11.5 11.5 0 0 1 23 0 Z" fill="#F1F3F6" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M23.5 21.5 a11.5 11.5 0 0 1 17 0" fill="none" stroke="#C9CFDA" strokeWidth="1.6" />
      <rect x="15" y="28" width="34" height="8" rx="1.5" fill="#15803D" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="16.5" y="32.5" width="31" height="2.5" rx="1" fill="#166534" />
    </svg>
  );
}

function Lm35Icon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <path d="M29 36 L27.5 45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="32" y1="36" x2="32" y2="45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M35 36 L36.5 45" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      {/* Bodi TO-92 sama seperti transistor; pembedanya ukiran termometer mini. */}
      <path d="M25 13 H35 A10 11.5 0 0 1 35 36 H25 Z" fill={BODY_DARK} stroke={OUTLINE} strokeWidth="1.5" />
      <line x1="33" y1="17" x2="33" y2="27" stroke="#E8EBF0" strokeWidth="2" strokeLinecap="round" />
      <circle cx="33" cy="29.5" r="2.6" fill="#E8EBF0" />
    </svg>
  );
}

function JoystickIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <rect x="30" y="13" width="4" height="18" fill="#343A4A" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="32" cy="10" r="6.5" fill="#EF4444" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M26.1 12.8 A6.5 6.5 0 0 0 37.9 12.8 Z" fill="#B91C1C" />
      <rect x="17" y="31" width="30" height="7" rx="2" fill={BODY_DARK} stroke={OUTLINE} strokeWidth="1.5" />
      <circle cx="21" cy="34.5" r="1.1" fill={PIN} />
      <circle cx="43" cy="34.5" r="1.1" fill={PIN} />
    </svg>
  );
}

function SoilMoistureIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      {/* Dua kaki probe panjang perpanjangan PCB itu sendiri. */}
      <rect x="26" y="16" width="4.5" height="27" rx="2" fill="#2563EB" stroke={OUTLINE} strokeWidth="1.2" />
      <rect x="33.5" y="16" width="4.5" height="27" rx="2" fill="#2563EB" stroke={OUTLINE} strokeWidth="1.2" />
      <rect x="22" y="5" width="20" height="13" rx="2" fill="#2563EB" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="23.5" y="13.5" width="17" height="3" rx="1" fill="#1D4ED8" />
      <circle cx="27" cy="9" r="1.2" fill="#E8EBF0" />
      <circle cx="32" cy="9" r="1.2" fill="#E8EBF0" />
      <circle cx="37" cy="9" r="1.2" fill="#E8EBF0" />
    </svg>
  );
}

function ServoIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="28" y1="35" x2="28" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="35" x2="32" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="36" y1="35" x2="36" y2="44" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <rect x="14" y="19" width="6" height="7" fill="#3B82F6" stroke={OUTLINE} strokeWidth="1.2" />
      <rect x="44" y="19" width="6" height="7" fill="#3B82F6" stroke={OUTLINE} strokeWidth="1.2" />
      <rect x="20" y="14" width="24" height="21" rx="2" fill="#3B82F6" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="21.5" y="29.5" width="21" height="4" rx="1.5" fill="#1D4ED8" />
      {/* Horn putih berlubang di atas poros keluaran. */}
      <rect x="32.8" y="10.5" width="2.4" height="3.5" fill={PIN} />
      <rect x="23" y="6.5" width="22" height="4.5" rx="2.25" fill="#F1F3F6" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="28" cy="8.75" r="0.9" fill={OUTLINE} />
      <circle cx="40" cy="8.75" r="0.9" fill={OUTLINE} />
    </svg>
  );
}

function DcMotorIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="21" y1="31" x2="21" y2="41" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <line x1="27" y1="31" x2="27" y2="41" stroke={PIN} strokeWidth="2" strokeLinecap="round" />
      <rect x="16" y="15" width="30" height="17" rx="8" fill="#B9C0CE" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="21.5" y="15.8" width="4" height="15.4" fill="#8A93A5" />
      <rect x="39.5" y="15.8" width="3.5" height="15.4" fill="#8A93A5" />
      {/* Poros keluaran di ujung kanan kaleng motor. */}
      <rect x="46" y="22.3" width="9" height="2.6" fill="#7C8595" stroke={OUTLINE} strokeWidth="0.8" />
    </svg>
  );
}

function BuzzerIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="28" y1="33" x2="28" y2="44" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="36" y1="33" x2="36" y2="44" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="32" cy="21" r="12.5" fill={BODY_DARK} stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M20.3 25.5 A12.5 12.5 0 0 0 43.7 25.5 Z" fill={SHADE_DARK} />
      {/* Lubang suara di tengah cakram + tanda plus polaritas. */}
      <circle cx="32" cy="19" r="4.6" fill="#0B0D12" stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M38.5 10.8 V15.2 M36.3 13 H40.7" stroke={PIN} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SevenSegmentIcon(props: CatalogIconProps) {
  const SEG = '#7A2432';
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="25" y1="39" x2="25" y2="45" stroke={PIN} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="29" y1="39" x2="29" y2="45" stroke={PIN} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="33" y1="39" x2="33" y2="45" stroke={PIN} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="37" y1="39" x2="37" y2="45" stroke={PIN} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="41" y1="39" x2="41" y2="45" stroke={PIN} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="19" y="7" width="26" height="32" rx="2.5" fill="#232833" stroke={OUTLINE} strokeWidth="1.5" />
      {/* Angka "8" segmen redup + titik desimal. */}
      <rect x="26" y="11" width="11" height="3" rx="1.5" fill={SEG} />
      <rect x="26" y="21.5" width="11" height="3" rx="1.5" fill={SEG} />
      <rect x="26" y="32" width="11" height="3" rx="1.5" fill={SEG} />
      <rect x="24.8" y="14.8" width="3" height="6.5" rx="1.5" fill={SEG} />
      <rect x="35.2" y="14.8" width="3" height="6.5" rx="1.5" fill={SEG} />
      <rect x="24.8" y="24.8" width="3" height="6.5" rx="1.5" fill={SEG} />
      <rect x="35.2" y="24.8" width="3" height="6.5" rx="1.5" fill={SEG} />
      <circle cx="41.3" cy="33.8" r="1.7" fill={SEG} />
    </svg>
  );
}

function FuseIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <line x1="3" y1="24" x2="14" y2="24" stroke={PIN} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="50" y1="24" x2="61" y2="24" stroke={PIN} strokeWidth="2.5" strokeLinecap="round" />
      {/* Tabung kaca dengan kawat filamen zigzag + tutup logam di kedua ujung. */}
      <rect x="19.5" y="18.5" width="25" height="11" rx="5.5" fill="#C7CDD8" stroke={OUTLINE} strokeWidth="1.5" />
      <path
        d="M19.5 24 H29 l2.5 -2.5 2.5 5 2.5 -2.5 H44.5"
        fill="none"
        stroke="#5B6478"
        strokeWidth="1.4"
      />
      <rect x="13" y="17" width="6.5" height="14" rx="2" fill="#7C8595" stroke={OUTLINE} strokeWidth="1.5" />
      <rect x="44.5" y="17" width="6.5" height="14" rx="2" fill="#7C8595" stroke={OUTLINE} strokeWidth="1.5" />
    </svg>
  );
}

function TiltSwitchIcon(props: CatalogIconProps) {
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...props}>
      <g transform="rotate(-16 32 24)">
        <line x1="44" y1="20.5" x2="56" y2="20.5" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="44" y1="27.5" x2="56" y2="27.5" stroke={PIN} strokeWidth="2.2" strokeLinecap="round" />
        {/* Tabung kuningan miring dengan bola baja terlihat di dalamnya. */}
        <rect x="18" y="17" width="27" height="14" rx="7" fill="#C9A227" stroke={OUTLINE} strokeWidth="1.5" />
        <rect x="20" y="26.5" width="23" height="3" rx="1.5" fill="#9A7B1C" />
        <circle cx="26" cy="23.5" r="3.6" fill="#7C8595" stroke={OUTLINE} strokeWidth="1" />
        <rect x="41.5" y="17" width="3" height="14" fill="#9A7B1C" />
      </g>
    </svg>
  );
}

/** Peta ikon per `type` komponen — persis 20 tipe katalog. */
export const CATALOG_ICONS: Record<string, CatalogIcon> = {
  resistor: ResistorIcon,
  'led-5mm': LedIcon,
  'push-button': PushButtonIcon,
  potentiometer: PotentiometerIcon,
  capacitor: CapacitorIcon,
  diode: DiodeIcon,
  transistor: TransistorIcon,
  relay: RelayIcon,
  'rgb-led': RgbLedIcon,
  ldr: LdrIcon,
  pir: PirIcon,
  lm35: Lm35Icon,
  joystick: JoystickIcon,
  'soil-moisture': SoilMoistureIcon,
  servo: ServoIcon,
  'dc-motor': DcMotorIcon,
  buzzer: BuzzerIcon,
  'seven-segment': SevenSegmentIcon,
  fuse: FuseIcon,
  'tilt-switch': TiltSwitchIcon,
};
