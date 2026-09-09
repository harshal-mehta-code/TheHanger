"use client";

import { useState } from "react";
import Modal from "./Modal";
import ItemPhoto from "./ItemPhoto";
import {
  ArchiveIcon,
  CheckIcon,
  CloseIcon,
  EditIcon,
  HeartIcon,
  TrashIcon,
} from "./Icons";
import {
  CATEGORY_LABEL,
  COLOR_BY_ID,
  FORMALITIES,
  SEASON_LABEL,
  STATUSES,
} from "@/lib/taxonomy";
import type { Item, ItemStatus } from "@/lib/types";
import { costPerWear, formatLastWorn, todayISO } from "@/lib/wardrobe";

interface Props {
  item: Item;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onToggleArchived: () => void;
  onSetStatus: (status: ItemStatus) => void;
  onLogWear: (date: string) => void;
  onRemoveWear: (date: string) => void;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

export default function ItemDetail({
  item,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleArchived,
  onSetStatus,
  onLogWear,
  onRemoveWear,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [wearDate, setWearDate] = useState(todayISO());

  const color = item.color ? COLOR_BY_ID[item.color] : undefined;
  const cpw = costPerWear(item);
  const recentWears = [...item.wears].reverse().slice(0, 12);
  const wornToday = item.wears.some((w) => w.date === todayISO());

  return (
    <Modal
      title={item.name}
      hideTitle
      onClose={onClose}
      wide
      footer={
        confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">
              Move “{item.name}” to Recently deleted? You can restore
              it for 30 days.
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
              {wornToday ? "Worn today" : "Wore it today"}
            </button>
            <button type="button" onClick={onEdit} className="btn-ghost">
              <EditIcon className="h-4 w-4" /> Edit
            </button>
            <button
                type="button"
                onClick={onToggleArchived}
                className="btn-ghost"
                title={
                  item.archived
                    ? "Move back into the active closet"
                    : "Move to the archive (donate / store away)"
                }
              >
                <ArchiveIcon className="h-4 w-4" />
                {item.archived ? "Unarchive" : "Archive"}
              </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${item.name}`}
              className="btn-ghost ml-auto px-3 text-muted hover:border-berry hover:text-berry"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )
      }
    >
      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-bone-deep">
          <ItemPhoto
            imageId={item.imageId}
            alt={item.name}
            category={item.category}
            size="sheet"
            className="aspect-[3/4] h-full w-full"
          />
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={item.favorite}
            aria-label={item.favorite ? "Unfavourite" : "Favourite"}
            // Bottom corner keeps it clear of the sheet's floating close button.
            className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
              item.favorite
                ? "bg-berry text-bone"
                : "bg-shell/88 text-ink-soft hover:bg-shell"
            }`}
          >
            <HeartIcon filled={item.favorite} className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Right padding keeps the title clear of the floating close button. */}
          <div className="pr-10">
            <p className="eyebrow">{CATEGORY_LABEL[item.category]}</p>
            <h2 className="display mt-1 text-2xl font-semibold leading-tight">
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {[item.brand, item.subtype].filter(Boolean).join(" · ") ||
                "No brand noted"}
            </p>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Right now</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSetStatus(s.id)}
                  data-active={item.status === s.id}
                  className="chip"
                >
                  <span aria-hidden>{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-bone px-3 py-1.5 text-xs font-semibold">
              Worn {item.wears.length}{" "}
              {item.wears.length === 1 ? "time" : "times"}
            </span>
            <span className="rounded-full bg-bone px-3 py-1.5 text-xs font-semibold">
              {formatLastWorn(item)}
            </span>
            {cpw !== null && (
              <span
                className="rounded-full bg-sage-soft px-3 py-1.5 text-xs font-semibold text-sage"
                title="Price divided by number of wears"
              >
                {cpw.toFixed(2)} per wear
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <Detail
              label="Seasons"
              value={
                item.seasons.length
                  ? item.seasons.map((s) => SEASON_LABEL[s]).join(", ")
                  : "All year"
              }
            />
            <Detail
              label="Colour"
              value={
                color ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-ink/15"
                      style={{ background: color.hex }}
                    />
                    {color.label}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <Detail label="Size" value={item.size || "—"} />
            <Detail label="Kept in" value={item.location || "—"} />
            <Detail
              label="Dress code"
              value={
                FORMALITIES.find((f) => f.id === item.formality)?.label ?? "Any"
              }
            />
            {item.purchasedOn && (
              <Detail label="Bought" value={formatDay(item.purchasedOn)} />
            )}
            {item.price != null && (
              <Detail label="Price" value={item.price.toFixed(2)} />
            )}
          </dl>

          {item.tags.length > 0 && (
            <div>
              <p className="eyebrow mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
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

          {item.notes && (
            <div>
              <p className="eyebrow mb-1">Notes</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                {item.notes}
              </p>
            </div>
          )}

          <div>
            <p className="eyebrow mb-2">Wear history</p>

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

            {item.wears.length === 0 ? (
              <p className="text-sm text-muted">
                Not worn yet — it&apos;s waiting for its moment.
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
                {item.wears.length > recentWears.length && (
                  <li className="self-center text-xs text-muted">
                    +{item.wears.length - recentWears.length} earlier
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
