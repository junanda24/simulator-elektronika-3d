import { useMemo, useState } from 'react';
import { CATALOG, CATEGORY_LABEL_ID, type ComponentMeta } from './catalogData';
import { CATALOG_ICONS } from './catalogIcons';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import type { ComponentCategory } from '../shared/types';

/**
 * Panel katalog — palet komponen Floating Studio HUD (SINTESIS-FINAL §F).
 *
 * Panel 100% katalog: header tetap (judul, pencarian instan, pill
 * kategori flex-wrap), badan berupa grup per kategori dengan grid
 * 2 kolom tile ikon h-[88px] (glyph SVG dari catalogIcons.tsx, nama
 * pendek 1 baris, baris mono spesifikasi kunci + jumlah pin). Seluruh
 * tile adalah tombol Pasang (klik lagi membatalkan mode pasang);
 * nama penuh + deskripsi panjang hidup di tooltip `title`, deskripsi
 * tetap masuk indeks pencarian. Root h-full w-full — posisi dan
 * permukaan panel diatur kontainer pembungkus di App.
 */

type TabId = ComponentCategory | 'semua';

/** Kategori yang benar-benar terpakai data, mengikuti urutan label kanonis. */
const USED_CATEGORIES = (Object.keys(CATEGORY_LABEL_ID) as ComponentCategory[]).filter(
  (category) => CATALOG.some((meta) => meta.category === category),
);

/**
 * Nama pendek 1 baris + spesifikasi kunci per tipe untuk tile ikon.
 * Nilai diambil dari meta katalog (nilai bawaan, rating, varian) —
 * nama penuh tetap tampil di tooltip dan hasil pencarian.
 */
const TILE_INFO: Record<string, { shortName: string; spec: string }> = {
  resistor: { shortName: 'Resistor', spec: '220 Ω' },
  'led-5mm': { shortName: 'LED 5mm', spec: 'Merah' },
  'push-button': { shortName: 'Push Button', spec: 'Sesaat' },
  potentiometer: { shortName: 'Potensiometer', spec: '10 kΩ' },
  capacitor: { shortName: 'Kapasitor', spec: '100 µF' },
  diode: { shortName: 'Dioda 1N4007', spec: '0,7 V' },
  transistor: { shortName: 'Transistor NPN', spec: 'β 100' },
  relay: { shortName: 'Relay 5V', spec: 'Koil 5 V' },
  'rgb-led': { shortName: 'LED RGB', spec: '3 kanal' },
  ldr: { shortName: 'LDR', spec: 'Cahaya' },
  pir: { shortName: 'Sensor PIR', spec: 'Gerak' },
  lm35: { shortName: 'LM35', spec: '10 mV/°C' },
  joystick: { shortName: 'Joystick', spec: '2 sumbu' },
  'soil-moisture': { shortName: 'Sensor Tanah', spec: 'Analog' },
  servo: { shortName: 'Servo SG90', spec: '0–180°' },
  'dc-motor': { shortName: 'Motor DC', spec: 'DC' },
  buzzer: { shortName: 'Buzzer', spec: 'Aktif 5 V' },
  'seven-segment': { shortName: '7-Segment', spec: '1 digit' },
  fuse: { shortName: 'Sekering', spec: '500 mA' },
  'tilt-switch': { shortName: 'Tilt Switch', spec: 'Bola logam' },
  'ntc-thermistor': { shortName: 'Termistor NTC', spec: '10 kΩ · B3950' },
  'reed-switch': { shortName: 'Reed Switch', spec: 'Magnet NO' },
  'fc-51': { shortName: 'Sensor Halangan FC-51', spec: 'IR · aktif-rendah' },
  'ky-003': { shortName: 'Sensor Hall KY-003', spec: 'A3144 · open-collector' },
  mosfet: { shortName: 'MOSFET IRLZ44N', spec: 'TO-220 · logic-level' },
  'flame-sensor': { shortName: 'Sensor Api KY-026', spec: 'IR · AO/DO' },
  'rain-sensor': { shortName: 'Sensor Hujan MH-RD', spec: 'AO/DO' },
  mq2: { shortName: 'Sensor Gas MQ-2', spec: 'ppm · AO/DO' },
  'sound-sensor': { shortName: 'Sensor Suara KY-038', spec: 'AO/DO' },
  'led-bar-graph': { shortName: 'LED Bar Graph', spec: '10 segmen DC-10EWA' },
  'regulator-7805': { shortName: 'Regulator L7805', spec: 'TO-220 · 5 V' },
  'battery-9v': { shortName: 'Baterai 9V', spec: '6LR61 · di alas' },
  'hc-sr04': { shortName: 'Ultrasonik HC-SR04', spec: '2–400 cm' },
};

function matchesQuery(meta: ComponentMeta, query: string): boolean {
  const haystack = `${meta.name} ${meta.descriptionId}`.toLowerCase();
  return haystack.includes(query);
}

