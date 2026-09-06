"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClosetPulse from "@/components/ClosetPulse";
import FilterBar from "@/components/FilterBar";
import ItemCard from "@/components/ItemCard";
import ItemDetail from "@/components/ItemDetail";
import ItemEditor from "@/components/ItemEditor";
import QuickAdd from "@/components/QuickAdd";
import AppHeader from "@/components/AppHeader";
import { HangerMark, PlusIcon, SparkleIcon } from "@/components/Icons";
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

type Editing =
  | { mode: "new" }
  | { mode: "edit"; item: Item }
  | { mode: "quick" }
  | null;

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
    toggleWishlist,
    setStatus,
    logWear,
    removeWear,
    seedSample,
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
      <AppHeader
        searchRef={searchRef}
        search={{
          value: filters.search,
          onChange: (v) => setFilters((f) => ({ ...f, search: v })),
          placeholder:
            filters.scope === "wishlist"
              ? "Search your wishlist…"
              : "Search your closet…",
        }}
        addLabel={filters.scope === "wishlist" ? "Add a wish" : "Add piece"}
        onAdd={() => setEditing({ mode: "new" })}
        subtitle={
          hasCloset
            ? `${stats.total} pieces · ${SEASON_LABEL[season]} in rotation`
            : "Your wardrobe, beautifully kept"
        }
        onNotify={flash}
        onQuickAdd={() => setEditing({ mode: "quick" })}
      />

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
        <EmptyCloset
          onAdd={() => setEditing({ mode: "new" })}
          onQuickAdd={() => setEditing({ mode: "quick" })}
          onSample={async () => {
            const n = await seedSample();
            flash(`Added ${n} sample pieces to explore.`);
          }}
        />
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
            wishlistCount={stats.wishlist}
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
          defaultWishlist={filters.scope === "wishlist"}
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

      {editing?.mode === "quick" && (
        <QuickAdd
          onClose={() => setEditing(null)}
          onSave={async (entries) => {
            for (const { draft, photo } of entries) {
              await addItem(
                { ...draft, wishlist: filters.scope === "wishlist" },
                photo,
              );
            }
            flash(
              `Added ${entries.length} ${entries.length === 1 ? "piece" : "pieces"}.`,
            );
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
          onToggleWishlist={() => {
            void toggleWishlist(openItem.id);
            flash(
              openItem.wishlist
                ? `“${openItem.name}” moved into your closet.`
                : `“${openItem.name}” moved to your wishlist.`,
            );
          }}
          onSetStatus={(status) => void setStatus(openItem.id, status)}
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

function EmptyCloset({
  onAdd,
  onQuickAdd,
  onSample,
}: {
  onAdd: () => void;
  onQuickAdd: () => void;
  onSample: () => Promise<void>;
}) {
  const [seeding, setSeeding] = useState(false);
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
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onAdd} className="btn-primary">
          <SparkleIcon className="h-4 w-4" />
          Add your first piece
        </button>
        <button type="button" onClick={onQuickAdd} className="btn-ghost">
          Add a batch of photos
        </button>
        <button
          type="button"
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            try {
              await onSample();
            } finally {
              setSeeding(false);
            }
          }}
          className="btn-ghost disabled:opacity-55"
        >
          {seeding ? "Filling the rail…" : "Browse a sample closet"}
        </button>
      </div>
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
