"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import InspoCard from "@/components/InspoCard";
import InspoDetail from "@/components/InspoDetail";
import InspoEditor from "@/components/InspoEditor";
import ItemDetail from "@/components/ItemDetail";
import { HeartIcon, SparkleIcon } from "@/components/Icons";
import { SEASONS } from "@/lib/taxonomy";
import { useCloset } from "@/lib/store";
import type { Inspo, Item, Season } from "@/lib/types";
import { collectFacets } from "@/lib/wardrobe";

type Editing = { mode: "new" } | { mode: "edit"; inspo: Inspo } | null;

export default function InspoPage() {
  const {
    items,
    inspo,
    ready,
    addInspo,
    updateInspo,
    deleteInspo,
    toggleInspoFavorite,
    toggleFavorite,
    toggleArchived,
    setStatus,
    logWear,
    removeWear,
    deleteItem,
  } = useCloset();

  const [search, setSearch] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openPieceId, setOpenPieceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const facets = useMemo(() => collectFacets(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inspo
      .filter((board) => !favoritesOnly || board.favorite)
      .filter(
        (board) =>
          seasons.length === 0 || seasons.some((s) => board.seasons.includes(s)),
      )
      .filter((board) => {
        if (!q) return true;
        const hay = [board.title, board.note, ...board.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return q.split(/\s+/).every((t) => hay.includes(t));
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [inspo, search, seasons, favoritesOnly]);

  const openBoard = openId ? inspo.find((x) => x.id === openId) ?? null : null;
  const openPiece = openPieceId
    ? items.find((i) => i.id === openPieceId) ?? null
    : null;

  /** Linked pieces, minus any that have since been deleted. */
  const piecesOf = useCallback(
    (board: Inspo): Item[] =>
      board.itemIds
        .map((id) => byId.get(id))
        .filter((i): i is Item => Boolean(i)),
    [byId],
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl px-4 pb-28 sm:px-6 sm:pb-16">
      <AppHeader
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search your inspo…",
        }}
        addLabel="New inspo"
        onAdd={() => setEditing({ mode: "new" })}
        subtitle={`${inspo.length} saved ${inspo.length === 1 ? "look" : "looks"}`}
        onNotify={flash}
      />

      {!ready ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-surface animate-pulse overflow-hidden">
              <div className="aspect-[4/5] bg-bone-deep" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 rounded-full bg-bone-deep" />
              </div>
            </div>
          ))}
        </div>
      ) : inspo.length === 0 ? (
        <EmptyInspo onAdd={() => setEditing({ mode: "new" })} />
      ) : (
        <div className="space-y-4">
          <div className="fade-rail no-scrollbar -mr-4 flex items-center gap-2 overflow-x-auto pr-4 sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0">
            {SEASONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setSeasons((prev) =>
                    prev.includes(s.id)
                      ? prev.filter((x) => x !== s.id)
                      : [...prev, s.id],
                  )
                }
                data-active={seasons.includes(s.id)}
                className="chip shrink-0"
              >
                <span aria-hidden>{s.emoji}</span>
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              data-active={favoritesOnly}
              className="chip shrink-0"
            >
              <HeartIcon filled={favoritesOnly} className="h-3.5 w-3.5" />
              Loved
            </button>
            <span className="ml-auto hidden shrink-0 text-xs text-muted sm:inline">
              {visible.length} {visible.length === 1 ? "board" : "boards"}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="card-surface animate-rise px-6 py-14 text-center">
              <p className="display text-xl font-semibold">Nothing matches</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                Try a different season, or clear the search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {visible.map((board, i) => (
                <InspoCard
                  key={board.id}
                  inspo={board}
                  linkedCount={board.itemIds.filter((id) => byId.has(id)).length}
                  index={i}
                  onOpen={() => setOpenId(board.id)}
                  onToggleFavorite={() => void toggleInspoFavorite(board.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {editing?.mode === "new" && (
        <InspoEditor
          items={items.filter((i) => !i.archived)}
          knownTags={facets.tags}
          onClose={() => setEditing(null)}
          onSave={async (draft, images) => {
            await addInspo(draft, images);
            flash(`“${draft.title}” saved.`);
          }}
        />
      )}

      {editing?.mode === "edit" && (
        <InspoEditor
          inspo={editing.inspo}
          items={items.filter((i) => !i.archived)}
          knownTags={facets.tags}
          onClose={() => setEditing(null)}
          onSave={async (draft, images) => {
            await updateInspo(editing.inspo.id, draft, images);
            flash("Updated.");
          }}
        />
      )}

      {openBoard && !editing && !openPiece && (
        <InspoDetail
          inspo={openBoard}
          pieces={piecesOf(openBoard)}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditing({ mode: "edit", inspo: openBoard })}
          onDelete={async () => {
            const title = openBoard.title;
            setOpenId(null);
            await deleteInspo(openBoard.id);
            flash(`Removed “${title}”.`);
          }}
          onToggleFavorite={() => void toggleInspoFavorite(openBoard.id)}
          onOpenPiece={setOpenPieceId}
        />
      )}

      {openPiece && (
        <ItemDetail
          item={openPiece}
          onClose={() => setOpenPieceId(null)}
          onEdit={() => setOpenPieceId(null)}
          onDelete={async () => {
            setOpenPieceId(null);
            await deleteItem(openPiece.id);
          }}
          onToggleFavorite={() => void toggleFavorite(openPiece.id)}
          onToggleArchived={() => void toggleArchived(openPiece.id)}
          onSetStatus={(status) => void setStatus(openPiece.id, status)}
          onLogWear={(date) => void logWear(openPiece.id, date)}
          onRemoveWear={(date) => void removeWear(openPiece.id, date)}
        />
      )}

      <BottomNav />

      {toast && (
        <div
          role="status"
          className="animate-rise fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-bone shadow-[var(--shadow-lift)] sm:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyInspo({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="animate-rise card-surface mx-auto mt-6 max-w-xl px-6 py-14 text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-berry-soft text-3xl">
        🖼️
      </span>
      <h2 className="display mt-6 text-2xl font-semibold">
        Save the looks you love
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        A place for whole outfits, colour stories and vibes — pins you&apos;ve
        saved, a look you put together, jewellery and shoes that go with it.
        Link pieces you already own so you know what you&apos;re working with.
      </p>
      <button type="button" onClick={onAdd} className="btn-primary mx-auto mt-6">
        <SparkleIcon className="h-4 w-4" />
        Save your first look
      </button>
    </div>
  );
}
