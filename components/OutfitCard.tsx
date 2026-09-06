"use client";

import ItemPhoto from "./ItemPhoto";
import { CheckIcon, HeartIcon } from "./Icons";
import { SEASONS, STATUS_BY_ID } from "@/lib/taxonomy";
import type { Item, Outfit } from "@/lib/types";
import { formatLastWorn } from "@/lib/wardrobe";

interface Props {
  outfit: Outfit;
  pieces: Item[];
  onOpen: () => void;
  onToggleFavorite: () => void;
  onWear: () => void;
  justWorn: boolean;
  index: number;
}

export default function OutfitCard({
  outfit,
  pieces,
  onOpen,
  onToggleFavorite,
  onWear,
  justWorn,
  index,
}: Props) {
  // Four tiles read as a look; more than that turns into confetti.
  const shown = pieces.slice(0, 4);
  const blocked = pieces.filter((p) => p.status !== "ready");

  return (
    <div
      className="group animate-rise relative"
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="card-surface block w-full overflow-hidden text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-bone-deep">
          {shown.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              No pieces yet
            </div>
          ) : (
            <div
              className={`grid h-full gap-px ${
                shown.length === 1 ? "grid-cols-1" : "grid-cols-2"
              } ${shown.length > 2 ? "grid-rows-2" : "grid-rows-1"}`}
            >
              {shown.map((piece, i) => (
                <ItemPhoto
                  key={piece.id}
                  imageId={piece.imageId}
                  alt={piece.name}
                  category={piece.category}
                  className={`h-full w-full ${
                    // Three pieces: let the first span the full left column.
                    shown.length === 3 && i === 0 ? "row-span-2" : ""
                  }`}
                />
              ))}
            </div>
          )}

          {pieces.length > shown.length && (
            <span className="absolute bottom-2 right-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-bone backdrop-blur-sm">
              +{pieces.length - shown.length}
            </span>
          )}

          {blocked.length > 0 && (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-shell/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-soft backdrop-blur-sm">
              <span aria-hidden>{STATUS_BY_ID[blocked[0].status].emoji}</span>
              {blocked.length === 1
                ? `1 piece ${blocked[0].status === "wash" ? "in the wash" : "away"}`
                : `${blocked.length} pieces away`}
            </span>
          )}

          {justWorn && (
            <span className="animate-pop absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-sage/95 py-2 text-xs font-semibold text-white">
              <CheckIcon className="h-4 w-4" /> Logged for today
            </span>
          )}
        </div>

        <div className="space-y-1 p-3">
          <h3 className="truncate text-sm font-semibold leading-snug">
            {outfit.name}
          </h3>
          <p className="truncate text-xs text-muted">
            {pieces.length} {pieces.length === 1 ? "piece" : "pieces"}
            {pieces.length > 0 && ` · ${pieces.map((p) => p.name).join(", ")}`}
          </p>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="truncate text-[11px] font-medium text-sage">
              {formatLastWorn(outfit)}
            </span>
            <span className="flex shrink-0 gap-0.5 text-[11px] opacity-70">
              {SEASONS.filter((s) => outfit.seasons.includes(s.id)).map((s) => (
                <span key={s.id} title={s.label} role="img" aria-label={s.label}>
                  {s.emoji}
                </span>
              ))}
            </span>
          </div>
        </div>
      </button>

      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={
            outfit.favorite
              ? `Unfavourite ${outfit.name}`
              : `Favourite ${outfit.name}`
          }
          aria-pressed={outfit.favorite}
          className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
            outfit.favorite
              ? "bg-berry text-white shadow-sm"
              : "bg-white/85 text-ink-soft opacity-0 hover:bg-white group-hover:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <HeartIcon filled={outfit.favorite} className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onWear}
          aria-label={`Log that ${outfit.name} was worn today`}
          title="Wore this look today"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-ink-soft opacity-0 backdrop-blur-sm transition-all hover:bg-sage hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
