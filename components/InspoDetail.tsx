"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { EditIcon, HeartIcon, TrashIcon } from "./Icons";
import { getImageUrl } from "@/lib/db";
import { SEASON_LABEL } from "@/lib/taxonomy";
import type { Inspo, Item } from "@/lib/types";

interface Props {
  inspo: Inspo;
  pieces: Item[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onOpenPiece: (id: string) => void;
}

export default function InspoDetail({
  inspo,
  pieces,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onOpenPiece,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      inspo.imageIds.map(async (id) => [id, await getImageUrl(id)] as const),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [id, url] of pairs) if (url) next[id] = url;
      setUrls(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspo.imageIds.join(",")]);

  // A safe external link: only http(s), and never with the opener attached.
  const safeSource =
    inspo.sourceUrl && /^https?:\/\//i.test(inspo.sourceUrl)
      ? inspo.sourceUrl
      : null;

  return (
    <Modal
      title={inspo.title}
      hideTitle
      onClose={onClose}
      wide
      footer={
        confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">Delete “{inspo.title}”?</p>
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
                className="btn-primary bg-danger text-danger-ink hover:bg-danger-deep"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onEdit} className="btn-ghost">
              <EditIcon className="h-4 w-4" /> Edit
            </button>
            {safeSource && (
              <a
                href={safeSource}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Open source
              </a>
            )}
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${inspo.title}`}
              className="btn-ghost ml-auto px-3 text-muted hover:border-berry hover:text-berry"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )
      }
    >
      <div className="space-y-5 p-5">
        <div className="flex items-start gap-3 pr-10">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Inspo</p>
            <h2 className="display mt-1 text-2xl font-semibold leading-tight">
              {inspo.title}
            </h2>
            {inspo.seasons.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                {inspo.seasons.map((s) => SEASON_LABEL[s]).join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={inspo.favorite}
            aria-label={inspo.favorite ? "Unfavourite" : "Favourite"}
            className={`mt-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              inspo.favorite
                ? "bg-berry text-bone"
                : "border border-line bg-shell text-ink-soft hover:border-ink"
            }`}
          >
            <HeartIcon filled={inspo.favorite} className="h-5 w-5" />
          </button>
        </div>

        {inspo.imageIds.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {inspo.imageIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => urls[id] && setLightbox(urls[id])}
                className="aspect-square overflow-hidden rounded-xl bg-bone-deep transition-opacity hover:opacity-90"
              >
                {urls[id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[id]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {inspo.note && (
          <div>
            <p className="eyebrow mb-1">Notes</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {inspo.note}
            </p>
          </div>
        )}

        {pieces.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Pieces you own</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {pieces.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => onOpenPiece(piece.id)}
                  className="group overflow-hidden rounded-xl border border-line text-left transition-colors hover:border-ink"
                >
                  <span className="block aspect-square overflow-hidden bg-bone-deep">
                    <ItemPhoto
                      imageId={piece.imageId}
                      alt={piece.name}
                      category={piece.category}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                    />
                  </span>
                  <span className="block truncate px-2 py-1.5 text-[11px] font-medium">
                    {piece.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {inspo.tags.length > 0 && (
          <div>
            <p className="eyebrow mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {inspo.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-berry-soft px-2.5 py-1 text-xs font-medium text-berry-deep"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <button
          type="button"
          onClick={() => setLightbox(null)}
          aria-label="Close image"
          className="animate-fade fixed inset-0 z-[70] flex items-center justify-center bg-ink/85 p-6 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </button>
      )}
    </Modal>
  );
}
