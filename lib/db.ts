import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Item } from "./types";

const DB_NAME = "the-hanger";
const DB_VERSION = 1;

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
}

let dbPromise: Promise<IDBPDatabase<HangerDB>> | null = null;

function getDB() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable — the closet needs a browser.");
  }
  if (!dbPromise) {
    dbPromise = openDB<HangerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("items")) {
          const store = db.createObjectStore("items", { keyPath: "id" });
          store.createIndex("byCreatedAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images");
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

export async function removeItem(id: string): Promise<void> {
  const db = await getDB();
  const item = await db.get("items", id);
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").delete(id);
  if (item?.imageId) await tx.objectStore("images").delete(item.imageId);
  await tx.done;
  if (item?.imageId) revokeImageUrl(item.imageId);
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
  const tx = db.transaction(["items", "images"], "readwrite");
  await tx.objectStore("items").clear();
  await tx.objectStore("images").clear();
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
