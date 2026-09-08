import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DayPlan, Inspo, Item, Outfit, Trip } from "./types";

const DB_NAME = "the-hanger";
const DB_VERSION = 6;

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
  inspo: {
    key: string;
    value: Inspo;
  };
  /** Keyed by date — one plan per day. */
  plans: {
    key: string;
    value: DayPlan;
  };
  trips: {
    key: string;
    value: Trip;
  };
  /**
   * Tombstones. A hard delete leaves nothing for sync to see, so a second
   * device would happily push the piece back; these outlive the row until the
   * deletion has been sent to the cloud.
   */
  deletions: {
    key: string;
    value: Tombstone;
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

export type DeletableKind = "item" | "outfit" | "inspo" | "trip" | "plan";

/**
 * `id` is a composite (`item:<uuid>`, `plan:<date>`) so two kinds can never
 * collide in one keyPath; `ref` is the value the cloud is actually keyed by.
 */
export interface Tombstone {
  id: string;
  kind: DeletableKind;
  ref: string;
  deletedAt: number;
}

export type TrashEntry =
  | {
      id: string;
      kind: "item";
      record: Item;
      deletedAt: number;
      /** Looks this piece was removed from, so a restore can rejoin them. */
      outfitIds?: string[];
    }
  | { id: string; kind: "outfit"; record: Outfit; deletedAt: number }
  | { id: string; kind: "inspo"; record: Inspo; deletedAt: number }
  | { id: string; kind: "trip"; record: Trip; deletedAt: number };

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
        if (!db.objectStoreNames.contains("inspo")) {
          db.createObjectStore("inspo", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("plans")) {
          db.createObjectStore("plans", { keyPath: "date" });
        }
        if (!db.objectStoreNames.contains("trips")) {
          db.createObjectStore("trips", { keyPath: "id" });
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

        // v5 replaced the wishlist with Inspo. Rather than hide those pieces
        // behind a view that no longer exists, bring them into the closet and
        // tag them so they are still findable.
        if (oldVersion > 0 && oldVersion < 5) {
          const store = tx.objectStore("items");
          for (const item of await store.getAll()) {
            if (!item.wishlist) continue;
            await store.put({
              ...item,
              wishlist: false,
              tags: item.tags.includes("wishlist")
                ? item.tags
                : [...item.tags, "wishlist"],
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
export async function trashItem(
  id: string,
  outfitIds: string[] = [],
): Promise<Item | undefined> {
  const db = await getDB();
  const item = await db.get("items", id);
  if (!item) return undefined;
  const tx = db.transaction(["items", "trash"], "readwrite");
  await tx.objectStore("items").delete(id);
  await tx
    .objectStore("trash")
    .put({ id, kind: "item", record: item, deletedAt: Date.now(), outfitIds });
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

export async function readAllInspo(): Promise<Inspo[]> {
  const db = await getDB();
  return db.getAll("inspo");
}

export async function writeInspo(inspo: Inspo): Promise<void> {
  const db = await getDB();
  await db.put("inspo", inspo);
}

export async function trashInspo(id: string): Promise<Inspo | undefined> {
  const db = await getDB();
  const inspo = await db.get("inspo", id);
  if (!inspo) return undefined;
  const tx = db.transaction(["inspo", "trash"], "readwrite");
  await tx.objectStore("inspo").delete(id);
  await tx
    .objectStore("trash")
    .put({ id, kind: "inspo", record: inspo, deletedAt: Date.now() });
  await tx.done;
  return inspo;
}

export async function removeInspo(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("inspo", id);
}

/* ---------- plans & trips -------------------------------------------- */

export async function readAllPlans(): Promise<DayPlan[]> {
  const db = await getDB();
  return db.getAll("plans");
}

export async function writePlan(plan: DayPlan): Promise<void> {
  const db = await getDB();
  await db.put("plans", plan);
}

export async function removePlan(date: string): Promise<void> {
  const db = await getDB();
  await db.delete("plans", date);
}

export async function readAllTrips(): Promise<Trip[]> {
  const db = await getDB();
  return db.getAll("trips");
}

export async function writeTrip(trip: Trip): Promise<void> {
  const db = await getDB();
  await db.put("trips", trip);
}

export async function trashTrip(id: string): Promise<Trip | undefined> {
  const db = await getDB();
  const trip = await db.get("trips", id);
  if (!trip) return undefined;
  const tx = db.transaction(["trips", "trash"], "readwrite");
  await tx.objectStore("trips").delete(id);
  await tx
    .objectStore("trash")
    .put({ id, kind: "trip", record: trip, deletedAt: Date.now() });
  await tx.done;
  return trip;
}

export async function removeTrip(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("trips", id);
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
  } else if (entry.kind === "outfit") {
    await db.put("outfits", entry.record);
  } else if (entry.kind === "trip") {
    await db.put("trips", entry.record);
  } else {
    await db.put("inspo", entry.record);
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
  if (entry.kind === "inspo") {
    for (const imageId of entry.record.imageIds) {
      await db.delete("images", imageId);
      revokeImageUrl(imageId);
    }
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

export function tombstoneKey(kind: DeletableKind, ref: string): string {
  return `${kind}:${ref}`;
}

export async function recordDeletion(
  ref: string,
  kind: DeletableKind,
): Promise<void> {
  const db = await getDB();
  await db.put("deletions", {
    id: tombstoneKey(kind, ref),
    kind,
    ref,
    deletedAt: Date.now(),
  });
}

export async function readDeletions(): Promise<Tombstone[]> {
  const db = await getDB();
  const all = await db.getAll("deletions");
  // Tombstones written before the composite key was introduced carry the bare
  // row id and no `ref`.
  return all.map((t) => ({ ...t, ref: t.ref ?? t.id }));
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
    ["items", "images", "outfits", "inspo", "plans", "trips", "trash"],
    "readwrite",
  );
  await tx.objectStore("items").clear();
  await tx.objectStore("images").clear();
  await tx.objectStore("outfits").clear();
  await tx.objectStore("inspo").clear();
  await tx.objectStore("plans").clear();
  await tx.objectStore("trips").clear();
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

/**
 * Ask the browser to keep this origin's storage. IndexedDB is the source of
 * truth here, and without a grant iOS Safari evicts script-writable storage
 * after roughly seven days without a visit — hours of cataloguing, gone.
 * Safe to call repeatedly; resolves false where the API doesn't exist.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      return false;
    }
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
