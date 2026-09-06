"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import OutfitCard from "@/components/OutfitCard";
import OutfitDetail from "@/components/OutfitDetail";
import OutfitEditor from "@/components/OutfitEditor";
import ItemDetail from "@/components/ItemDetail";
import { HangerMark, HeartIcon, SparkleIcon } from "@/components/Icons";
import { FORMALITIES, SEASONS } from "@/lib/taxonomy";
import { useCloset } from "@/lib/store";
import type { Outfit, SortKey } from "@/lib/types";
import {
  EMPTY_OUTFIT_FILTERS,
  collectFacets,
  filterOutfits,
  outfitPieces,
  sortOutfits,
  type OutfitFilters,
} from "@/lib/wardrobe";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Newest first" },
  { id: "mostWorn", label: "Most worn" },
  { id: "leastWorn", label: "Least worn" },
  { id: "neglected", label: "Longest unworn" },
  { id: "name", label: "A – Z" },
];

type Editing = { mode: "new" } | { mode: "edit"; outfit: Outfit } | null;

export default function OutfitsPage() {
  const {
    items,
    outfits,
    ready,
    addOutfit,
    updateOutfit,
    deleteOutfit,
    toggleOutfitFavorite,
    logOutfitWear,
    removeOutfitWear,
    toggleFavorite,
    toggleArchived,
    toggleWishlist,
    setStatus,
    logWear,
    removeWear,
    deleteItem,
  } = useCloset();

  const [filters, setFilters] = useState<OutfitFilters>(EMPTY_OUTFIT_FILTERS);
  const [editing, setEditing] = useState<Editing>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openPieceId, setOpenPieceId] = useState<string | null>(null);
  const [justWornId, setJustWornId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const wornTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (wornTimer.current) clearTimeout(wornTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const facets = useMemo(() => collectFacets(items), [items]);
  const visible = useMemo(
    () => sortOutfits(filterOutfits(outfits, items, filters), filters.sort),
    [outfits, items, filters],
  );

  const openOutfit = openId ? outfits.find((o) => o.id === openId) ?? null : null;
  const openPiece = openPieceId
    ? items.find((i) => i.id === openPieceId) ?? null
    : null;

  const handleWear = useCallback(
    async (outfit: Outfit) => {
      await logOutfitWear(outfit.id);
      setJustWornId(outfit.id);
      if (wornTimer.current) clearTimeout(wornTimer.current);
      wornTimer.current = setTimeout(() => setJustWornId(null), 1600);
    },
    [logOutfitWear],
  );

  const wearableItems = items.filter((i) => !i.wishlist && !i.archived);
  const hasOutfits = outfits.length > 0;
  const activeFilters =
    filters.seasons.length +
    filters.formality.length +
    (filters.favoritesOnly ? 1 : 0) +
    (filters.wearableOnly ? 1 : 0);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 pb-24 sm:px-6">
      <AppHeader
        search={{
          value: filters.search,
          onChange: (v) => setFilters((f) => ({ ...f, search: v })),
          placeholder: "Search your looks…",
        }}
        addLabel="Build a look"
        onAdd={() => setEditing({ mode: "new" })}
        subtitle={`${outfits.length} saved ${outfits.length === 1 ? "look" : "looks"}`}
        onNotify={flash}
      />

      {!ready ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-surface animate-pulse overflow-hidden">
              <div className="aspect-[4/3] bg-bone-deep" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 rounded-full bg-bone-deep" />
                <div className="h-2.5 w-1/2 rounded-full bg-bone-deep" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasOutfits ? (
        <EmptyOutfits
          canBuild={wearableItems.length > 0}
          onAdd={() => setEditing({ mode: "new" })}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {SEASONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    seasons: f.seasons.includes(s.id)
                      ? f.seasons.filter((x) => x !== s.id)
                      : [...f.seasons, s.id],
                  }))
                }
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
                setFilters((f) => ({ ...f, favoritesOnly: !f.favoritesOnly }))
              }
              data-active={filters.favoritesOnly}
              className="chip"
            >
              <HeartIcon filled={filters.favoritesOnly} className="h-3.5 w-3.5" />
              Loved
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((f) => ({ ...f, wearableOnly: !f.wearableOnly }))
              }
              data-active={filters.wearableOnly}
              title="Hide looks with a piece in the wash or away being fixed"
              className="chip"
            >
              ✨ Wearable now
            </button>

            <div className="ml-auto flex items-center gap-2">
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((f) => ({
                      ...EMPTY_OUTFIT_FILTERS,
                      search: f.search,
                      sort: f.sort,
                    }))
                  }
                  className="text-xs font-medium text-berry underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              )}
              <span className="hidden text-xs text-muted sm:inline">
                {visible.length} {visible.length === 1 ? "look" : "looks"}
              </span>
              <label className="sr-only" htmlFor="outfit-sort">
                Sort
              </label>
              <select
                id="outfit-sort"
                value={filters.sort}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sort: e.target.value as SortKey }))
                }
                className="field w-auto rounded-full py-1.5 text-xs"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FORMALITIES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    formality: prev.formality.includes(f.id)
                      ? prev.formality.filter((x) => x !== f.id)
                      : [...prev.formality, f.id],
                  }))
                }
                data-active={filters.formality.includes(f.id)}
                className="chip"
              >
                {f.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="card-surface animate-rise px-6 py-14 text-center">
              <p className="display text-xl font-semibold">No looks match</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Loosen a filter, or build a new look from what&apos;s clean.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {visible.map((outfit, i) => (
                <OutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  pieces={outfitPieces(outfit, items)}
                  index={i}
                  justWorn={justWornId === outfit.id}
                  onOpen={() => setOpenId(outfit.id)}
                  onToggleFavorite={() => void toggleOutfitFavorite(outfit.id)}
                  onWear={() => void handleWear(outfit)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {ready && hasOutfits && (
        <button
          type="button"
          onClick={() => setEditing({ mode: "new" })}
          aria-label="Build a look"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-bone shadow-[var(--shadow-lift)] transition-transform active:scale-95 sm:hidden"
        >
          <SparkleIcon className="h-6 w-6" />
        </button>
      )}

      {editing?.mode === "new" && (
        <OutfitEditor
          items={wearableItems}
          knownTags={facets.tags}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            await addOutfit(draft);
            flash(`“${draft.name}” saved.`);
          }}
        />
      )}

      {editing?.mode === "edit" && (
        <OutfitEditor
          outfit={editing.outfit}
          items={wearableItems}
          knownTags={facets.tags}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            await updateOutfit(editing.outfit.id, draft);
            flash("Look updated.");
          }}
        />
      )}

      {openOutfit && !editing && !openPiece && (
        <OutfitDetail
          outfit={openOutfit}
          pieces={outfitPieces(openOutfit, items)}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing({ mode: "edit", outfit: openOutfit })}
          onDelete={async () => {
            const name = openOutfit.name;
            setOpenId(null);
            await deleteOutfit(openOutfit.id);
            flash(`Removed “${name}”.`);
          }}
          onToggleFavorite={() => void toggleOutfitFavorite(openOutfit.id)}
          onLogWear={(date) => {
            void logOutfitWear(openOutfit.id, date);
            flash("Logged — every piece in the look counted too.");
          }}
          onRemoveWear={(date) => void removeOutfitWear(openOutfit.id, date)}
          onOpenPiece={setOpenPieceId}
        />
      )}

      {/* Drilling into a piece from a look opens the same sheet as the closet. */}
      {openPiece && (
        <ItemDetail
          item={openPiece}
          onClose={() => setOpenPieceId(null)}
          onEdit={() => setOpenPieceId(null)}
          onDelete={async () => {
            setOpenPieceId(null);
            await deleteItem(openPiece.id);
          }}
          onToggleFavorite={() => void toggleFavorite(openPiece.id)}
          onToggleArchived={() => void toggleArchived(openPiece.id)}
          onToggleWishlist={() => void toggleWishlist(openPiece.id)}
          onSetStatus={(status) => void setStatus(openPiece.id, status)}
          onLogWear={(date) => void logWear(openPiece.id, date)}
          onRemoveWear={(date) => void removeWear(openPiece.id, date)}
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

function EmptyOutfits({
  canBuild,
  onAdd,
}: {
  canBuild: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="animate-rise card-surface mx-auto mt-6 max-w-xl px-6 py-14 text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-berry-soft text-berry">
        <HangerMark className="animate-swing h-11 w-11" />
      </span>
      <h2 className="display mt-6 text-2xl font-semibold">
        Save the combinations that work
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {canBuild
          ? "Put pieces together into a look you can wear again without rethinking it. Logging a look counts a wear for every piece in it."
          : "Add a few pieces to your closet first — looks are built from what you own."}
      </p>
      {canBuild && (
        <button type="button" onClick={onAdd} className="btn-primary mx-auto mt-6">
          <SparkleIcon className="h-4 w-4" />
          Build your first look
        </button>
      )}
    </div>
  );
}
