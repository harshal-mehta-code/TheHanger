"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as db from "./db";
import { blobToDataUrl, dataUrlToBlob } from "./image";
import { SAMPLE_CLOSET } from "./sample";
import type {
  Item,
  ItemDraft,
  ItemStatus,
  Outfit,
  OutfitDraft,
  WearEvent,
} from "./types";
import { todayISO } from "./wardrobe";

interface ClosetContextValue {
  items: Item[];
  outfits: Outfit[];
  ready: boolean;
  error: string | null;
  addItem: (draft: ItemDraft, photo?: Blob | null) => Promise<Item>;
  updateItem: (
    id: string,
    draft: ItemDraft,
    photo?: Blob | null | undefined,
  ) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  toggleArchived: (id: string) => Promise<void>;
  toggleWishlist: (id: string) => Promise<void>;
  setStatus: (id: string, status: ItemStatus) => Promise<void>;
  logWear: (id: string, date?: string) => Promise<void>;
  removeWear: (id: string, date: string) => Promise<void>;

  addOutfit: (draft: OutfitDraft) => Promise<Outfit>;
  updateOutfit: (id: string, draft: OutfitDraft) => Promise<void>;
  deleteOutfit: (id: string) => Promise<void>;
  toggleOutfitFavorite: (id: string) => Promise<void>;
  /** Logs the outfit and every piece in it on the same day. */
  logOutfitWear: (id: string, date?: string) => Promise<void>;
  removeOutfitWear: (id: string, date: string) => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: (file: File) => Promise<number>;
  seedSample: () => Promise<number>;
  resetCloset: () => Promise<void>;
}

