"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import ItemDetail from "@/components/ItemDetail";
import ItemEditor from "@/components/ItemEditor";
import ItemPhoto from "@/components/ItemPhoto";
import { HangerMark } from "@/components/Icons";
import { CATEGORIES, CATEGORY_LABEL, STATUS_BY_ID } from "@/lib/taxonomy";
import { useCloset } from "@/lib/store";
import type { Item } from "@/lib/types";
import {
  collectFacets,
  costPerWear,
  daysSinceWorn,
  formatLastWorn,
} from "@/lib/wardrobe";

const MONTHS = 6;

export default function InsightsPage() {
  const {
    items,
    outfits,
    ready,
    toggleFavorite,
    toggleArchived,
    setStatus,
    logWear,
    removeWear,
    deleteItem,
    updateItem,
  } = useCloset();

  const [openId, setOpenId] = useState<string | null>(null);
  const [editingPiece, setEditingPiece] = useState<Item | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const closet = useMemo(
    () => items.filter((i) => !i.wishlist && !i.archived),
    [items],
  );

  const data = useMemo(() => {
    const totalWears = closet.reduce((n, i) => n + i.wears.length, 0);
    const spend = closet.reduce((n, i) => n + (i.price ?? 0), 0);
    const priced = closet.filter((i) => i.price != null && i.price > 0);

    // Wears per calendar month for the last MONTHS months, oldest first.
    const now = new Date();
    const months = Array.from({ length: MONTHS }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - idx), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        label: d.toLocaleDateString(undefined, { month: "short" }),
        count: closet.reduce(
          (n, i) => n + i.wears.filter((w) => w.date.startsWith(key)).length,
          0,
        ),
      };
    });

    const byCategory = CATEGORIES.map((c) => {
      const own = closet.filter((i) => i.category === c.id);
      return {
        ...c,
        count: own.length,
        wears: own.reduce((n, i) => n + i.wears.length, 0),
        spend: own.reduce((n, i) => n + (i.price ?? 0), 0),
      };
    })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);

    const bestValue = priced
      .map((i) => ({ item: i, cpw: costPerWear(i)! }))
      .sort((a, b) => a.cpw - b.cpw)
      .slice(0, 5);

    const worstValue = priced
      .filter((i) => i.wears.length <= 2)
      .map((i) => ({ item: i, cpw: costPerWear(i)! }))
      .sort((a, b) => b.cpw - a.cpw)
      .slice(0, 5);

    const mostWorn = [...closet]
      .filter((i) => i.wears.length > 0)
      .sort((a, b) => b.wears.length - a.wears.length)
      .slice(0, 5);

    const forgotten = [...closet]
      .sort(
        (a, b) =>
          (daysSinceWorn(b) ?? Number.POSITIVE_INFINITY) -
          (daysSinceWorn(a) ?? Number.POSITIVE_INFINITY),
      )
      .slice(0, 5);

    const away = closet.filter((i) => i.status !== "ready");

    return {
      totalWears,
      spend,
      months,
      byCategory,
      bestValue,
      worstValue,
      mostWorn,
      forgotten,
      away,
      neverWorn: closet.filter((i) => i.wears.length === 0).length,
      pricedCount: priced.length,
    };
  }, [closet]);

  const openItem = openId ? items.find((i) => i.id === openId) ?? null : null;
  const facets = useMemo(() => collectFacets(items), [items]);
  const peakMonth = Math.max(1, ...data.months.map((m) => m.count));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 pb-28 sm:px-6 sm:pb-16">
      <AppHeader
        subtitle="What your closet is actually doing"
        onNotify={flash}
      />

      {!ready ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-surface h-48 animate-pulse" />
          ))}
        </div>
      ) : closet.length === 0 ? (
        <div className="animate-rise card-surface mx-auto mt-6 max-w-xl px-6 py-14 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-berry-soft text-berry">
            <HangerMark className="animate-swing h-11 w-11" />
          </span>
          <h2 className="display mt-6 text-2xl font-semibold">
            Nothing to measure yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Add pieces and log what you wear — the patterns show up here on
            their own.
          </p>
          <Link href="/" className="btn-primary mx-auto mt-6 w-fit">
            Go to the closet
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* headline numbers */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pieces" value={closet.length} />
            <Stat label="Wears logged" value={data.totalWears} tone="sage" />
            <Stat
              label="Looks saved"
              value={outfits.length}
              tone="berry"
            />
            <Stat
              label="Never worn"
              value={data.neverWorn}
              tone="gold"
              hint={`${Math.round((data.neverWorn / closet.length) * 100)}% of the closet`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* wear activity */}
            <section className="card-surface p-5">
              <h2 className="display text-lg font-semibold">Wear activity</h2>
              <p className="mt-0.5 text-xs text-muted">
                Wears logged per month, last {MONTHS} months
              </p>
              <div className="mt-5 flex gap-2">
                {data.months.map((m) => (
                  <div
                    key={m.key}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-xs font-semibold tabular-nums text-ink-soft">
                      {m.count || ""}
                    </span>
                    {/* The track needs an explicit height for the bar's
                        percentage height to resolve against. */}
                    <div className="flex h-32 w-full items-end">
                      <div
                        className="w-full rounded-t-lg bg-berry/85 transition-all"
                        style={{
                          // A floor keeps empty months visible as a hairline.
                          height: `${Math.max(2, (m.count / peakMonth) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-muted">{m.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* category mix */}
            <section className="card-surface p-5">
              <h2 className="display text-lg font-semibold">What you own</h2>
              <p className="mt-0.5 text-xs text-muted">
                Pieces per category, and how often each gets worn
              </p>
              <ul className="mt-4 space-y-2.5">
                {data.byCategory.slice(0, 7).map((c) => (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 truncate text-xs font-medium">
                      <span aria-hidden className="mr-1">
                        {c.emoji}
                      </span>
                      {c.label}
                    </span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bone-deep">
                      <span
                        className="block h-full rounded-full bg-sage-bright"
                        style={{
                          width: `${(c.count / data.byCategory[0].count) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted">
                      {c.count} · {c.wears} wears
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {data.away.length > 0 && (
            <section className="card-surface p-5">
              <h2 className="display text-lg font-semibold">Not ready to wear</h2>
              <p className="mt-0.5 text-xs text-muted">
                {data.away.length}{" "}
                {data.away.length === 1 ? "piece is" : "pieces are"} in the wash,
                at the cleaner, or waiting to be mended
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.away.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => setOpenId(i.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-xs font-medium transition-colors hover:border-ink"
                  >
                    <span className="h-6 w-6 overflow-hidden rounded-full">
                      <ItemPhoto
                        imageId={i.imageId}
                        alt=""
                        category={i.category}
                        className="h-full w-full"
                      />
                    </span>
                    {i.name}
                    <span aria-hidden>{STATUS_BY_ID[i.status].emoji}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Leaderboard
              title="Working hardest"
              subtitle="Most-worn pieces in your closet"
              rows={data.mostWorn.map((item) => ({
                item,
                right: `${item.wears.length} wears`,
              }))}
              onOpen={setOpenId}
            />
            <Leaderboard
              title="Waiting the longest"
              subtitle="Nothing's wrong with these — they've just been skipped"
              rows={data.forgotten.map((item) => ({
                item,
                right: formatLastWorn(item),
              }))}
              onOpen={setOpenId}
            />
          </div>

          {data.pricedCount > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Leaderboard
                title="Best value"
                subtitle="Lowest cost per wear — the pieces that earned their keep"
                rows={data.bestValue.map(({ item, cpw }) => ({
                  item,
                  right: `${cpw.toFixed(2)} / wear`,
                }))}
                onOpen={setOpenId}
              />
              <Leaderboard
                title="Yet to earn their keep"
                subtitle="Bought but barely worn — wear one this week"
                rows={data.worstValue.map(({ item, cpw }) => ({
                  item,
                  right: `${cpw.toFixed(2)} / wear`,
                }))}
                empty="Everything you've priced is getting worn."
                onOpen={setOpenId}
              />
            </div>
          )}

          {data.spend > 0 && (
            <section className="card-surface p-5">
              <h2 className="display text-lg font-semibold">Spend by category</h2>
              <p className="mt-0.5 text-xs text-muted">
                From the {data.pricedCount} pieces with a price recorded ·{" "}
                {data.spend.toFixed(2)} total
              </p>
              <ul className="mt-4 space-y-2.5">
                {[...data.byCategory]
                  .filter((c) => c.spend > 0)
                  .sort((a, b) => b.spend - a.spend)
                  .map((c, _, arr) => (
                    <li key={c.id} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 truncate text-xs font-medium">
                        {CATEGORY_LABEL[c.id]}
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-bone-deep">
                        <span
                          className="block h-full rounded-full bg-gold-bright"
                          style={{ width: `${(c.spend / arr[0].spend) * 100}%` }}
                        />
                      </span>
                      <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted">
                        {c.spend.toFixed(0)}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {openItem && !editingPiece && (
        <ItemDetail
          item={openItem}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditingPiece(openItem)}
          onDelete={async () => {
            setOpenId(null);
            await deleteItem(openItem.id);
          }}
          onToggleFavorite={() => void toggleFavorite(openItem.id)}
          onToggleArchived={() => void toggleArchived(openItem.id)}
          onSetStatus={(status) => void setStatus(openItem.id, status)}
          onLogWear={(date) => void logWear(openItem.id, date)}
          onRemoveWear={(date) => void removeWear(openItem.id, date)}
        />
      )}

      {/* Editing a piece from here opens the closet's own editor, rather than
          bouncing her back to the closet to find it again. */}
      {editingPiece && (
        <ItemEditor
          item={editingPiece}
          knownBrands={facets.brands}
          knownTags={facets.tags}
          usedLocations={facets.locations}
          onClose={() => setEditingPiece(null)}
          onSave={async (draft, photo) => {
            await updateItem(editingPiece.id, draft, photo);
          }}
        />
      )}

      <BottomNav />

      {toast && (
        <div
          role="status"
          className="animate-rise fixed bottom-20 left-1/2 z-[60] sm:bottom-6 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bone shadow-[var(--shadow-lift)]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "ink" | "berry" | "gold" | "sage";
}) {
  const toneClass = {
    ink: "text-ink",
    berry: "text-berry",
    gold: "text-gold",
    sage: "text-sage",
  }[tone];
  return (
    <div className="card-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={`display mt-1 text-2xl font-semibold ${toneClass}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Leaderboard({
  title,
  subtitle,
  rows,
  empty,
  onOpen,
}: {
  title: string;
  subtitle: string;
  rows: { item: Item; right: string }[];
  empty?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="card-surface p-5">
      <h2 className="display text-lg font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{empty ?? "Nothing here yet."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.map(({ item, right }) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full items-center gap-3 py-2 text-left transition-opacity hover:opacity-70"
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-bone-deep">
                  <ItemPhoto
                    imageId={item.imageId}
                    alt=""
                    category={item.category}
                    className="h-full w-full"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {item.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.brand || CATEGORY_LABEL[item.category]}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
                  {right}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
