"use client";

import type { ClosetStats } from "@/lib/wardrobe";

interface Props {
  stats: ClosetStats;
  /** Applying a stat as a filter is the point of the strip — each tile jumps. */
  onShowNeglected: () => void;
  onShowNeverWorn: () => void;
  onShowFavorites: () => void;
}

function Tile({
  label,
  value,
  hint,
  tone = "ink",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ink" | "berry" | "gold" | "sage";
  onClick?: () => void;
}) {
  const toneClass = {
    ink: "text-ink",
    berry: "text-berry",
    gold: "text-gold",
    sage: "text-sage",
  }[tone];

  const content = (
    <>
      <p className="eyebrow">{label}</p>
      <p className={`display mt-1 text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </>
  );

  if (!onClick) {
    return <div className="card-surface px-4 py-3">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-surface px-4 py-3 text-left transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      {content}
    </button>
  );
}

export default function ClosetPulse({
  stats,
  onShowNeglected,
  onShowNeverWorn,
  onShowFavorites,
}: Props) {
  return (
    <section aria-label="Closet at a glance">
      <div className="no-scrollbar -mx-4 grid grid-flow-col gap-3 overflow-x-auto px-4 [grid-auto-columns:minmax(9.5rem,1fr)] sm:mx-0 sm:grid-flow-row sm:grid-cols-4 sm:px-0">
        <Tile
          label="In the closet"
          value={stats.total}
          hint={stats.topBrand ? `Most: ${stats.topBrand.name}` : "pieces kept"}
        />
        <Tile
          label="Worn this month"
          value={stats.wornThisMonth}
          hint={
            stats.mostWorn ? `Top: ${stats.mostWorn.name}` : "log a wear to start"
          }
          tone="sage"
        />
        <Tile
          label="Needs love"
          value={stats.neglected}
          hint="unworn 90+ days"
          tone="gold"
          onClick={onShowNeglected}
        />
        <Tile
          label="Loved"
          value={stats.favorites}
          hint={`${stats.neverWorn} never worn`}
          tone="berry"
          onClick={stats.favorites > 0 ? onShowFavorites : onShowNeverWorn}
        />
      </div>
    </section>
  );
}
