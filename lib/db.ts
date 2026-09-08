import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Item, Outfit } from "./types";

const DB_NAME = "the-hanger";
const DB_VERSION = 4;

interface HangerDB extends DBSchema {
  items: {
    key: string;
    value: Item;
    indexes: { byCreatedAt: number };
  };
  /** Photos live in their own store so item records stay small and cheap to read. */
  images: {
    key: string;
    value: Blob;
  };
  outfits: {
    key: string;
    value: Outfit;
  };
  /**
   * Tombstones. A hard delete leaves nothing for sync to see, so a second
   * device would happily push the piece back; these outlive the row until the
   * deletion has been sent to the cloud.
   */
  deletions: {
    key: string;
    value: { id: string; kind: "item" | "outfit"; deletedAt: number };
  };
  /**
   * Deleted records, kept whole for 30 days. Curating a wardrobe is hours of
   * work, so a mis-tap must never be final — the photo blob is deliberately
   * left in `images` until the entry is purged.
   */
  trash: {
    key: string;
    value: TrashEntry;
    indexes: { byDeletedAt: number };
  };
}

export type TrashEntry =
  | { id: string; kind: "item"; record: Item; deletedAt: number }
  | { id: string; kind: "outfit"; record: Outfit; deletedAt: number };

export const TRASH_DAYS = 30;

let dbPromise: Promise<IDBPDatabase<HangerDB>> | null = null;

function getDB() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable — the closet needs a browser.");
  }
  if (!dbPromise) {
    dbPromise = openDB<HangerDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", { keyPath: "id" });
          store.createIndex("byCreatedAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images");
        }
        if (!db.objectStoreNames.contains("outfits")) {
          db.createObjectStore("outfits", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("deletions")) {
          db.createObjectStore("deletions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("trash")) {
          const store = db.createObjectStore("trash", { keyPath: "id" });
          store.createIndex("byDeletedAt", "deletedAt");
        }

        // v2 gave every piece a laundry status and a wishlist flag; closets
        // written by v1 predate both.
        if (oldVersion > 0 && oldVersion < 2) {
          const store = tx.objectStore("items");
          for (const item of await store.getAll()) {
            await store.put({
              ...item,
              status: item.status ?? "ready",
              wishlist: item.wishlist ?? false,
            });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function readAllItems(): Promise<Item[]> {
  const db = await getDB();
  return db.getAll("items");
}

export async function writeItem(item: Item): Promise<void> {
  const db = await getDB();
  await db.put("items", item);
}

/**
 * Move a piece to the trash. The photo stays in `images` so a restore brings
 * the whole thing back, not a card with a hole where the picture was.
 */
export async function trashItem(id: string): Promise<Item | undefined> {
  const db = await getDB();
  const item = await db.get("items", id);
  if (!item) return undefined;
  const tx = db.transaction(["items", "trash"], "readwrite");
  await tx.objectStore("items").delete(id);
  await tx
    .objectStore("trash")
    .put({ id, kind: "item", record: item, deletedAt: Date.now() });
  await tx.done;
  return item;
}

/** Hard delete, used only when purging the trash. */
export async function removeItem(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get("items", id);
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").delete(id);
  if (item?.imageId) await tx.objectStore("images").delete(item.imageId);
  await tx.done;
  if (item?.imageId) revokeImageUrl(item.imageId);
}

export async function readAllOutfits(): Promise<Outfit[]> {
  const db = await getDB();
  return db.getAll("outfits");
}

export async function writeOutfit(outfit: Outfit): Promise<void> {
  const db = await getDB();
  await db.put("outfits", outfit);
}

export async function trashOutfit(id: string): Promise<Outfit | undefined> {
  const db = await getDB();
  const outfit = await db.get("outfits", id);
  if (!outfit) return undefined;
  const tx = db.transaction(["outfits", "trash"], "readwrite");
  await tx.objectStore("outfits").delete(id);
  await tx
    .objectStore("trash")
    .put({ id, kind: "outfit", record: outfit, deletedAt: Date.now() });
  await tx.done;
  return outfit;
}

export async function removeOutfit(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("outfits", id);
}

/* ---------- trash ---------------------------------------------------- */

export async function readTrash(): Promise<TrashEntry[]> {
  const db = await getDB();
  const all = await db.getAll("trash");
  return all.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Put a trashed record back where it came from. */
export async function restoreFromTrash(
  id: string,
): Promise<TrashEntry | undefined> {
  const db = await getDB();
  const entry = await db.get("trash", id);
  if (!entry) return undefined;
  if (entry.kind === "item") {
    await db.put("items", entry.record);
  } else {
    await db.put("outfits", entry.record);
  }
  await db.delete("trash", id);
  return entry;
}

/** Remove one entry for good, photo included. */
export async function purgeTrashEntry(id: string): Promise<void> {
  const db = await getDB();
  const entry = await db.get("trash", id);
  if (!entry) return;
  if (entry.kind === "item" && entry.record.imageId) {
    await db.delete("images", entry.record.imageId);
    revokeImageUrl(entry.record.imageId);
  }
  await db.delete("trash", id);
}

/** Drop anything past the retention window. Returns how many went. */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const stale = (await readTrash()).filter((e) => e.deletedAt < cutoff);
  for (const entry of stale) await purgeTrashEntry(entry.id);
  return stale.length;
}

/* ---------- tombstones ---------------------------------------------------- */

export async function recordDeletion(
  id: string,
  kind: "item" | "outfit",
): Promise<void> {
  const db = await getDB();
  await db.put("deletions", { id, kind, deletedAt: Date.now() });
}

export async function readDeletions() {
  const db = await getDB();
  return db.getAll("deletions");
}

export async function clearDeletions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  const tx = db.transaction("deletions", "readwrite");
  for (const id of ids) await tx.store.delete(id);
  await tx.done;
}

export async function writeImage(id: string, blob: Blob): Promise<void> {
  const db = await getDB();
  await db.put("images", blob, id);
}

export async function readImage(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  return db.get("images", id);
}

export async function removeImage(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("images", id);
  revokeImageUrl(id);
}

export async function clearEverything(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ["items", "images", "outfits", "deletions", "trash"],
    "readwrite",
  );
  await tx.objectStore("items").clear();
  await tx.objectStore("images").clear();
  await tx.objectStore("outfits").clear();
  await tx.objectStore("deletions").clear();
  await tx.objectStore("trash").clear();
  await tx.done;
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  pendingUrls.clear();
}

/* ---------- object-URL cache -------------------------------------------- */

const urlCache = new Map<string, string>();
const pendingUrls = new Map<string, Promise<string | null>>();

/**
 * Resolve a stored photo to a blob URL, memoised per image id so the same
 * photo isn't decoded once per card render.
 */
export function getImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return Promise.resolve(cached);

  const inFlight = pendingUrls.get(id);
  if (inFlight) return inFlight;

  const promise = readImage(id)
    .then((blob) => {
      if (!blob) return null;
      // A parallel caller may have won the race while we were reading.
      const existing = urlCache.get(id);
      if (existing) return existing;
      const url = URL.createObjectURL(blob);
      urlCache.set(id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => {
      pendingUrls.delete(id);
    });

  pendingUrls.set(id, promise);
  return promise;
}

export function revokeImageUrl(id: string) {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}
