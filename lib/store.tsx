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
import type { Item, ItemDraft } from "./types";
import { todayISO } from "./wardrobe";

interface ClosetContextValue {
  items: Item[];
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
  logWear: (id: string, date?: string) => Promise<void>;
  removeWear: (id: string, date: string) => Promise<void>;
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.readAllItems()
      .then((loaded) => {
        if (!cancelled) setItems(loaded);
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
        imageId,
        updatedAt: Date.now(),
      };
      await db.writeItem(next);
      setItems((prev) => prev.map((i) => (i.id === id ? next : i)));
    },
    [items],
  );

  const deleteItem = useCallback(async (id: string) => {
    await db.removeItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => mutate(id, (i) => ({ ...i, favorite: !i.favorite })),
    [mutate],
  );

  const toggleArchived = useCallback(
    (id: string) => mutate(id, (i) => ({ ...i, archived: !i.archived })),
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

  const exportBackup = useCallback(async () => {
    const payload = {
      app: "the-hanger",
      version: 1,
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
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `the-hanger-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const importBackup = useCallback(async (file: File) => {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error("That file doesn't look like a Hanger backup.");
    }

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
      restored.push(item);
    }
    setItems((prev) => [...prev, ...restored]);
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
  }, []);

  const value = useMemo<ClosetContextValue>(
    () => ({
      items,
      ready,
      error,
      addItem,
      updateItem,
      deleteItem,
      toggleFavorite,
      toggleArchived,
      logWear,
      removeWear,
      exportBackup,
      importBackup,
      seedSample,
      resetCloset,
    }),
    [
      items,
      ready,
      error,
      addItem,
      updateItem,
      deleteItem,
      toggleFavorite,
      toggleArchived,
      logWear,
      removeWear,
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
