import { useMemo, useState } from 'react';
import { CATALOG, CATEGORY_LABEL_ID, type ComponentMeta } from './catalogData';
import { useCircuitStore } from '../features/wiring/store/circuitStore';
import type { ComponentCategory } from '../shared/types';

/**
 * Panel katalog Left Dock — pola palet aset padat (Refero: Tinkercad/Figma
 * assets panel; mode Operate: scanability di atas ekspresi).
 *
 * Header tetap di atas panel: judul, pencarian instan, tab kategori.
 * Badan: grup per kategori dengan grid 2 kolom tile ringkas. Seluruh tile
 * adalah tombol Pasang (klik lagi membatalkan mode pasang). Deskripsi
 * panjang hanya hidup di tooltip `title` — bukan paragraf di kartu.
 */

type TabId = ComponentCategory | 'semua';

/** Kategori yang benar-benar terpakai data, mengikuti urutan label kanonis. */
const USED_CATEGORIES = (Object.keys(CATEGORY_LABEL_ID) as ComponentCategory[]).filter(
  (category) => CATALOG.some((meta) => meta.category === category),
);

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
    <section className="flex min-h-0 flex-1 flex-col">
      {/* ===== Header tetap: judul + pencarian + tab kategori ===== */}
      <div className="shrink-0 border-b border-border-subtle px-3 pb-3 pt-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-[13px] font-semibold text-zinc-100">Katalog Komponen</h2>
          <span className="text-[11px] text-zinc-500">{CATALOG.length} komponen</span>
        </div>
        <p className="mt-0.5 px-1 text-[11px] leading-snug text-zinc-500">
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
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500"
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
            className="h-8 w-full rounded-md border border-border-subtle bg-panel-elevated pl-8 pr-2.5 text-[13px] text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-accent-primary"
          />
        </div>

        <div
          className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter kategori komponen"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'semua' && !normalizedQuery}
            onClick={() => pickTab('semua')}
            className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
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
              role="tab"
              aria-selected={tab === category && !normalizedQuery}
              onClick={() => pickTab(category)}
              className={`h-7 shrink-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
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

      {/* ===== Badan: grup kategori + grid tile (scroll sendiri) ===== */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {isEmpty ? (
          <p className="px-1 py-6 text-center text-xs leading-relaxed text-zinc-500">
            Tidak ada komponen cocok.
            {normalizedQuery && (
              <>
                <br />
                Coba kata kunci lain, misalnya “sensor” atau “LED”.
              </>
            )}
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.category}>
                <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {CATEGORY_LABEL_ID[group.category]}
                </h3>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {group.items.map((meta) => {
                    const active = placingType === meta.type;
                    return (
                      <button
                        key={meta.type}
                        type="button"
                        title={meta.descriptionId}
                        aria-pressed={active}
                        onClick={() => setPlacing(active ? null : meta.type)}
                        className={`flex min-h-[52px] flex-col justify-center gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? 'border-accent-primary bg-accent-primary/10'
                            : 'border-border-subtle bg-panel-elevated hover:border-zinc-500'
                        }`}
                      >
                        <span
                          className={`text-[13px] font-medium leading-tight ${
                            active ? 'text-accent-primary' : 'text-zinc-100'
                          }`}
                        >
                          {meta.name}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {meta.pins.length} pin
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
