"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { CameraIcon, CloseIcon, PlusIcon, TrashIcon } from "./Icons";
import { getImageUrl } from "@/lib/db";
import { compressImage } from "@/lib/image";
import {
  CATEGORIES,
  COLORS,
  FORMALITIES,
  SEASONS,
  STANDARD_LOCATIONS,
  STATUSES,
  TAG_SUGGESTIONS,
} from "@/lib/taxonomy";
import { knownLocations } from "@/lib/wardrobe";
import type {
  CategoryId,
  Formality,
  Item,
  ItemDraft,
  ItemStatus,
  Season,
} from "@/lib/types";

interface Props {
  /** Absent when adding a new piece. */
  item?: Item;
  /** New pieces added from the wishlist view start out as wishes. */
  defaultWishlist?: boolean;
  knownBrands: string[];
  knownTags: string[];
  /** Locations already in use, merged with the standard set in the picker. */
  usedLocations: string[];
  onClose: () => void;
  onSave: (draft: ItemDraft, photo: Blob | null | undefined) => Promise<void>;
}

export default function ItemEditor({
  item,
  defaultWishlist = false,
  knownBrands,
  knownTags,
  usedLocations,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(item?.category ?? "tops");
  const [subtype, setSubtype] = useState(item?.subtype ?? "");
  const [brand, setBrand] = useState(item?.brand ?? "");
  const [color, setColor] = useState(item?.color ?? "");
  const [size, setSize] = useState(item?.size ?? "");
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons ?? []);
  const [formality, setFormality] = useState<Formality | "">(
    item?.formality ?? "",
  );
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [purchasedOn, setPurchasedOn] = useState(item?.purchasedOn ?? "");
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");
  const [favorite, setFavorite] = useState(item?.favorite ?? false);
  const [wishlist, setWishlist] = useState(item?.wishlist ?? defaultWishlist);
  const [location, setLocation] = useState(item?.location ?? "");
  const [newLocation, setNewLocation] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? "ready");

  /** `undefined` = photo untouched, `null` = cleared, Blob = replaced. */
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Seed the preview with the existing photo when editing.
  useEffect(() => {
    if (!item?.imageId) return;
    let cancelled = false;
    getImageUrl(item.imageId).then((url) => {
      if (!cancelled) setPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [item?.imageId]);

  // Release preview URLs we minted for freshly picked files.
  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:") && photo instanceof Blob) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview, photo]);

  useEffect(() => {
    if (!item) nameRef.current?.focus();
  }, [item]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProblem("That file isn't an image.");
      return;
    }
    setProcessing(true);
    setProblem(null);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setProblem("Couldn't read that photo. Try another one.");
    } finally {
      setProcessing(false);
    }
  }

  function toggleSeason(season: Season) {
    setSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season],
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
      setProblem("Give the piece a name so you can find it later.");
      nameRef.current?.focus();
      return;
    }

    const parsedPrice = Number.parseFloat(price);
    const draft: ItemDraft = {
      name: trimmed,
      category,
      subtype: subtype.trim() || undefined,
      brand: brand.trim() || undefined,
      color: color || undefined,
      size: size.trim() || undefined,
      location: location.trim() || undefined,
      seasons,
      formality: formality || undefined,
      tags,
      notes: notes.trim() || undefined,
      purchasedOn: purchasedOn || undefined,
      price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
      favorite,
      wishlist,
      status,
    };

    setSaving(true);
    try {
      await onSave(draft, photo);
      onClose();
    } catch {
      setProblem("Couldn't save that. Your browser storage may be full.");
      setSaving(false);
    }
  }

  const tagOptions = [...new Set([...knownTags, ...TAG_SUGGESTIONS])]
    .filter((t) => !tags.includes(t))
    .slice(0, 10);

  return (
    <Modal
      title={item ? "Edit piece" : "Add a piece"}
      onClose={onClose}
      wide
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            form="item-editor"
            disabled={saving || processing}
            className="btn-primary disabled:opacity-55"
          >
            {saving ? "Saving…" : item ? "Save changes" : "Add to closet"}
          </button>
        </div>
      }
    >
      <form id="item-editor" onSubmit={handleSubmit} className="p-5">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          {/* ---- photo ---- */}
          <div>
            <span className="label">Photo</span>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-line bg-bone-deep"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="Selected piece"
                  className="h-full w-full object-cover"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted transition-colors hover:text-berry"
                >
                  <CameraIcon className="h-8 w-8" />
                  <span className="text-xs font-medium">
                    {processing ? "Processing…" : "Take or upload a photo"}
                  </span>
                  <span className="px-4 text-center text-[11px] opacity-70">
                    Drop an image here too
                  </span>
                </button>
              )}

              {preview && (
                <div className="absolute inset-x-2 bottom-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 rounded-full bg-shell/92 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-shell"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setPreview(null);
                    }}
                    aria-label="Remove photo"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-shell/92 backdrop-blur-sm transition-colors hover:bg-shell hover:text-berry"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-berry)]"
              />
              Mark as a favourite
            </label>

            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wishlist}
                onChange={(e) => setWishlist(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-berry)]"
              />
              Wishlist — not owned yet
            </label>
          </div>

          {/* ---- details ---- */}
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="ie-name">
                Name
              </label>
              <input
                id="ie-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ivory silk blouse"
                className="field"
                maxLength={80}
              />
            </div>

            <div>
              <span className="label">Category</span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    data-active={category === c.id}
                    className="chip"
                  >
                    <span aria-hidden>{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Seasons</span>
              <div className="flex flex-wrap gap-1.5">
                {SEASONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSeason(s.id)}
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
              <span className="label">Where it&apos;s kept</span>
              <div className="flex flex-wrap gap-1.5">
                {/* The current value is folded in so a location she just
                    invented has a chip immediately, not only after saving. */}
                {knownLocations(
                  location ? [...usedLocations, location] : usedLocations,
                  STANDARD_LOCATIONS,
                ).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(location === loc ? "" : loc)}
                    data-active={location === loc}
                    className="chip"
                  >
                    {loc}
                  </button>
                ))}

                {addingLocation ? (
                  <span className="flex items-center gap-1.5">
                    <input
                      value={newLocation}
                      autoFocus
                      onChange={(e) => setNewLocation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = newLocation.trim();
                          if (v) setLocation(v);
                          setNewLocation("");
                          setAddingLocation(false);
                        }
                        if (e.key === "Escape") {
                          setNewLocation("");
                          setAddingLocation(false);
                        }
                      }}
                      placeholder="Guest room rail"
                      aria-label="New location name"
                      className="field w-44 py-1.5 text-sm"
                      maxLength={40}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = newLocation.trim();
                        if (v) setLocation(v);
                        setNewLocation("");
                        setAddingLocation(false);
                      }}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      Add
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingLocation(true)}
                    className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-berry hover:text-berry"
                  >
                    + New location
                  </button>
                )}
              </div>
            </div>

            <div>
              <span className="label">Colour</span>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => {
                  const active = color === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(active ? "" : c.id)}
                      title={c.label}
                      aria-label={c.label}
                      aria-pressed={active}
                      className={`h-8 w-8 rounded-full ring-1 ring-inset transition-all ${
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ie-brand">
                  Brand
                </label>
                <input
                  id="ie-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  list="known-brands"
                  placeholder="Reformation"
                  className="field"
                />
                <datalist id="known-brands">
                  {knownBrands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="label" htmlFor="ie-subtype">
                  Style
                </label>
                <input
                  id="ie-subtype"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  placeholder="Wrap blouse"
                  className="field"
                />
              </div>

              <div>
                <label className="label" htmlFor="ie-size">
                  Size
                </label>
                <input
                  id="ie-size"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="M"
                  className="field"
                />
              </div>

              <div>
                <label className="label" htmlFor="ie-formality">
                  Dress code
                </label>
                <select
                  id="ie-formality"
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

              {!wishlist && (
                <div>
                  <label className="label" htmlFor="ie-status">
                    Where it is
                  </label>
                  <select
                    id="ie-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ItemStatus)}
                    className="field"
                  >
                    {STATUSES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="label" htmlFor="ie-purchased">
                  Bought on
                </label>
                <input
                  id="ie-purchased"
                  type="date"
                  value={purchasedOn}
                  onChange={(e) => setPurchasedOn(e.target.value)}
                  className="field"
                />
              </div>

              <div>
                <label className="label" htmlFor="ie-price">
                  Price
                </label>
                <input
                  id="ie-price"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Optional — powers cost per wear"
                  className="field"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="ie-tag">
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
                  id="ie-tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="date night, office…"
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
              <label className="label" htmlFor="ie-notes">
                Notes
              </label>
              <textarea
                id="ie-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Runs long — pairs with the tan belt."
                className="field resize-y"
              />
            </div>

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
