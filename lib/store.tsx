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
import { useAuth } from "./auth";
import { blobToDataUrl, dataUrlToBlob } from "./image";
import { SAMPLE_CLOSET } from "./sample";
import { getSupabase } from "./supabase";
import { pushDeletion, pushItem, pushOutfit, syncAll } from "./sync";
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

  trash: db.TrashEntry[];
  restoreFromTrash: (id: string) => Promise<void>;
  purgeTrashEntry: (id: string) => Promise<void>;

  /** null when signed out or sync isn't configured. */
  syncState: SyncState;
  syncNow: () => Promise<void>;
}

export interface SyncState {
  status: "off" | "idle" | "syncing" | "error";
  lastSyncedAt: number | null;
  message: string | null;
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
  const [trash, setTrash] = useState<db.TrashEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({
    status: "off",
    lastSyncedAt: null,
    message: null,
  });

  const { userId } = useAuth();

  /**
   * Mirror one local write to the cloud. Deliberately fire-and-forget: a failed
   * push must never block the UI or lose the local write, and the next full
   * sync will carry it up anyway because `updatedAt` still beats the remote.
   */
  const mirror = useCallback(
    (run: (supabase: NonNullable<ReturnType<typeof getSupabase>>, uid: string) => Promise<void>) => {
      const supabase = getSupabase();
      if (!supabase || !userId) return;
      run(supabase, userId).catch(() => {
        setSyncState((prev) => ({
          ...prev,
          status: "error",
          message: "Some changes haven't reached the cloud yet.",
        }));
      });
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    db.purgeExpiredTrash()
      .catch(() => 0)
      .then(() => Promise.all([db.readAllItems(), db.readAllOutfits(), db.readTrash()]))
      .then(([loadedItems, loadedOutfits, loadedTrash]) => {
        if (cancelled) return;
        setItems(loadedItems);
        setOutfits(loadedOutfits);
        setTrash(loadedTrash);
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
      if (next) {
        await db.writeItem(next);
        const updated = next;
        mirror((sb, uid) => pushItem(sb, uid, updated));
      }
    },
    [mirror],
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
    mirror((sb, uid) => pushItem(sb, uid, item));
    return item;
  }, [mirror]);

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
      mirror((sb, uid) => pushItem(sb, uid, next));
    },
    [items, mirror],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      const doomed = items.find((i) => i.id === id);
      await db.recordDeletion(id, "item");
      await db.trashItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTrash(await db.readTrash());
      mirror(async (sb, uid) => {
        await pushDeletion(sb, uid, "item", id, doomed?.imageId);
        await db.clearDeletions([id]);
      });

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
        for (const o of updated) mirror((sb, uid) => pushOutfit(sb, uid, o));
      }
    },
    [items, outfits, mirror],
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
      if (next) {
        await db.writeOutfit(next);
        const updated = next;
        mirror((sb, uid) => pushOutfit(sb, uid, updated));
      }
    },
    [mirror],
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
    mirror((sb, uid) => pushOutfit(sb, uid, outfit));
    return outfit;
  }, [mirror]);

  const updateOutfit = useCallback(
    (id: string, draft: OutfitDraft) =>
      mutateOutfit(id, (existing) => ({
        ...existing,
        ...draft,
        favorite: draft.favorite ?? existing.favorite,
      })),
    [mutateOutfit],
  );

  const deleteOutfit = useCallback(
    async (id: string) => {
      await db.recordDeletion(id, "outfit");
      await db.trashOutfit(id);
      setOutfits((prev) => prev.filter((o) => o.id !== id));
      setTrash(await db.readTrash());
      mirror(async (sb, uid) => {
        await pushDeletion(sb, uid, "outfit", id);
        await db.clearDeletions([id]);
      });
    },
    [mirror],
  );

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
      mirror((sb, uid) => pushOutfit(sb, uid, nextOutfit));
      for (const i of updated) mirror((sb, uid) => pushItem(sb, uid, i));
    },
    [outfits, items, mirror],
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

  const restoreFromTrash = useCallback(
    async (id: string) => {
      const entry = await db.restoreFromTrash(id);
      if (!entry) return;
      // Restoring has to beat the tombstone, both locally and in the cloud.
      await db.clearDeletions([id]);
      if (entry.kind === "item") {
        const revived = { ...entry.record, updatedAt: Date.now() };
        await db.writeItem(revived);
        setItems((prev) => [...prev.filter((i) => i.id !== id), revived]);
        mirror((sb, uid) => pushItem(sb, uid, revived));
      } else {
        const revived = { ...entry.record, updatedAt: Date.now() };
        await db.writeOutfit(revived);
        setOutfits((prev) => [...prev.filter((o) => o.id !== id), revived]);
        mirror((sb, uid) => pushOutfit(sb, uid, revived));
      }
      setTrash(await db.readTrash());
    },
    [mirror],
  );

  const purgeTrashEntry = useCallback(async (id: string) => {
    await db.purgeTrashEntry(id);
    setTrash(await db.readTrash());
  }, []);

  /** Full two-way reconcile. Safe to call repeatedly. */
  const syncNow = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;

    setSyncState((prev) => ({ ...prev, status: "syncing", message: null }));
    try {
      const result = await syncAll(supabase, userId);
      // Local stores are the render source, so re-read after a merge.
      const [freshItems, freshOutfits] = await Promise.all([
        db.readAllItems(),
        db.readAllOutfits(),
      ]);
      setItems(freshItems);
      setOutfits(freshOutfits);
      setSyncState({
        status: "idle",
        lastSyncedAt: Date.now(),
        message:
          result.pulled || result.pushed
            ? `Synced ${result.pushed} up, ${result.pulled} down.`
            : null,
      });
    } catch (e) {
      setSyncState((prev) => ({
        ...prev,
        status: "error",
        message:
          e instanceof Error && /Failed to fetch|NetworkError/i.test(e.message)
            ? "Can't reach the cloud right now — your closet is safe on this device."
            : "Sync failed. Your closet is still safe on this device.",
      }));
    }
  }, [userId]);

  // Reconcile whenever a session appears (sign-in, or a reload that restored
  // one). Signing out drops back to local-only rather than wiping anything.
  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      setSyncState({ status: "off", lastSyncedAt: null, message: null });
      return;
    }
    void syncNow();
  }, [ready, userId, syncNow]);

  const resetCloset = useCallback(async () => {
    // Signed in, "empty the closet" has to mean the account, not just this
    // device — otherwise the next sync pulls the whole wardrobe back.
    const doomedItems = items.map((i) => ({ id: i.id, imageId: i.imageId }));
    const doomedOutfits = outfits.map((o) => o.id);

    await db.clearEverything();
    setItems([]);
    setOutfits([]);
    setTrash([]);

    mirror(async (sb, uid) => {
      for (const { id, imageId } of doomedItems) {
        await pushDeletion(sb, uid, "item", id, imageId);
      }
      for (const id of doomedOutfits) {
        await pushDeletion(sb, uid, "outfit", id);
      }
    });
  }, [items, outfits, mirror]);

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
      trash,
      restoreFromTrash,
      purgeTrashEntry,
      syncState,
      syncNow,
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
      trash,
      restoreFromTrash,
      purgeTrashEntry,
      syncState,
      syncNow,
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
