"use client";

import { useEffect, useState } from "react";
import { HeartIcon } from "./Icons";
import { getImageUrl } from "@/lib/db";
import { SEASONS } from "@/lib/taxonomy";
import type { Inspo } from "@/lib/types";

interface Props {
  inspo: Inspo;
  linkedCount: number;
  onOpen: () => void;
  onToggleFavorite: () => void;
  index: number;
}

export default function InspoCard({
  inspo,
  linkedCount,
  onOpen,
  onToggleFavorite,
  index,
}: Props) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  // Up to three tiles reads as a board without becoming a mosaic.
  const shown = inspo.imageIds.slice(0, 3);

  useEffect(() => {
    let cancelled = false;
    Promise.all(shown.map((id) => getImageUrl(id))).then((resolved) => {
      if (!cancelled) setUrls(resolved);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspo.imageIds.join(",")]);

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
        <div className="relative aspect-[4/5] overflow-hidden bg-bone-deep">
          {shown.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              {linkedCount > 0 ? `${linkedCount} pieces` : "No images yet"}
            </div>
          ) : (
            <div
              className={`grid h-full gap-px ${
                shown.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
            >
              {shown.map((id, i) => (
                <div
                  key={id}
                  className={`overflow-hidden ${
                    // With three images the first takes the tall left column.
                    shown.length === 3 && i === 0 ? "row-span-2" : ""
                  }`}
                >
                  {urls[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[i]!}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="h-full w-full bg-bone-deep" />
                  )}
                </div>
              ))}
            </div>
          )}

          {inspo.imageIds.length > shown.length && (
            <span className="absolute bottom-2 right-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-bone backdrop-blur-sm">
              +{inspo.imageIds.length - shown.length}
            </span>
          )}
        </div>

        <div className="space-y-1 p-3">
          <h3 className="truncate text-sm font-semibold leading-snug">
            {inspo.title}
          </h3>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted">
              {linkedCount > 0
                ? `${linkedCount} ${linkedCount === 1 ? "piece" : "pieces"} linked`
                : (inspo.note ?? "Saved look")}
            </span>
            <span className="flex shrink-0 gap-0.5 text-[11px] opacity-70">
              {SEASONS.filter((s) => inspo.seasons.includes(s.id)).map((s) => (
                <span key={s.id} title={s.label} role="img" aria-label={s.label}>
                  {s.emoji}
                </span>
              ))}
            </span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={
          inspo.favorite ? `Unfavourite ${inspo.title}` : `Favourite ${inspo.title}`
        }
        aria-pressed={inspo.favorite}
        className={`absolute right-2.5 top-2.5 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
          inspo.favorite
            ? "bg-berry text-bone shadow-sm"
            : "bg-shell/85 text-ink-soft opacity-100 hover:bg-shell sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <HeartIcon filled={inspo.favorite} className="h-4 w-4" />
      </button>
    </div>
  );
}
