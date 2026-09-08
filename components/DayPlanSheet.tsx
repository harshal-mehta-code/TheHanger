"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { CheckIcon, SearchIcon } from "./Icons";
import { CATEGORIES } from "@/lib/taxonomy";
import type { DayPlan, Item, Outfit } from "@/lib/types";
import { outfitPieces, todayISO } from "@/lib/wardrobe";

interface Props {
  date: string;
  plan: DayPlan | null;
  items: Item[];
  outfits: Outfit[];
  onClose: () => void;
  onSave: (plan: {
    outfitId?: string;
    itemIds: string[];
    note?: string;
  }) => Promise<void>;
  onClear: () => Promise<void>;
  /** Logs the plan as actually worn on this day. */
  onWear: () => Promise<void>;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function DayPlanSheet({
  date,
  plan,
  items,
  outfits,
  onClose,
  onSave,
  onClear,
  onWear,
}: Props) {
  const [outfitId, setOutfitId] = useState(plan?.outfitId);
  const [itemIds, setItemIds] = useState<string[]>(plan?.itemIds ?? []);
  const [note, setNote] = useState(plan?.note ?? "");
  const [tab, setTab] = useState<"looks" | "pieces">(
    plan?.itemIds.length && !plan.outfitId ? "pieces" : "looks",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [saving, setSaving] = useState(false);

  const wearable = useMemo(
    () => items.filter((i) => !i.archived && !i.wishlist),
    [items],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wearable
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => !q || `${i.name} ${i.brand ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [wearable, query, category]);

  // You can only have worn something today or earlier.
  const canMarkWorn = Boolean(plan) && date <= todayISO();
  const hasPlan = Boolean(outfitId) || itemIds.length > 0;

  async function save() {
    setSaving(true);
    await onSave({
      outfitId,
      itemIds,
      note: note.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal
      title={formatDay(date)}
      onClose={onClose}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {plan && (
            <button
              type="button"
              onClick={async () => {
                await onClear();
                onClose();
              }}
              className="btn-ghost text-muted hover:border-berry hover:text-berry"
            >
              Clear day
            </button>
          )}
          {canMarkWorn && (
            <button
              type="button"
              onClick={async () => {
                await onWear();
                onClose();
              }}
              className="btn-ghost"
            >
              <CheckIcon className="h-4 w-4" /> Mark as worn
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !hasPlan}
              className="btn-primary disabled:opacity-55"
            >
              {saving ? "Saving…" : "Save plan"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <div className="flex w-fit gap-1 rounded-full border border-line bg-shell p-1">
          {(
            [
              ["looks", `Saved looks${outfits.length ? ` · ${outfits.length}` : ""}`],
              ["pieces", "Individual pieces"],
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
            <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
              No saved looks yet. Build one in Outfits, or pick pieces instead.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {outfits.map((outfit) => {
                const picked = outfitId === outfit.id;
                const pieces = outfitPieces(outfit, items).slice(0, 4);
                return (
                  <button
                    key={outfit.id}
                    type="button"
                    onClick={() => setOutfitId(picked ? undefined : outfit.id)}
                    aria-pressed={picked}
                    className={`relative overflow-hidden rounded-xl border text-left transition-all ${
                      picked
                        ? "border-berry ring-2 ring-berry"
                        : "border-line hover:border-ink"
                    }`}
                  >
                    <span className="grid aspect-[4/3] grid-cols-2 gap-px bg-bone-deep">
                      {pieces.map((piece) => (
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
            <div className="flex gap-2">
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
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
              {candidates.map((piece) => {
                const picked = itemIds.includes(piece.id);
                return (
                  <button
                    key={piece.id}
                    type="button"
                    onClick={() =>
                      setItemIds((prev) =>
                        picked
                          ? prev.filter((x) => x !== piece.id)
                          : [...prev, piece.id],
                      )
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

        <div>
          <label className="label" htmlFor="plan-note">
            Note
          </label>
          <input
            id="plan-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Dinner with the Shahs — wear the gold earrings"
            className="field"
          />
        </div>
      </div>
    </Modal>
  );
}
