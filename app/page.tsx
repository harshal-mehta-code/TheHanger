"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClosetPulse from "@/components/ClosetPulse";
import FilterBar from "@/components/FilterBar";
import ItemCard from "@/components/ItemCard";
import ItemDetail from "@/components/ItemDetail";
import ItemEditor from "@/components/ItemEditor";
import SettingsMenu from "@/components/SettingsMenu";
import {
  HangerMark,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
} from "@/components/Icons";
import { useCloset } from "@/lib/store";
import { EMPTY_FILTERS, type Filters, type Item } from "@/lib/types";
import {
  collectFacets,
  computeStats,
  currentSeason,
  filterItems,
  sortItems,
} from "@/lib/wardrobe";
import { SEASON_LABEL } from "@/lib/taxonomy";

type Editing = { mode: "new" } | { mode: "edit"; item: Item } | null;

export default function ClosetPage() {
  const {
    items,
    ready,
    error,
    addItem,
    updateItem,
    deleteItem,
    toggleFavorite,
    toggleArchived,
    logWear,
    removeWear,
  } = useCloset();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Editing>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [justWornId, setJustWornId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const wornTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (wornTimer.current) clearTimeout(wornTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // "/" focuses search, the way every gallery app should behave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const facets = useMemo(() => collectFacets(items), [items]);
  const stats = useMemo(() => computeStats(items), [items]);
  const visible = useMemo(
    () => sortItems(filterItems(items, filters), filters.sort),
    [items, filters],
  );

  const openItem = openId ? items.find((i) => i.id === openId) ?? null : null;
  const season = currentSeason();

  const handleWear = useCallback(
    async (item: Item) => {
      await logWear(item.id);
      setJustWornId(item.id);
      if (wornTimer.current) clearTimeout(wornTimer.current);
      wornTimer.current = setTimeout(() => setJustWornId(null), 1600);
    },
    [logWear],
  );

  const hasCloset = items.length > 0;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 pb-24 sm:px-6">
      {/* ---------------- header ---------------- */}
      <header className="sticky top-0 z-30 -mx-4 mb-5 bg-bone/85 px-4 pb-3 pt-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-bone">
              <HangerMark className="animate-swing h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="display truncate text-xl font-semibold leading-none sm:text-2xl">
                The Hanger
              </h1>
              <p className="mt-1 hidden text-xs text-muted sm:block">
                {hasCloset
                  ? `${stats.total} pieces · ${SEASON_LABEL[season]} in rotation`
                  : "Your wardrobe, beautifully kept"}
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
                placeholder="Search your closet…"
                aria-label="Search your closet"
                className="field w-56 rounded-full pl-9 lg:w-72"
              />
            </div>

            <SettingsMenu onNotify={flash} />

            <button
              type="button"
              onClick={() => setEditing({ mode: "new" })}
              className="btn-primary"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Add piece</span>
            </button>
          </div>
        </div>

        {/* Search moves below the wordmark on phones. */}
        <div className="relative mt-3 sm:hidden">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            placeholder="Search your closet…"
            aria-label="Search your closet"
            className="field rounded-full pl-9"
          />
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-2xl border border-berry/25 bg-berry-soft px-4 py-3 text-sm text-berry-deep"
        >
          {error}
        </p>
      )}

      {!ready ? (
        <SkeletonGrid />
      ) : !hasCloset ? (
        <EmptyCloset onAdd={() => setEditing({ mode: "new" })} />
      ) : (
        <div className="space-y-6">
          <ClosetPulse
            stats={stats}
            onShowNeglected={() =>
              setFilters((f) => ({
                ...EMPTY_FILTERS,
                sort: "neglected",
                notWornDays: 90,
                search: f.search,
              }))
            }
            onShowNeverWorn={() =>
              setFilters((f) => ({
                ...EMPTY_FILTERS,
                neverWorn: true,
                search: f.search,
              }))
            }
            onShowFavorites={() =>
              setFilters((f) => ({
                ...EMPTY_FILTERS,
                favoritesOnly: true,
                search: f.search,
              }))
            }
          />

          <FilterBar
            filters={filters}
            onChange={setFilters}
            facets={facets}
            resultCount={visible.length}
          />

          {visible.length === 0 ? (
            <NoMatches
              onClear={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((item, i) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  justWorn={justWornId === item.id}
                  onOpen={() => setOpenId(item.id)}
                  onToggleFavorite={() => void toggleFavorite(item.id)}
                  onWear={() => void handleWear(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- floating add button (mobile) ---------------- */}
      {ready && hasCloset && (
        <button
          type="button"
          onClick={() => setEditing({ mode: "new" })}
          aria-label="Add a piece"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bone shadow-[var(--shadow-lift)] transition-transform active:scale-95 sm:hidden"
        >
          <PlusIcon className="h-6 w-6" />
        </button>
      )}

      {/* ---------------- overlays ---------------- */}
      {editing?.mode === "new" && (
        <ItemEditor
          knownBrands={facets.brands}
          knownTags={facets.tags}
          onClose={() => setEditing(null)}
          onSave={async (draft, photo) => {
            await addItem(draft, photo ?? null);
            flash(`“${draft.name}” is hanging up.`);
          }}
        />
      )}

      {editing?.mode === "edit" && (
        <ItemEditor
          item={editing.item}
          knownBrands={facets.brands}
          knownTags={facets.tags}
          onClose={() => setEditing(null)}
          onSave={async (draft, photo) => {
            await updateItem(editing.item.id, draft, photo);
            flash("Updated.");
          }}
        />
      )}

      {openItem && !editing && (
        <ItemDetail
          item={openItem}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing({ mode: "edit", item: openItem })}
          onDelete={async () => {
            const name = openItem.name;
            setOpenId(null);
            await deleteItem(openItem.id);
            flash(`Removed “${name}”.`);
          }}
          onToggleFavorite={() => void toggleFavorite(openItem.id)}
          onToggleArchived={() => void toggleArchived(openItem.id)}
          onLogWear={(date) => void logWear(openItem.id, date)}
          onRemoveWear={(date) => void removeWear(openItem.id, date)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="animate-rise fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bone shadow-[var(--shadow-lift)]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="card-surface animate-pulse overflow-hidden"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="aspect-[3/4] bg-bone-deep" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded-full bg-bone-deep" />
            <div className="h-2.5 w-1/2 rounded-full bg-bone-deep" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCloset({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="animate-rise card-surface mx-auto mt-6 max-w-xl px-6 py-14 text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-berry-soft text-berry">
        <HangerMark className="animate-swing h-11 w-11" />
      </span>
      <h2 className="display mt-6 text-2xl font-semibold">
        Your closet is waiting
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Add your first piece — snap a photo, name it, tag the seasons it belongs
        to. Everything else, from wear tracking to what you&apos;ve forgotten
        about, builds itself from there.
      </p>
      <button type="button" onClick={onAdd} className="btn-primary mx-auto mt-6">
        <SparkleIcon className="h-4 w-4" />
        Add your first piece
      </button>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="card-surface animate-rise px-6 py-14 text-center">
      <p className="display text-xl font-semibold">Nothing matches — yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Try loosening a filter or two; the piece you&apos;re picturing may be
        tagged for a different season.
      </p>
      <button type="button" onClick={onClear} className="btn-ghost mt-5">
        Clear filters
      </button>
    </div>
  );
}
