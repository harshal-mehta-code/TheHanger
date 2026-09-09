"use client";

import { useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import { CheckIcon, CloseIcon, EditIcon, HeartIcon, TrashIcon } from "./Icons";
import { FORMALITIES, SEASON_LABEL, STATUS_BY_ID } from "@/lib/taxonomy";
import type { Item, Outfit } from "@/lib/types";
import { formatLastWorn, todayISO } from "@/lib/wardrobe";

interface Props {
  outfit: Outfit;
  pieces: Item[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onLogWear: (date: string) => void;
  onRemoveWear: (date: string) => void;
  onOpenPiece: (id: string) => void;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OutfitDetail({
  outfit,
  pieces,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onLogWear,
  onRemoveWear,
  onOpenPiece,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [wearDate, setWearDate] = useState(todayISO());

  const wornToday = outfit.wears.some((w) => w.date === todayISO());
  const recentWears = [...outfit.wears].reverse().slice(0, 12);
  const blocked = pieces.filter((p) => p.status !== "ready");
  const totalPrice = pieces.reduce((sum, p) => sum + (p.price ?? 0), 0);

  return (
    <Modal
      title={outfit.name}
      hideTitle
      onClose={onClose}
      wide
      footer={
        confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              Delete the look “{outfit.name}”?
            </p>
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
                className="btn-primary bg-berry-deep text-bone hover:bg-berry"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onLogWear(todayISO())}
              disabled={wornToday}
              className="btn-primary flex-1 disabled:cursor-default disabled:bg-sage disabled:text-bone disabled:opacity-100 sm:flex-none"
            >
              <CheckIcon className="h-4 w-4" />
              {wornToday ? "Worn today" : "Wore this today"}
            </button>
            <button type="button" onClick={onEdit} className="btn-ghost">
              <EditIcon className="h-4 w-4" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${outfit.name}`}
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
            <p className="eyebrow">Look</p>
            <h2 className="display mt-1 text-2xl font-semibold leading-tight">
              {outfit.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
              {outfit.seasons.length > 0 &&
                ` · ${outfit.seasons.map((s) => SEASON_LABEL[s]).join(", ")}`}
              {outfit.formality &&
                ` · ${FORMALITIES.find((f) => f.id === outfit.formality)?.label}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={outfit.favorite}
            aria-label={outfit.favorite ? "Unfavourite" : "Favourite"}
            className={`mt-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              outfit.favorite
                ? "bg-berry text-bone"
                : "border border-line bg-shell text-ink-soft hover:border-ink"
            }`}
          >
            <HeartIcon filled={outfit.favorite} className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-bone px-3 py-1.5 text-xs font-semibold">
            Worn {outfit.wears.length}{" "}
            {outfit.wears.length === 1 ? "time" : "times"}
          </span>
          <span className="rounded-full bg-bone px-3 py-1.5 text-xs font-semibold">
            {formatLastWorn(outfit)}
          </span>
          {totalPrice > 0 && (
            <span className="rounded-full bg-bone px-3 py-1.5 text-xs font-semibold">
              {totalPrice.toFixed(2)} on the rail
            </span>
          )}
          {blocked.length > 0 && (
            <span className="rounded-full bg-gold-soft px-3 py-1.5 text-xs font-semibold text-gold-ink">
              {blocked.length} not ready to wear
            </span>
          )}
        </div>

        <div>
          <p className="eyebrow mb-2">The pieces</p>
          {pieces.length === 0 ? (
            <p className="text-sm text-muted">
              Every piece in this look has been deleted from the closet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {pieces.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => onOpenPiece(piece.id)}
                  className="group overflow-hidden rounded-xl border border-line text-left transition-colors hover:border-ink"
                >
                  <div className="relative aspect-square overflow-hidden bg-bone-deep">
                    <ItemPhoto
                      imageId={piece.imageId}
                      alt={piece.name}
                      category={piece.category}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                    />
                    {piece.status !== "ready" && (
                      <span
                        className="absolute left-1.5 top-1.5 rounded-full bg-shell/95 px-1.5 py-0.5 text-[10px]"
                        title={STATUS_BY_ID[piece.status].label}
                      >
                        {STATUS_BY_ID[piece.status].emoji}
                      </span>
                    )}
                  </div>
                  <span className="block truncate px-2 py-1.5 text-[11px] font-medium">
                    {piece.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {outfit.tags.length > 0 && (
          <div>
            <p className="eyebrow mb-1.5">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {outfit.tags.map((t) => (
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

        {outfit.notes && (
          <div>
            <p className="eyebrow mb-1">Notes</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {outfit.notes}
            </p>
          </div>
        )}

        <div>
          <p className="eyebrow mb-2">Worn on</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={wearDate}
              max={todayISO()}
              onChange={(e) => setWearDate(e.target.value)}
              aria-label="Date worn"
              className="field w-auto py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => wearDate && onLogWear(wearDate)}
              className="btn-ghost py-1.5 text-sm"
            >
              Log this day
            </button>
          </div>

          {outfit.wears.length === 0 ? (
            <p className="text-sm text-muted">
              Not worn yet — logging it here also logs every piece in it.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {recentWears.map((w) => (
                <li key={w.date}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
                    {formatDay(w.date)}
                    <button
                      type="button"
                      onClick={() => onRemoveWear(w.date)}
                      aria-label={`Remove wear on ${formatDay(w.date)}`}
                      className="text-muted transition-colors hover:text-berry"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
              {outfit.wears.length > recentWears.length && (
                <li className="self-center text-xs text-muted">
                  +{outfit.wears.length - recentWears.length} earlier
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
