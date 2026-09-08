"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { CameraIcon, CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "./Icons";
import { getThumbUrl } from "@/lib/db";
import {
  looksLikeImage,
  preparePhoto,
  UnreadablePhotoError,
  type PreparedPhoto,
} from "@/lib/image";
import { CATEGORIES, SEASONS, TAG_SUGGESTIONS } from "@/lib/taxonomy";
import type { Inspo, InspoDraft, Item, Season } from "@/lib/types";

interface Props {
  inspo?: Inspo;
  items: Item[];
  knownTags: string[];
  onClose: () => void;
  onSave: (
    draft: InspoDraft,
    images: (string | PreparedPhoto)[],
  ) => Promise<void>;
}

/** An existing stored image, or one just picked and not yet written. */
type Slot = {
  key: string;
  ref: string | PreparedPhoto;
  preview: string | null;
};

export default function InspoEditor({
  inspo,
  items,
  knownTags,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState(inspo?.title ?? "");
  const [note, setNote] = useState(inspo?.note ?? "");
  const [sourceUrl, setSourceUrl] = useState(inspo?.sourceUrl ?? "");
  const [seasons, setSeasons] = useState<Season[]>(inspo?.seasons ?? []);
  const [tags, setTags] = useState<string[]>(inspo?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [itemIds, setItemIds] = useState<string[]>(inspo?.itemIds ?? []);
  const [favorite, setFavorite] = useState(inspo?.favorite ?? false);

  // Compared against what the sheet opened with, so dismissing an untouched
  // sheet stays instant and only real work is worth stopping for.
  const entered = JSON.stringify([
    title,
    note,
    sourceUrl,
    seasons,
    tags,
    itemIds,
    favorite,
  ]);
  const [opened] = useState(entered);

  const [slots, setSlots] = useState<Slot[]>(
    () =>
      inspo?.imageIds.map((id) => ({ key: id, ref: id, preview: null })) ?? [],
  );
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    if (!inspo) titleRef.current?.focus();
  }, [inspo]);

  // Resolve previews for images already in storage.
  useEffect(() => {
    let cancelled = false;
    for (const slot of slots) {
      if (slot.preview || typeof slot.ref !== "string") continue;
      const id = slot.ref;
      getThumbUrl(id).then((url) => {
        if (cancelled || !url) return;
        setSlots((prev) =>
          prev.map((s) => (s.key === id ? { ...s, preview: url } : s)),
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [slots]);

  useEffect(() => {
    const minted = objectUrls.current;
    return () => {
      for (const url of minted) URL.revokeObjectURL(url);
    };
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const chosen = itemIds
    .map((id) => byId.get(id))
    .filter((i): i is Item => Boolean(i));

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !i.archived)
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => !q || `${i.name} ${i.brand ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query, category]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const images = [...files].filter(looksLikeImage);
    if (images.length === 0) {
      setProblem("None of those were images.");
      return;
    }
    setProcessing(true);
    setProblem(null);
    try {
      const added: Slot[] = [];
      const skipped: string[] = [];
      for (const file of images) {
        let photo: PreparedPhoto;
        try {
          photo = await preparePhoto(file);
        } catch (err) {
          if (!(err instanceof UnreadablePhotoError)) throw err;
          skipped.push(file.name);
          continue;
        }
        const preview = URL.createObjectURL(photo.thumb);
        objectUrls.current.push(preview);
        added.push({
          key: `new-${Math.random().toString(36).slice(2)}`,
          ref: photo,
          preview,
        });
      }
      if (skipped.length) {
        setProblem(
          `Couldn't read ${skipped.length} of those — iPhone HEIC photos need to be added from the phone, or exported as JPEG.`,
        );
      }
      setSlots((prev) => [...prev, ...added]);
    } catch {
      setProblem("Couldn't read those images.");
    } finally {
      setProcessing(false);
    }
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setProblem("Give it a name — “Spring neutrals”, “Amalfi trip”…");
      titleRef.current?.focus();
      return;
    }
    if (slots.length === 0 && itemIds.length === 0) {
      setProblem("Add at least one image or piece.");
      return;
    }

    setSaving(true);
    try {
      await onSave(
        {
          title: trimmed,
          note: note.trim() || undefined,
          sourceUrl: sourceUrl.trim() || undefined,
          itemIds,
          tags,
          seasons,
          favorite,
        },
        slots.map((s) => s.ref),
      );
      onClose();
    } catch {
      setProblem("Couldn't save that. Your browser storage may be full.");
      setSaving(false);
    }
  }

  const tagOptions = [...new Set([...knownTags, ...TAG_SUGGESTIONS])]
    .filter((t) => !tags.includes(t))
    .slice(0, 8);

  return (
    <Modal
      title={inspo ? "Edit inspo" : "New inspo"}
      onClose={onClose}
      dirty={entered !== opened || slots.some((s) => typeof s.ref !== "string")}
      wide
      footer={
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {slots.length} {slots.length === 1 ? "image" : "images"}
            {itemIds.length > 0 && ` · ${itemIds.length} linked`}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              form="inspo-editor"
              disabled={saving || processing}
              className="btn-primary disabled:opacity-55"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <form id="inspo-editor" onSubmit={handleSubmit} className="p-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          {/* ---- the board ---- */}
          <div>
            <span className="label">Images</span>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFiles(e.dataTransfer.files);
              }}
              onPaste={(e) => {
                // Pasting straight from Pinterest is the fastest way in.
                const files = e.clipboardData?.files;
                if (files?.length) {
                  e.preventDefault();
                  void handleFiles(files);
                }
              }}
              className="rounded-2xl border border-dashed border-line p-3"
            >
              {slots.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 py-12 text-muted transition-colors hover:text-berry"
                >
                  <CameraIcon className="h-9 w-9" />
                  <span className="text-sm font-semibold">
                    {processing ? "Processing…" : "Add images"}
                  </span>
                  <span className="max-w-xs text-center text-[11px] leading-relaxed opacity-80">
                    Screenshots, saved pins, a colour story — drop them here,
                    paste them, or pick from your photos.
                  </span>
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => (
                      <div
                        key={slot.key}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-bone-deep"
                      >
                        {slot.preview && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slot.preview}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setSlots((prev) =>
                              prev.filter((s) => s.key !== slot.key),
                            )
                          }
                          aria-label="Remove image"
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-shell/90 text-ink-soft backdrop-blur-sm transition-colors hover:bg-shell hover:text-berry"
                        >
                          <CloseIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={processing}
                    className="btn-ghost mt-3 w-full justify-center disabled:opacity-55"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {processing ? "Processing…" : "Add more"}
                  </button>
                </>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* ---- linked pieces ---- */}
            <div className="mt-5">
              <span className="label">Pieces you own that fit this</span>
              {chosen.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
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
                      <span className="max-w-[9rem] truncate">{piece.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setItemIds((prev) => prev.filter((x) => x !== piece.id))
                        }
                        aria-label={`Unlink ${piece.name}`}
                        className="opacity-60 transition-opacity hover:opacity-100"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {pickerOpen ? (
                <div className="rounded-2xl border border-line p-2">
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
                    <button
                      type="button"
                      onClick={() => setPickerOpen(false)}
                      className="btn-ghost shrink-0 px-3 text-sm"
                    >
                      Done
                    </button>
                  </div>
                  <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
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
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="rounded-full border border-dashed border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-berry hover:text-berry"
                >
                  + Link pieces from your closet
                </button>
              )}
            </div>
          </div>

          {/* ---- details ---- */}
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="in-title">
                Name
              </label>
              <input
                id="in-title"
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Spring neutrals"
                className="field"
                maxLength={80}
              />
            </div>

            <div>
              <label className="label" htmlFor="in-source">
                Where it&apos;s from
              </label>
              <input
                id="in-source"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://pinterest.com/…"
                className="field"
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
              <label className="label" htmlFor="in-tag">
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
                  id="in-tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="neutrals, brunch…"
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
              <label className="label" htmlFor="in-note">
                Notes
              </label>
              <textarea
                id="in-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="The gold jewellery is what makes it. Find a similar belt."
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