const ClosetContext = createContext<ClosetContextValue | null>(null);

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ClosetProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.readAllItems(), db.readAllOutfits()])
      .then(([loadedItems, loadedOutfits]) => {
        if (cancelled) return;
        setItems(loadedItems);
        setOutfits(loadedOutfits);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Couldn't open the closet's local storage. Private browsing can block it.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Apply a change to one item in both state and IndexedDB. */
  const mutate = useCallback(
    async (id: string, change: (item: Item) => Item) => {
      let next: Item | undefined;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          next = { ...change(item), updatedAt: Date.now() };
          return next;
        }),
      );
      // `next` is assigned synchronously by the updater above.
      if (next) await db.writeItem(next);
    },
    [],
  );

  const addItem = useCallback(async (draft: ItemDraft, photo?: Blob | null) => {
    const now = Date.now();
    let imageId: string | undefined;
    if (photo) {
      imageId = newId();
      await db.writeImage(imageId, photo);
    }
    const item: Item = {
      ...draft,
      id: newId(),
      imageId,
      favorite: draft.favorite ?? false,
      archived: draft.archived ?? false,
      wishlist: draft.wishlist ?? false,
      status: draft.status ?? "ready",
      wears: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.writeItem(item);
    setItems((prev) => [...prev, item]);
    return item;
  }, []);

  const updateItem = useCallback(
    async (id: string, draft: ItemDraft, photo?: Blob | null | undefined) => {
      const existing = items.find((i) => i.id === id);
      if (!existing) return;

      let imageId = existing.imageId;
      // `undefined` means "photo untouched"; `null` means "remove it".
      if (photo === null && imageId) {
        await db.removeImage(imageId);
        imageId = undefined;
      } else if (photo instanceof Blob) {
        if (imageId) await db.removeImage(imageId);
        imageId = newId();
        await db.writeImage(imageId, photo);
      }

      const next: Item = {
        ...existing,
        ...draft,
        favorite: draft.favorite ?? existing.favorite,
        archived: draft.archived ?? existing.archived,
        wishlist: draft.wishlist ?? existing.wishlist,
        status: draft.status ?? existing.status,
        imageId,
        updatedAt: Date.now(),
      };
      await db.writeItem(next);
      setItems((prev) => prev.map((i) => (i.id === id ? next : i)));
    },
    [items],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await db.removeItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));

      // An outfit must not keep pointing at a piece that no longer exists.
      const affected = outfits.filter((o) => o.itemIds.includes(id));
      if (affected.length) {
        const updated = affected.map((o) => ({
          ...o,
          itemIds: o.itemIds.filter((x) => x !== id),
          updatedAt: Date.now(),
        }));
        for (const o of updated) await db.writeOutfit(o);
        setOutfits((prev) =>
          prev.map((o) => updated.find((u) => u.id === o.id) ?? o),
        );
      }
    },
    [outfits],
  );

  const toggleFavorite = useCallback(
    (id: string) => mutate(id, (i) => ({ ...i, favorite: !i.favorite })),
    [mutate],
  );

  const toggleArchived = useCallback(
    (id: string) => mutate(id, (i) => ({ ...i, archived: !i.archived })),
    [mutate],
  );

  const toggleWishlist = useCallback(
    (id: string) => mutate(id, (i) => ({ ...i, wishlist: !i.wishlist })),
    [mutate],
  );

  const setStatus = useCallback(
    (id: string, status: ItemStatus) => mutate(id, (i) => ({ ...i, status })),
    [mutate],
  );

  const logWear = useCallback(
    (id: string, date = todayISO()) =>
      mutate(id, (item) =>
        item.wears.some((w) => w.date === date)
          ? item
          : {
              ...item,
              wears: [...item.wears, { date }].sort((a, b) =>
                a.date.localeCompare(b.date),
              ),
            },
      ),
    [mutate],
  );

  const removeWear = useCallback(
    (id: string, date: string) =>
      mutate(id, (item) => ({
        ...item,
        wears: item.wears.filter((w) => w.date !== date),
      })),
    [mutate],
  );

  /* ---------------- outfits ---------------- */

  const mutateOutfit = useCallback(
    async (id: string, change: (o: Outfit) => Outfit) => {
      let next: Outfit | undefined;
      setOutfits((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          next = { ...change(o), updatedAt: Date.now() };
          return next;
        }),
      );
      if (next) await db.writeOutfit(next);
    },
    [],
  );

  const addOutfit = useCallback(async (draft: OutfitDraft) => {
    const now = Date.now();
    const outfit: Outfit = {
      ...draft,
      id: newId(),
      favorite: draft.favorite ?? false,
      wears: [],
      createdAt: now,
      updatedAt: now,
    };
    await db.writeOutfit(outfit);
    setOutfits((prev) => [...prev, outfit]);
    return outfit;
  }, []);

  const updateOutfit = useCallback(
    (id: string, draft: OutfitDraft) =>
      mutateOutfit(id, (existing) => ({
        ...existing,
        ...draft,
        favorite: draft.favorite ?? existing.favorite,
      })),
    [mutateOutfit],
  );

  const deleteOutfit = useCallback(async (id: string) => {
    await db.removeOutfit(id);
    setOutfits((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const toggleOutfitFavorite = useCallback(
    (id: string) => mutateOutfit(id, (o) => ({ ...o, favorite: !o.favorite })),
    [mutateOutfit],
  );

  const addWear = (wears: WearEvent[], date: string) =>
    wears.some((w) => w.date === date)
      ? wears
      : [...wears, { date }].sort((a, b) => a.date.localeCompare(b.date));

  const logOutfitWear = useCallback(
    async (id: string, date = todayISO()) => {
      const outfit = outfits.find((o) => o.id === id);
      if (!outfit) return;

      const nextOutfit: Outfit = {
        ...outfit,
        wears: addWear(outfit.wears, date),
        updatedAt: Date.now(),
      };
      await db.writeOutfit(nextOutfit);
      setOutfits((prev) => prev.map((o) => (o.id === id ? nextOutfit : o)));

      // Wearing the look means wearing each piece in it.
      const members = items.filter((i) => outfit.itemIds.includes(i.id));
      const updated = members
        .filter((i) => !i.wears.some((w) => w.date === date))
        .map((i) => ({
          ...i,
          wears: addWear(i.wears, date),
          updatedAt: Date.now(),
        }));
      for (const i of updated) await db.writeItem(i);
      if (updated.length) {
        setItems((prev) => prev.map((i) => updated.find((u) => u.id === i.id) ?? i));
      }
    },
    [outfits, items],
  );

  const removeOutfitWear = useCallback(
    (id: string, date: string) =>
      // Only the outfit's own log is cleared; the pieces may have been worn
      // that day on their own, and guessing would lose real history.
      mutateOutfit(id, (o) => ({
        ...o,
        wears: o.wears.filter((w) => w.date !== date),
      })),
    [mutateOutfit],
  );

  /* ---------------- backup ---------------- */

  const exportBackup = useCallback(async () => {
    const payload = {
      app: "the-hanger",
      version: 2,
      exportedAt: new Date().toISOString(),
      items: await Promise.all(
        items.map(async (item) => {
          const blob = item.imageId
            ? await db.readImage(item.imageId)
            : undefined;
          return {
            ...item,
            imageId: undefined,
            image: blob ? await blobToDataUrl(blob) : undefined,
          };
        }),
      ),
      outfits,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `the-hanger-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, outfits]);

  const importBackup = useCallback(async (file: File) => {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error("That file doesn't look like a Hanger backup.");
    }

    // Everything is re-keyed on import so a backup can be merged into a
    // closet that already has pieces; outfits follow the same remapping.
    const idMap = new Map<string, string>();
    const restored: Item[] = [];
    for (const raw of parsed.items) {
      const now = Date.now();
      let imageId: string | undefined;
      if (typeof raw.image === "string" && raw.image.startsWith("data:")) {
        imageId = newId();
        await db.writeImage(imageId, await dataUrlToBlob(raw.image));
      }
      const item: Item = {
        id: newId(),
        name: String(raw.name ?? "Untitled piece"),
        category: raw.category ?? "tops",
        subtype: raw.subtype,
        brand: raw.brand,
        color: raw.color,
        size: raw.size,
        seasons: Array.isArray(raw.seasons) ? raw.seasons : [],
        formality: raw.formality,
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        notes: raw.notes,
        purchasedOn: raw.purchasedOn,
        price: typeof raw.price === "number" ? raw.price : undefined,
        favorite: Boolean(raw.favorite),
        archived: Boolean(raw.archived),
        wishlist: Boolean(raw.wishlist),
        status: raw.status ?? "ready",
        imageId,
        wears: Array.isArray(raw.wears)
          ? raw.wears.filter((w: unknown): w is { date: string } =>
              Boolean(w && typeof (w as { date?: unknown }).date === "string"),
            )
          : [],
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
        updatedAt: now,
      };
      await db.writeItem(item);
      if (typeof raw.id === "string") idMap.set(raw.id, item.id);
      restored.push(item);
    }
    setItems((prev) => [...prev, ...restored]);

    const restoredOutfits: Outfit[] = [];
    for (const raw of Array.isArray(parsed.outfits) ? parsed.outfits : []) {
      const ids = (Array.isArray(raw.itemIds) ? raw.itemIds : [])
        .map((old: unknown) =>
          typeof old === "string" ? idMap.get(old) : undefined,
        )
        .filter((id: string | undefined): id is string => Boolean(id));
      // An outfit whose pieces all failed to restore has nothing left to show.
      if (ids.length === 0) continue;

      const now = Date.now();
      const outfit: Outfit = {
        id: newId(),
        name: String(raw.name ?? "Untitled look"),
        itemIds: ids,
        seasons: Array.isArray(raw.seasons) ? raw.seasons : [],
        formality: raw.formality,
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        notes: raw.notes,
        favorite: Boolean(raw.favorite),
        wears: Array.isArray(raw.wears)
          ? raw.wears.filter((w: unknown): w is { date: string } =>
              Boolean(w && typeof (w as { date?: unknown }).date === "string"),
            )
          : [],
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
        updatedAt: now,
      };
      await db.writeOutfit(outfit);
      restoredOutfits.push(outfit);
    }
    if (restoredOutfits.length) {
      setOutfits((prev) => [...prev, ...restoredOutfits]);
    }

    return restored.length;
  }, []);

  const seedSample = useCallback(async () => {
    const now = Date.now();
    const dayMs = 86_400_000;

    const seeded: Item[] = [];
    for (const [i, { wearsAgo, art, ...draft }] of SAMPLE_CLOSET.entries()) {
      // Sample artwork is stored exactly like an uploaded photo, so the demo
      // exercises the same read path as a real closet.
      let imageId: string | undefined;
      if (art) {
        try {
          const res = await fetch(`/sample/${art}.svg`);
          if (res.ok) {
            imageId = newId();
            await db.writeImage(imageId, await res.blob());
          }
        } catch {
          // A missing flat-lay just falls back to the category glyph.
        }
      }

      seeded.push({
        ...draft,
        id: newId(),
        imageId,
        favorite: draft.favorite ?? false,
        archived: draft.archived ?? false,
        wishlist: draft.wishlist ?? false,
        status: draft.status ?? "ready",
        wears: [...wearsAgo]
          .sort((a, b) => b - a)
          .map((days) => ({
            date: new Date(now - days * dayMs).toISOString().slice(0, 10),
          })),
        // Stagger creation times so "newest first" has a sensible order.
        createdAt: now - i * 60_000,
        updatedAt: now,
      });
    }

    for (const item of seeded) await db.writeItem(item);
    setItems((prev) => [...prev, ...seeded]);
    return seeded.length;
  }, []);

  const resetCloset = useCallback(async () => {
    await db.clearEverything();
    setItems([]);
    setOutfits([]);
  }, []);

  const value = useMemo<ClosetContextValue>(
    () => ({
      items,
      outfits,
      ready,
      error,
      addItem,
      updateItem,
      deleteItem,
      toggleFavorite,
      toggleArchived,
      toggleWishlist,
      setStatus,
      logWear,
      removeWear,
      addOutfit,
      updateOutfit,
      deleteOutfit,
      toggleOutfitFavorite,
      logOutfitWear,
      removeOutfitWear,
      exportBackup,
      importBackup,
      seedSample,
      resetCloset,
    }),
    [
      items,
      outfits,
      ready,
      error,
      addItem,
      updateItem,
      deleteItem,
      toggleFavorite,
      toggleArchived,
      toggleWishlist,
      setStatus,
      logWear,
      removeWear,
      addOutfit,
      updateOutfit,
      deleteOutfit,
      toggleOutfitFavorite,
      logOutfitWear,
      removeOutfitWear,
      exportBackup,
      importBackup,
      seedSample,
      resetCloset,
    ],
  );

  return (
    <ClosetContext.Provider value={value}>{children}</ClosetContext.Provider>
  );
}

export function useCloset() {
  const ctx = useContext(ClosetContext);
  if (!ctx) throw new Error("useCloset must be used inside <ClosetProvider>");
  return ctx;
}
