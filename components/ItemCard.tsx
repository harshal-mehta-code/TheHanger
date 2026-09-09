"use client";

import ItemPhoto from "./ItemPhoto";
import { CheckIcon, HeartIcon } from "./Icons";
import { COLOR_BY_ID, SEASONS, STATUS_BY_ID } from "@/lib/taxonomy";
import type { Item } from "@/lib/types";
import { daysSinceWorn, formatLastWorn } from "@/lib/wardrobe";

interface Props {
  item: Item;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onWear: () => void;
  /** Set briefly after logging a wear so the card can celebrate. */
  justWorn: boolean;
  index: number;
}

export default function ItemCard({
  item,
  onOpen,
  onToggleFavorite,
  onWear,
  justWorn,
  index,
}: Props) {
  const days = daysSinceWorn(item);
  const neglected = days === null || days >= 90;
  const color = item.color ? COLOR_BY_ID[item.color] : undefined;
  const status = STATUS_BY_ID[item.status] ?? STATUS_BY_ID.ready;

  return (
    <div
      className="group animate-rise relative"
      // A gentle cascade as the grid paints, capped so late cards aren't slow.
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="card-surface block w-full overflow-hidden text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-bone-deep">
          <ItemPhoto
            imageId={item.imageId}
            alt={item.name}
            category={item.category}
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
          />

          {item.archived && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-bone backdrop-blur-sm">
              Archived
            </span>
          )}

          {/* Where a piece is beats how long since it was worn: if it's in the
              wash, "needs love" is not the useful thing to say. */}
          {!item.archived && status.badge && (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-shell/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-soft backdrop-blur-sm">
              <span aria-hidden>{status.emoji}</span>
              {status.short}
            </span>
          )}

          {!item.archived && !status.badge && neglected && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-gold-soft/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gold-ink backdrop-blur-sm">
              {days === null ? "Unworn" : "Needs love"}
            </span>
          )}

          {justWorn && (
            <span className="animate-pop absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-sage-bright/95 py-2 text-xs font-semibold text-ink">
              <CheckIcon className="h-4 w-4" /> Logged for today
            </span>
          )}
        </div>

        <div className="space-y-1.5 p-3">
          <div className="flex items-start gap-1.5">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug">
              {item.name}
            </h3>
            {color && (
              <span
                title={color.label}
                className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-1 ring-inset ring-ink/15"
                style={{ background: color.hex }}
              />
            )}
          </div>

          <p className="truncate text-xs text-muted">
            {item.brand || item.subtype || " "}
          </p>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span
              className={`truncate text-[11px] font-medium ${
                neglected ? "text-gold" : "text-sage"
              }`}
            >
              {formatLastWorn(item)}
            </span>
            <span className="flex shrink-0 gap-0.5 text-[11px] opacity-70">
              {SEASONS.filter((s) => item.seasons.includes(s.id)).map((s) => (
                <span key={s.id} title={s.label} role="img" aria-label={s.label}>
                  {s.emoji}
                </span>
              ))}
            </span>
          </div>
        </div>
      </button>

      {/* Quick actions sit above the card button rather than inside it. */}
      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={
            item.favorite ? `Unfavourite ${item.name}` : `Favourite ${item.name}`
          }
          aria-pressed={item.favorite}
          className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
            item.favorite
              ? "bg-berry text-bone shadow-sm"
              : "bg-shell/85 text-ink-soft opacity-100 hover:bg-shell sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <HeartIcon filled={item.favorite} className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onWear}
          aria-label={`Log that ${item.name} was worn today`}
          className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-shell/85 text-ink-soft opacity-100 backdrop-blur-sm transition-all hover:bg-sage-bright hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
          title="Wore it today"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