export default function CatalogPanel() {
  const placingType = useCircuitStore((s) => s.placingType);
  const setPlacing = useCircuitStore((s) => s.setPlacing);
  const [tab, setTab] = useState<TabId>('semua');
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  // Pencarian bersifat global lintas kategori (tab diabaikan saat mencari);
  // memilih tab membersihkan kueri agar hasil tidak membingungkan.
  const groups = useMemo(() => {
    return USED_CATEGORIES.map((category) => {
      const items = CATALOG.filter((meta) => {
        if (meta.category !== category) return false;
        if (normalizedQuery) return matchesQuery(meta, normalizedQuery);
        return tab === 'semua' || tab === category;
      });
      return { category, items };
    }).filter((group) => group.items.length > 0);
  }, [tab, normalizedQuery]);

  const isEmpty = groups.length === 0;

  const pickTab = (next: TabId) => {
    setTab(next);
    setQuery('');
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col">
      {/* ===== Header tetap: judul + pencarian + pill kategori ===== */}
      <div className="shrink-0 border-b border-border-subtle px-3 pb-3 pt-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-[13px] font-semibold text-zinc-100">Katalog Komponen</h2>
          <span className="text-[11px] text-zinc-400">{CATALOG.length} komponen</span>
        </div>
        <p className="mt-0.5 px-1 text-[11px] leading-snug text-zinc-400">
          Klik komponen, lalu klik lubang breadboard.
        </p>

        <div className="relative mt-2.5">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari komponen…"
            aria-label="Cari komponen"
            className="h-8 w-full rounded-md border border-[#5B6478] bg-panel-elevated pl-8 pr-2.5 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-accent-primary"
          />
        </div>

        {/* Kategori = tombol toggle aria-pressed, flex-wrap agar semua
            kategori selalu terlihat (bukan pola tablist — A4 I-2). */}
        <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Filter kategori komponen">
          <button
            type="button"
            aria-pressed={tab === 'semua' && !normalizedQuery}
            onClick={() => pickTab('semua')}
            className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-[color,background-color,border-color,transform] active:scale-[0.96] ${
              tab === 'semua' && !normalizedQuery
                ? 'border-accent-primary/60 bg-accent-primary/15 text-accent-primary'
                : 'border-border-subtle text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
            }`}
          >
            Semua
          </button>
          {USED_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={tab === category && !normalizedQuery}
              onClick={() => pickTab(category)}
              className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-[color,background-color,border-color,transform] active:scale-[0.96] ${
                tab === category && !normalizedQuery
                  ? 'border-accent-primary/60 bg-accent-primary/15 text-accent-primary'
                  : 'border-border-subtle text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {CATEGORY_LABEL_ID[category]}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Badan: grup kategori + grid tile ikon (scroll sendiri) ===== */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isEmpty ? (
          <p className="px-1 py-6 text-center text-xs leading-relaxed text-zinc-400">
            Tidak ada komponen cocok.
            {normalizedQuery && (
              <>
                <br />
                Coba kata kunci lain, misalnya “sensor” atau “LED”.
              </>
            )}
          </p>
        ) : (
          <div key={tab} className="hud-content-enter space-y-4">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  {CATEGORY_LABEL_ID[group.category]}
                </h3>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {group.items.map((meta) => {
                    const active = placingType === meta.type;
                    const Icon = CATALOG_ICONS[meta.type];
                    const info = TILE_INFO[meta.type];
                    const shortName = info?.shortName ?? meta.name;
                    const specLine = info?.spec
                      ? `${info.spec} · ${meta.pins.length} pin`
                      : `${meta.pins.length} pin`;
                    return (
                      <button
                        key={meta.type}
                        type="button"
                        title={`${meta.name} — ${meta.descriptionId}`}
                        aria-pressed={active}
                        onClick={() => setPlacing(active ? null : meta.type)}
                        className={`flex h-[88px] flex-col items-center justify-center rounded-lg border px-1.5 py-1.5 text-center transition-[transform,border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.34,1.3,0.64,1)] hover:-translate-y-[2px] hover:shadow-[0_6px_16px_rgb(0_0_0/0.35)] active:scale-[0.97] active:duration-[120ms] ${
                          active
                            ? 'tile-pulse border-accent-primary bg-accent-primary/10'
                            : 'border-[#5B6478] bg-panel-elevated hover:border-zinc-400'
                        }`}
                      >
                        {Icon ? <Icon className="h-[38px] w-[50px] shrink-0" /> : null}
                        <span
                          className={`mt-0.5 w-full truncate text-[13px] font-medium leading-tight ${
                            active ? 'text-accent-primary' : 'text-zinc-100'
                          }`}
                        >
                          {shortName}
                        </span>
                        <span className="w-full truncate font-mono text-[10px] leading-tight text-zinc-400">
                          {specLine}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
