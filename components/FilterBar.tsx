"use client";

import { useState } from "react";
import Modal from "./Modal";
import { SlidersIcon } from "./Icons";
import {
  CATEGORIES,
  COLORS,
  FORMALITIES,
  SEASONS,
  STANDARD_LOCATIONS,
  STATUSES,
} from "@/lib/taxonomy";
import { knownLocations } from "@/lib/wardrobe";
import type { Filters, SortKey } from "@/lib/types";
import { EMPTY_FILTERS } from "@/lib/types";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  facets: { brands: string[]; tags: string[]; locations: string[] };
  resultCount: number;
}

const SORTS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "neglected", label: "Longest unworn" },
  { id: "mostWorn", label: "Most worn" },
  { id: "leastWorn", label: "Least worn" },
  { id: "name", label: "A – Z" },
];

const NOT_WORN_OPTIONS = [
  { days: 30, label: "30+ days" },
  { days: 90, label: "3+ months" },
  { days: 180, label: "6+ months" },
  { days: 365, label: "A year+" },
];

/** Everything narrowing the grid except the category rail, which stays visible. */
function activeCount(f: Filters) {
  return (
    f.seasons.length +
    f.colors.length +
    f.brands.length +
    f.tags.length +
    f.formality.length +
    f.statuses.length +
    f.locations.length +
    (f.favoritesOnly ? 1 : 0) +
    (f.notWornDays !== null ? 1 : 0) +
    (f.neverWorn ? 1 : 0) +
    (f.includeArchived ? 1 : 0)
  );
}

export default function FilterBar({
  filters,
  onChange,
  facets,
  resultCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const count = activeCount(filters);

  function toggle<
    K extends
      | "categories"
      | "seasons"
      | "colors"
      | "brands"
      | "tags"
      | "formality"
      | "statuses"
      | "locations",
  >(key: K, value: Filters[K][number]) {
    const list = filters[key] as Filters[K][number][];
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
    onChange({ ...filters, [key]: next } as Filters);
  }

  function clearAll() {
    onChange({
      ...EMPTY_FILTERS,
      search: filters.search,
      sort: filters.sort,
    });
  }

  return (
    <div>
      {/* One row does all the narrowing: a pinned Filters button, then the
          category rail scrolling beside it. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-active={count > 0}
          className="chip shrink-0"
        >
          <SlidersIcon className="h-3.5 w-3.5" />
          Filters
          {count > 0 && (
            <span className="rounded-full bg-sage-bright px-1.5 text-[10px] font-bold text-on-sage">
              {count}
            </span>
          )}
        </button>

        <div className="fade-rail no-scrollbar -mr-4 flex gap-2 overflow-x-auto pr-4 sm:mr-0 sm:pr-0">
          <button
            type="button"
            onClick={() => onChange({ ...filters, categories: [] })}
            data-active={filters.categories.length === 0}
            className="chip"
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle("categories", c.id)}
              data-active={filters.categories.includes(c.id)}
              className="chip"
            >
              <span aria-hidden>{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {open && (
        <Modal
          title="Filters"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearAll}
                disabled={count === 0}
                className="text-sm font-medium text-berry underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-primary ml-auto"
              >
                Show {resultCount} {resultCount === 1 ? "piece" : "pieces"}
              </button>
            </div>
          }
        >
          <div className="space-y-5 p-5">
            <div>
              <label className="label" htmlFor="sort">
                Order
              </label>
              <select
                id="sort"
                value={filters.sort}
                onChange={(e) =>
                  onChange({ ...filters, sort: e.target.value as SortKey })
                }
                className="field"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="eyebrow mb-2">Season</p>
              <div className="flex flex-wrap gap-1.5">
                {SEASONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle("seasons", s.id)}
                    data-active={filters.seasons.includes(s.id)}
                    className="chip"
                  >
                    <span aria-hidden>{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filters,
                      favoritesOnly: !filters.favoritesOnly,
                    })
                  }
                  data-active={filters.favoritesOnly}
                  className="chip"
                >
                  ♥ Loved
                </button>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Colour</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => {
                  const active = filters.colors.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle("colors", c.id)}
                      title={c.label}
                      aria-label={c.label}
                      aria-pressed={active}
                      className={`h-7 w-7 rounded-full ring-1 ring-inset transition-all ${
                        active
                          ? "ring-2 ring-ink ring-offset-2 ring-offset-shell"
                          : "ring-ink/15 hover:scale-110"
                      }`}
                      style={{ background: c.hex }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Where it&apos;s kept</p>
              <div className="flex flex-wrap gap-1.5">
                {knownLocations(facets.locations, STANDARD_LOCATIONS).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggle("locations", loc)}
                    data-active={filters.locations.includes(loc)}
                    className="chip"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Laundry</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggle("statuses", st.id)}
                    data-active={filters.statuses.includes(st.id)}
                    className="chip"
                  >
                    <span aria-hidden>{st.emoji}</span>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Not worn in…</p>
              <div className="flex flex-wrap gap-1.5">
                {NOT_WORN_OPTIONS.map((o) => (
                  <button
                    key={o.days}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        notWornDays:
                          filters.notWornDays === o.days ? null : o.days,
                      })
                    }
                    data-active={filters.notWornDays === o.days}
                    className="chip"
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...filters, neverWorn: !filters.neverWorn })
                  }
                  data-active={filters.neverWorn}
                  className="chip"
                >
                  Never worn
                </button>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-2">Dress code</p>
              <div className="flex flex-wrap gap-1.5">
                {FORMALITIES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggle("formality", f.id)}
                    data-active={filters.formality.includes(f.id)}
                    className="chip"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {facets.brands.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Brand</p>
                <div className="flex flex-wrap gap-1.5">
                  {facets.brands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggle("brands", b)}
                      data-active={filters.brands.includes(b)}
                      className="chip"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {facets.tags.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {facets.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggle("tags", t)}
                      data-active={filters.tags.includes(t)}
                      className="chip"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2 border-t border-line pt-4 text-sm">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={(e) =>
                  onChange({ ...filters, includeArchived: e.target.checked })
                }
                className="h-4 w-4 accent-[var(--color-berry)]"
              />
              Include archived pieces
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
