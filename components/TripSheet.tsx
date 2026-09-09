"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { CheckIcon, SearchIcon, TrashIcon } from "./Icons";
import { CATEGORIES, CATEGORY_LABEL, STATUS_BY_ID } from "@/lib/taxonomy";
import type { Item, Outfit, Trip, TripDraft } from "@/lib/types";
import { outfitPieces } from "@/lib/wardrobe";

interface Props {
  trip: Trip;
  items: Item[];
  outfits: Outfit[];
  onClose: () => void;
  onUpdate: (draft: TripDraft) => Promise<void>;
  onEditDetails: () => void;
  onDelete: () => Promise<void>;
  onSetPacked: (itemId: string, packed: boolean) => Promise<void>;
}

/**
 * The checklist is derived, never copied: pieces come from the chosen looks
 * plus any added on their own. Editing a look later updates the list, which is
 * what you want when the same look is packed for two trips.
 */
export default function TripSheet({
  trip,
  items,
  outfits,
  onClose,
  onUpdate,
  onEditDetails,
  onDelete,
  onSetPacked,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"looks" | "pieces">("looks");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chosenOutfits = trip.outfitIds
    .map((id) => outfits.find((o) => o.id === id))
    .filter((o): o is Outfit => Boolean(o));

  /** Everything to pack, deduped, with the look it came from noted. */
  const checklist = useMemo(() => {
    const seen = new Map<string, { item: Item; from: string[] }>();
    for (const outfit of chosenOutfits) {
      for (const piece of outfitPieces(outfit, items)) {
        const existing = seen.get(piece.id);
        if (existing) existing.from.push(outfit.name);
        else seen.set(piece.id, { item: piece, from: [outfit.name] });
      }
    }
    for (const id of trip.itemIds) {
      const item = byId.get(id);
      if (item && !seen.has(id)) seen.set(id, { item, from: [] });
    }
    return [...seen.values()].sort((a, b) =>
      a.item.category === b.item.category
        ? a.item.name.localeCompare(b.item.name)
        : a.item.category.localeCompare(b.item.category),
    );
  }, [chosenOutfits, trip.itemIds, items, byId]);

  const packedCount = checklist.filter((c) =>
    trip.packed.includes(c.item.id),
  ).length;
  const away = checklist.filter((c) => c.item.status !== "ready");

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !i.archived && !i.wishlist)
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => !q || `${i.name} ${i.brand ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query, category]);

  const draft = (): TripDraft => ({
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    notes: trip.notes,
    outfitIds: trip.outfitIds,
    itemIds: trip.itemIds,
  });

  return (
    <Modal
      title={trip.name}
      onClose={onClose}
      wide
      footer={
        confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">Delete “{trip.name}”?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="btn-ghost"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="btn-primary bg-berry-deep hover:bg-berry"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="btn-primary"
            >
              {adding ? "Done adding" : "Add to this list"}
            </button>
            <button type="button" onClick={onEditDetails} className="btn-ghost">
              Edit details
            </button>
            <span className="text-xs text-muted">
              {packedCount} of {checklist.length} packed
            </span>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${trip.name}`}
              className="btn-ghost ml-auto px-3 text-muted hover:border-berry hover:text-berry"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4 p-5">
        {(trip.destination || trip.startDate) && (
          <p className="text-sm text-muted">
            {[
              trip.destination,
              trip.startDate &&
                new Date(`${trip.startDate}T00:00:00`).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                ) +
                  (trip.endDate
                    ? ` – ${new Date(`${trip.endDate}T00:00:00`).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric" },
                      )}`
                    : ""),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {checklist.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold">
                {packedCount} of {checklist.length} packed
              </span>
              {away.length > 0 && (
                <span className="text-gold-ink">
                  {away.length} not ready to wear
                </span>
              )}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bone-deep">
              <div
                className="h-full rounded-full bg-sage transition-all"
                style={{
                  width: `${checklist.length ? (packedCount / checklist.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {adding ? (
          <div className="rounded-2xl border border-line p-3">
            <div className="mb-3 flex w-fit gap-1 rounded-full border border-line bg-shell p-1">
              {(
                [
                  ["looks", "Looks"],
                  ["pieces", "Pieces"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                    tab === id
                      ? "bg-ink text-bone"
                      : "text-ink-soft hover:text-berry-deep"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "looks" ? (
              outfits.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  No saved looks yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {outfits.map((outfit) => {
                    const picked = trip.outfitIds.includes(outfit.id);
                    return (
                      <button
                        key={outfit.id}
                        type="button"
                        onClick={() =>
                          onUpdate({
                            ...draft(),
                            outfitIds: picked
                              ? trip.outfitIds.filter((x) => x !== outfit.id)
                              : [...trip.outfitIds, outfit.id],
                          })
                        }
                        aria-pressed={picked}
                        className={`relative overflow-hidden rounded-xl border text-left transition-all ${
                          picked
                            ? "border-berry ring-2 ring-berry"
                            : "border-line hover:border-ink"
                        }`}
                      >
                        <span className="grid aspect-[4/3] grid-cols-2 gap-px bg-bone-deep">
                          {outfitPieces(outfit, items)
                            .slice(0, 4)
                            .map((piece) => (
                              <ItemPhoto
                                key={piece.id}
                                imageId={piece.imageId}
                                alt=""
                                category={piece.category}
                                className="h-full w-full"
                              />
                            ))}
                        </span>
                        <span className="block truncate px-2 py-1.5 text-[11px] font-medium">
                          {outfit.name}
                        </span>
                        {picked && (
                          <span className="animate-pop absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-berry text-bone">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                <div className="mb-2 flex gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a piece…"
                      aria-label="Find a piece"
                      className="field rounded-full pl-9 text-sm"
                    />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Category"
                    className="field w-auto rounded-full text-sm"
                  >
                    <option value="all">All</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                  {candidates.map((piece) => {
                    const picked = trip.itemIds.includes(piece.id);
                    return (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() =>
                          onUpdate({
                            ...draft(),
                            itemIds: picked
                              ? trip.itemIds.filter((x) => x !== piece.id)
                              : [...trip.itemIds, piece.id],
                          })
                        }
                        aria-pressed={picked}
                        className={`relative overflow-hidden rounded-xl border text-left transition-all ${
                          picked
                            ? "border-berry ring-2 ring-berry"
                            : "border-line hover:border-ink"
                        }`}
                      >
                        <span className="block aspect-square overflow-hidden bg-bone-deep">
                          <ItemPhoto
                            imageId={piece.imageId}
                            alt={piece.name}
                            category={piece.category}
                            className="h-full w-full"
                          />
                        </span>
                        <span className="block truncate px-1.5 py-1 text-[11px] font-medium">
                          {piece.name}
                        </span>
                        {picked && (
                          <span className="animate-pop absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-berry text-bone">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : checklist.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">
            Nothing on this list yet. Add a look or a few pieces and they&apos;ll
            appear here to tick off.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {checklist.map(({ item, from }) => {
              const packed = trip.packed.includes(item.id);
              return (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={packed}
                      onChange={(e) => onSetPacked(item.id, e.target.checked)}
                      className="h-5 w-5 shrink-0 accent-[var(--color-sage)]"
                    />
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-bone-deep">
                      <ItemPhoto
                        imageId={item.imageId}
                        alt=""
                        category={item.category}
                        className="h-full w-full"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${
                          packed ? "text-muted line-through" : ""
                        }`}
                      >
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {from.length > 0
                          ? from.join(", ")
                          : CATEGORY_LABEL[item.category]}
                        {item.location ? ` · ${item.location}` : ""}
                      </span>
                    </span>
                    {item.status !== "ready" && (
                      <span
                        title={STATUS_BY_ID[item.status].label}
                        className="shrink-0 text-sm"
                      >
                        {STATUS_BY_ID[item.status].emoji}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {trip.notes && (
          <div>
            <p className="eyebrow mb-1">Notes</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {trip.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
