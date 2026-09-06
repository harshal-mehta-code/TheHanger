"use client";

import type { ClosetStats } from "@/lib/wardrobe";

interface Props {
  stats: ClosetStats;
  onShowNeglected: () => void;
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

/**
 * Insights is where the closet gets measured, so this stays deliberately
 * small: a single line on a phone, four tiles only where there's room to
 * spare. The point of the closet screen is the clothes.
 */
export default function ClosetPulse({
  stats,
  onShowNeglected,
  onShowFavorites,
}: Props) {
  return (
    <section aria-label="Closet at a glance">
      <p className="text-sm text-muted sm:hidden">
        <span className="font-semibold text-ink">{stats.total} pieces</span>
        {stats.neglected > 0 && (
          <>
            {" · "}
            <button
              type="button"
              onClick={onShowNeglected}
              className="font-medium text-gold underline-offset-4 hover:underline"
            >
              {stats.neglected} need love
            </button>
          </>
        )}
      </p>

      <div className="hidden gap-3 sm:grid sm:grid-cols-4">
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
          onClick={onShowFavorites}
        />
      </div>
    </section>
  );
}
