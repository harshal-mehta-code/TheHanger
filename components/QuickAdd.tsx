"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { CameraIcon, CloseIcon, PlusIcon } from "./Icons";
import {
  looksLikeImage,
  preparePhoto,
  UnreadablePhotoError,
  type PreparedPhoto,
} from "@/lib/image";
import { CATEGORIES, SEASONS } from "@/lib/taxonomy";
import type { CategoryId, ItemDraft, Season } from "@/lib/types";

interface Draft {
  key: string;
  photo: PreparedPhoto;
  preview: string;
  name: string;
  category: CategoryId;
  seasons: Season[];
}

interface Props {
  onClose: () => void;
  /** Saves one piece. Called per draft so a failure halfway can't duplicate. */
  onSaveEntry: (draft: ItemDraft, photo: PreparedPhoto) => Promise<void>;
  onDone: (saved: number) => void;
}

let counter = 0;

/**
 * Cataloguing a whole wardrobe one modal at a time is the slow part of an app
 * like this. Quick add takes a batch of photos and asks only for the fields you
 * can't infer later — everything else can be filled in per piece afterwards.
 */
export default function QuickAdd({ onClose, onSaveEntry, onDone }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview URLs are minted here, so they're released here.
  const previews = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
    },
    [],
  );

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setProcessing(true);
    setProblem(null);

    const images = [...files].filter(looksLikeImage);
    if (images.length === 0) {
      setProblem("None of those were images.");
      setProcessing(false);
      return;
    }

    try {
      const added: Draft[] = [];
      // One unreadable photo — an iPhone HEIC opened on a laptop, say —
      // shouldn't throw away the rest of the batch she just picked.
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
        previews.current.push(preview);
        added.push({
          key: `qa-${counter++}`,
          photo,
          preview,
          // The filename is usually noise (IMG_4821), so start empty and let
          // the category carry the name until she renames it.
          name: "",
          category: "tops",
          seasons: [],
        });
      }
      setDrafts((prev) => [...prev, ...added]);
      const notImages = files.length - images.length;
      if (skipped.length) {
        setProblem(
          `Couldn't read ${skipped.length} of those — iPhone HEIC photos need to be added from the phone, or exported as JPEG first.`,
        );
      } else if (notImages) {
        setProblem(`Skipped ${notImages} non-image file(s).`);
      }
    } catch {
      setProblem("Something went wrong reading those photos.");
    } finally {
      setProcessing(false);
    }
  }

  function patch(key: string, change: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...change } : d)),
    );
  }

  function remove(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  async function handleSave() {
    if (drafts.length === 0) return;
    setSaving(true);
    try {
      // Saved one at a time, dropping each draft as it lands. Saving the batch
      // in one call meant a failure partway left the successes on screen, and
      // pressing Add again added them a second time.
      let saved = 0;
      for (const d of [...drafts]) {
        await onSaveEntry(
          {
            name:
              d.name.trim() ||
              // Singularised category label, e.g. "Dresses" -> "Dress".
              CATEGORIES.find((c) => c.id === d.category)!.label.replace(
                /s$/,
                "",
              ),
            category: d.category,
            seasons: d.seasons,
            tags: [],
          },
          d.photo,
        );
        remove(d.key);
        saved++;
      }
      onDone(saved);
      onClose();
    } catch {
      setProblem("Couldn't save those. Your browser storage may be full.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Quick add"
      onClose={onClose}
      dirty={drafts.length > 0}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">
            {drafts.length === 0
              ? "Pick as many photos as you like"
              : `${drafts.length} ${drafts.length === 1 ? "piece" : "pieces"} ready`}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={drafts.length === 0 || saving || processing}
              className="btn-primary disabled:opacity-55"
            >
              {saving
                ? "Adding…"
                : `Add ${drafts.length || ""} ${
                    drafts.length === 1 ? "piece" : "pieces"
                  }`.trim()}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-5">
        {drafts.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(e.dataTransfer.files);
            }}
            className="rounded-2xl border border-dashed border-line bg-bone-deep/60 px-6 py-14 text-center"
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="mx-auto flex flex-col items-center gap-2 text-muted transition-colors hover:text-berry"
            >
              <CameraIcon className="h-10 w-10" />
              <span className="text-sm font-semibold">
                {processing ? "Processing photos…" : "Choose photos"}
              </span>
            </button>
            <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-muted">
              Select a whole batch at once — or drop them here. Give each one a
              category now and fill in brand, colour and the rest later.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d, i) => (
              <div
                key={d.key}
                className="animate-rise flex gap-3 rounded-2xl border border-line p-3"
              >
                <div className="h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-bone-deep">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={d.name}
                      onChange={(e) => patch(d.key, { name: e.target.value })}
                      autoFocus={i === 0}
                      placeholder={
                        CATEGORIES.find((c) => c.id === d.category)!.label.replace(
                          /s$/,
                          "",
                        ) + " (tap to name it)"
                      }
                      aria-label={`Name for photo ${i + 1}`}
                      className="field py-1.5 text-sm"
                      maxLength={80}
                    />
                    <label className="sr-only" htmlFor={`qa-cat-${d.key}`}>
                      Category
                    </label>
                    <select
                      id={`qa-cat-${d.key}`}
                      value={d.category}
                      onChange={(e) =>
                        patch(d.key, { category: e.target.value as CategoryId })
                      }
                      className="field w-auto py-1.5 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(d.key)}
                      aria-label={`Discard photo ${i + 1}`}
                      className="shrink-0 rounded-full px-2 text-muted transition-colors hover:text-berry"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {SEASONS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          patch(d.key, {
                            seasons: d.seasons.includes(s.id)
                              ? d.seasons.filter((x) => x !== s.id)
                              : [...d.seasons, s.id],
                          })
                        }
                        data-active={d.seasons.includes(s.id)}
                        className="chip !px-2.5 !py-1 !text-xs"
                      >
                        <span aria-hidden>{s.emoji}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={processing}
              className="btn-ghost w-full justify-center disabled:opacity-55"
            >
              <PlusIcon className="h-4 w-4" />
              {processing ? "Processing…" : "Add more photos"}
            </button>
          </div>
        )}

        {problem && (
          <p role="alert" className="mt-3 text-sm font-medium text-berry">
            {problem}
          </p>
        )}

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
      </div>
    </Modal>
  );
}
