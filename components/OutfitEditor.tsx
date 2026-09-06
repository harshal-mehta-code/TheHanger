"use client";

import { useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "./Icons";
import {
  CATEGORIES,
  FORMALITIES,
  SEASONS,
  TAG_SUGGESTIONS,
} from "@/lib/taxonomy";
import type {
  Formality,
  Item,
  Outfit,
  OutfitDraft,
  Season,
} from "@/lib/types";

interface Props {
  outfit?: Outfit;
  /** Every wearable piece — the picker filters this down. */
  items: Item[];
  knownTags: string[];
  onClose: () => void;
  onSave: (draft: OutfitDraft) => Promise<void>;
}

export default function OutfitEditor({
  outfit,
  items,
  knownTags,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(outfit?.name ?? "");
  const [itemIds, setItemIds] = useState<string[]>(outfit?.itemIds ?? []);
  const [seasons, setSeasons] = useState<Season[]>(outfit?.seasons ?? []);
  const [formality, setFormality] = useState<Formality | "">(
    outfit?.formality ?? "",
  );
  const [tags, setTags] = useState<string[]>(outfit?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(outfit?.notes ?? "");
  const [favorite, setFavorite] = useState(outfit?.favorite ?? false);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chosen = itemIds
    .map((id) => byId.get(id))
    .filter((i): i is Item => Boolean(i));

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !i.archived && !i.wishlist)
      .filter((i) => category === "all" || i.category === category)
      .filter(
        (i) =>
          !q ||
          `${i.name} ${i.brand ?? ""} ${i.subtype ?? ""}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query, category]);

  function togglePiece(id: string) {
    setItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setProblem("Give the look a name — “Friday dinner”, “Monday uniform”…");
      nameRef.current?.focus();
      return;
    }
    if (itemIds.length === 0) {
      setProblem("Pick at least one piece for this look.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        itemIds,
        seasons,
        formality: formality || undefined,
        tags,
        notes: notes.trim() || undefined,
        favorite,
      });
      onClose();
    } catch {
      setProblem("Couldn't save that look.");
      setSaving(false);
    }
  }

  const tagOptions = [...new Set([...knownTags, ...TAG_SUGGESTIONS])]
    .filter((t) => !tags.includes(t))
    .slice(0, 8);

  return (
    <Modal
      title={outfit ? "Edit look" : "Build a look"}
      onClose={onClose}
      wide
      footer={
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {itemIds.length} {itemIds.length === 1 ? "piece" : "pieces"} chosen
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              form="outfit-editor"
              disabled={saving}
              className="btn-primary disabled:opacity-55"
            >
              {saving ? "Saving…" : outfit ? "Save look" : "Save look"}
            </button>
          </div>
        </div>
      }
    >
      <form id="outfit-editor" onSubmit={handleSubmit} className="p-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          {/* ---- the picker ---- */}
          <div>
            <span className="label">Pieces in this look</span>

            {chosen.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {chosen.map((piece) => (
                  <span
                    key={piece.id}
                    className="inline-flex items-center gap-2 rounded-full bg-berry-soft py-1 pl-1 pr-2.5 text-xs font-medium text-berry-deep"
                  >
                    <span className="h-6 w-6 overflow-hidden rounded-full">
                      <ItemPhoto
                        imageId={piece.imageId}
                        alt=""
                        category={piece.category}
                        className="h-full w-full"
                      />
                    </span>
                    <span className="max-w-[10rem] truncate">{piece.name}</span>
                    <button
                      type="button"
                      onClick={() => togglePiece(piece.id)}
                      aria-label={`Remove ${piece.name} from this look`}
                      className="opacity-60 transition-opacity hover:opacity-100"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a piece…"
                  aria-label="Find a piece"
                  className="field rounded-full pl-9"
                />
              </div>
              <label className="sr-only" htmlFor="oe-cat">
                Category
              </label>
              <select
                id="oe-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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

            <div className="max-h-[22rem] overflow-y-auto rounded-2xl border border-line p-2">
              {candidates.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted">
                  Nothing matches. Try another category.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {candidates.map((piece) => {
                    const picked = itemIds.includes(piece.id);
                    return (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => togglePiece(piece.id)}
                        aria-pressed={picked}
                        className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                          picked
                            ? "border-berry ring-2 ring-berry"
                            : "border-line hover:border-ink"
                        }`}
                      >
                        <div className="aspect-square overflow-hidden bg-bone-deep">
                          <ItemPhoto
                            imageId={piece.imageId}
                            alt={piece.name}
                            category={piece.category}
                            className="h-full w-full"
                          />
                        </div>
                        <span className="block truncate px-1.5 py-1 text-[11px] font-medium">
                          {piece.name}
                        </span>
                        {picked && (
                          <span className="animate-pop absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-berry text-white">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {piece.status !== "ready" && (
                          <span
                            className="absolute left-1.5 top-1.5 rounded-full bg-shell/95 px-1.5 text-[10px]"
                            title="Not ready to wear right now"
                          >
                            🧺
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ---- the details ---- */}
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="oe-name">
                Name
              </label>
              <input
                id="oe-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Friday dinner"
                className="field"
                maxLength={80}
              />
            </div>

            <div>
              <span className="label">Seasons</span>
              <div className="flex flex-wrap gap-1.5">
                {SEASONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSeasons((prev) =>
                        prev.includes(s.id)
                          ? prev.filter((x) => x !== s.id)
                          : [...prev, s.id],
                      )
                    }
                    data-active={seasons.includes(s.id)}
                    className="chip"
                  >
                    <span aria-hidden>{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="oe-formality">
                Dress code
              </label>
              <select
                id="oe-formality"
                value={formality}
                onChange={(e) => setFormality(e.target.value as Formality | "")}
                className="field"
              >
                <option value="">Any</option>
                {FORMALITIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="oe-tag">
                Tags
              </label>
              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-berry-soft px-2.5 py-1 text-xs font-medium text-berry-deep"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        aria-label={`Remove tag ${t}`}
                        className="opacity-60 transition-opacity hover:opacity-100"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  id="oe-tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="brunch, travel…"
                  className="field"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  aria-label="Add tag"
                  className="btn-ghost shrink-0 px-3"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
              {tagOptions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTag(t)}
                      className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-berry hover:text-berry"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label" htmlFor="oe-notes">
                Notes
              </label>
              <textarea
                id="oe-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Belt it, sleeves pushed up."
                className="field resize-y"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-berry)]"
              />
              Mark as a favourite
            </label>

            {problem && (
              <p role="alert" className="text-sm font-medium text-berry">
                {problem}
              </p>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
