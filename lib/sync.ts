import type { SupabaseClient } from "@supabase/supabase-js";
import * as db from "./db";
import { PHOTO_BUCKET, photoPath } from "./supabase";
import type { Inspo, Item, Outfit } from "./types";

/**
 * Sync model: the browser stays the source of truth for reading, and the cloud
 * is a mirror that other devices read from. Every record carries `updatedAt`,
 * and the newer timestamp wins — last-write-wins, per record.
 *
 * That is the right trade for a personal wardrobe: two devices rarely edit the
 * same piece within the same second, and the failure mode (one edit of one
 * piece loses) is far cheaper than the complexity of merging field by field.
 * Deletes travel as tombstones so they aren't undone by the other device.
 */

export interface SyncResult {
  pulled: number;
  pushed: number;
  deleted: number;
}

/* ---------------------------------------------------------------- mapping */

type Row = Record<string, unknown>;

function itemToRow(item: Item, userId: string): Row {
  return {
    id: item.id,
    user_id: userId,
    name: item.name,
    category: item.category,
    subtype: item.subtype ?? null,
    brand: item.brand ?? null,
    color: item.color ?? null,
    size: item.size ?? null,
    location: item.location ?? null,
    seasons: item.seasons,
    formality: item.formality ?? null,
    tags: item.tags,
    notes: item.notes ?? null,
    purchased_on: item.purchasedOn ?? null,
    price: item.price ?? null,
    favorite: item.favorite,
    archived: item.archived,
    wishlist: item.wishlist,
    status: item.status,
    image_id: item.imageId ?? null,
    wears: item.wears,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
    deleted_at: null,
  };
}

function rowToItem(row: Row): Item {
  return {
    id: String(row.id),
    name: String(row.name ?? "Untitled piece"),
    category: (row.category ?? "tops") as Item["category"],
    subtype: (row.subtype as string) ?? undefined,
    brand: (row.brand as string) ?? undefined,
    color: (row.color as string) ?? undefined,
    size: (row.size as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    seasons: (row.seasons as Item["seasons"]) ?? [],
    formality: (row.formality as Item["formality"]) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    notes: (row.notes as string) ?? undefined,
    purchasedOn: (row.purchased_on as string) ?? undefined,
    // numeric comes back as a string from PostgREST.
    price: row.price == null ? undefined : Number(row.price),
    favorite: Boolean(row.favorite),
    archived: Boolean(row.archived),
    wishlist: Boolean(row.wishlist),
    status: (row.status ?? "ready") as Item["status"],
    imageId: (row.image_id as string) ?? undefined,
    wears: Array.isArray(row.wears) ? (row.wears as Item["wears"]) : [],
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
  };
}

function outfitToRow(outfit: Outfit, userId: string): Row {
  return {
    id: outfit.id,
    user_id: userId,
    name: outfit.name,
    item_ids: outfit.itemIds,
    seasons: outfit.seasons,
    formality: outfit.formality ?? null,
    tags: outfit.tags,
    notes: outfit.notes ?? null,
    favorite: outfit.favorite,
    wears: outfit.wears,
    created_at: new Date(outfit.createdAt).toISOString(),
    updated_at: new Date(outfit.updatedAt).toISOString(),
    deleted_at: null,
  };
}

function rowToOutfit(row: Row): Outfit {
  return {
    id: String(row.id),
    name: String(row.name ?? "Untitled look"),
    itemIds: (row.item_ids as string[]) ?? [],
    seasons: (row.seasons as Outfit["seasons"]) ?? [],
    formality: (row.formality as Outfit["formality"]) ?? undefined,
    tags: (row.tags as string[]) ?? [],
    notes: (row.notes as string) ?? undefined,
    favorite: Boolean(row.favorite),
    wears: Array.isArray(row.wears) ? (row.wears as Outfit["wears"]) : [],
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
  };
}

function inspoToRow(inspo: Inspo, userId: string): Row {
  return {
    id: inspo.id,
    user_id: userId,
    title: inspo.title,
    note: inspo.note ?? null,
    source_url: inspo.sourceUrl ?? null,
    image_ids: inspo.imageIds,
    item_ids: inspo.itemIds,
    tags: inspo.tags,
    seasons: inspo.seasons,
    favorite: inspo.favorite,
    created_at: new Date(inspo.createdAt).toISOString(),
    updated_at: new Date(inspo.updatedAt).toISOString(),
    deleted_at: null,
  };
}

function rowToInspo(row: Row): Inspo {
  return {
    id: String(row.id),
    title: String(row.title ?? "Untitled"),
    note: (row.note as string) ?? undefined,
    sourceUrl: (row.source_url as string) ?? undefined,
    imageIds: (row.image_ids as string[]) ?? [],
    itemIds: (row.item_ids as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    seasons: (row.seasons as Inspo["seasons"]) ?? [],
    favorite: Boolean(row.favorite),
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
  };
}

/* ---------------------------------------------------------------- photos */

/** Upload a local photo if the cloud doesn't have it yet. */
async function pushPhoto(
  supabase: SupabaseClient,
  userId: string,
  imageId: string,
) {
  const blob = await db.readImage(imageId);
  if (!blob) return;
  // upsert:false means an object already there is left alone — photos are
  // immutable (replacing a photo mints a new id), so a conflict is a no-op.
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(photoPath(userId, imageId), blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
    });
  // "already exists" is the expected happy path on a re-sync.
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
}

/** Fetch a photo this device is missing into IndexedDB. */
async function pullPhoto(
  supabase: SupabaseClient,
  userId: string,
  imageId: string,
) {
  if (await db.readImage(imageId)) return;
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .download(photoPath(userId, imageId));
  if (error || !data) return; // A missing photo shouldn't fail the whole sync.
  await db.writeImage(imageId, data);
}

async function deletePhoto(
  supabase: SupabaseClient,
  userId: string,
  imageId: string,
) {
  await supabase.storage.from(PHOTO_BUCKET).remove([photoPath(userId, imageId)]);
}

/* ---------------------------------------------------------------- sync */

/**
 * Reconcile this device with the cloud in both directions.
 *
 * Called on sign-in, on load while signed in, and on demand. It is safe to run
 * repeatedly: everything is keyed by id and guarded by `updatedAt`.
 */
export async function syncAll(
  supabase: SupabaseClient,
  userId: string,
): Promise<SyncResult> {
  let pulled = 0;
  let pushed = 0;

  /* --- deletions first, so a tombstone isn't undone by our own push --- */
  const tombstones = await db.readDeletions();
  const sent: string[] = [];
  for (const t of tombstones) {
    const table = t.kind === "item" ? "items" : "outfits";
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date(t.deletedAt).toISOString() })
      .eq("id", t.id)
      .eq("user_id", userId);
    if (!error) sent.push(t.id);
  }
  await db.clearDeletions(sent);

  /* --- items --- */
  const [localItems, localOutfits] = await Promise.all([
    db.readAllItems(),
    db.readAllOutfits(),
  ]);

  const { data: itemRows, error: itemErr } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", userId);
  if (itemErr) throw itemErr;

  const remoteItems = new Map<string, Row>(
    (itemRows ?? []).map((r: Row) => [String(r.id), r]),
  );
  const localById = new Map(localItems.map((i) => [i.id, i]));

  const toUpsert: Row[] = [];
  for (const item of localItems) {
    const remote = remoteItems.get(item.id);
    if (remote?.deleted_at) {
      // Deleted elsewhere — honour it here.
      await db.removeItem(item.id);
      continue;
    }
    const remoteUpdated = remote
      ? new Date(String(remote.updated_at)).getTime()
      : -1;
    if (item.updatedAt > remoteUpdated) {
      toUpsert.push(itemToRow(item, userId));
      if (item.imageId) await pushPhoto(supabase, userId, item.imageId);
    }
  }

  for (const [id, row] of remoteItems) {
    if (row.deleted_at) continue;
    const local = localById.get(id);
    const remoteUpdated = new Date(String(row.updated_at)).getTime();
    if (!local || remoteUpdated > local.updatedAt) {
      const item = rowToItem(row);
      if (item.imageId) await pullPhoto(supabase, userId, item.imageId);
      await db.writeItem(item);
      pulled++;
    }
  }

  if (toUpsert.length) {
    const { error } = await supabase.from("items").upsert(toUpsert);
    if (error) throw error;
    pushed += toUpsert.length;
  }

  /* --- inspo --- */
  const localInspo = await db.readAllInspo();
  const { data: inspoRows, error: inspoErr } = await supabase
    .from("inspo")
    .select("*")
    .eq("user_id", userId);
  if (inspoErr) throw inspoErr;

  const remoteInspo = new Map<string, Row>(
    (inspoRows ?? []).map((r: Row) => [String(r.id), r]),
  );
  const localInspoById = new Map(localInspo.map((x) => [x.id, x]));

  const inspoUpserts: Row[] = [];
  for (const board of localInspo) {
    const remote = remoteInspo.get(board.id);
    if (remote?.deleted_at) {
      await db.removeInspo(board.id);
      continue;
    }
    const remoteUpdated = remote
      ? new Date(String(remote.updated_at)).getTime()
      : -1;
    if (board.updatedAt > remoteUpdated) {
      inspoUpserts.push(inspoToRow(board, userId));
      for (const imageId of board.imageIds) {
        await pushPhoto(supabase, userId, imageId);
      }
    }
  }

  for (const [id, row] of remoteInspo) {
    if (row.deleted_at) continue;
    const local = localInspoById.get(id);
    const remoteUpdated = new Date(String(row.updated_at)).getTime();
    if (!local || remoteUpdated > local.updatedAt) {
      const board = rowToInspo(row);
      for (const imageId of board.imageIds) {
        await pullPhoto(supabase, userId, imageId);
      }
      await db.writeInspo(board);
      pulled++;
    }
  }

  if (inspoUpserts.length) {
    const { error } = await supabase.from("inspo").upsert(inspoUpserts);
    if (error) throw error;
    pushed += inspoUpserts.length;
  }

  /* --- outfits --- */
  const { data: outfitRows, error: outfitErr } = await supabase
    .from("outfits")
    .select("*")
    .eq("user_id", userId);
  if (outfitErr) throw outfitErr;

  const remoteOutfits = new Map<string, Row>(
    (outfitRows ?? []).map((r: Row) => [String(r.id), r]),
  );
  const localOutfitsById = new Map(localOutfits.map((o) => [o.id, o]));

  const outfitUpserts: Row[] = [];
  for (const outfit of localOutfits) {
    const remote = remoteOutfits.get(outfit.id);
    if (remote?.deleted_at) {
      await db.removeOutfit(outfit.id);
      continue;
    }
    const remoteUpdated = remote
      ? new Date(String(remote.updated_at)).getTime()
      : -1;
    if (outfit.updatedAt > remoteUpdated) {
      outfitUpserts.push(outfitToRow(outfit, userId));
    }
  }

  for (const [id, row] of remoteOutfits) {
    if (row.deleted_at) continue;
    const local = localOutfitsById.get(id);
    const remoteUpdated = new Date(String(row.updated_at)).getTime();
    if (!local || remoteUpdated > local.updatedAt) {
      await db.writeOutfit(rowToOutfit(row));
      pulled++;
    }
  }

  if (outfitUpserts.length) {
    const { error } = await supabase.from("outfits").upsert(outfitUpserts);
    if (error) throw error;
    pushed += outfitUpserts.length;
  }

  return { pulled, pushed, deleted: sent.length };
}

/* ------------------------------------------------- incremental push */

export async function pushItem(
  supabase: SupabaseClient,
  userId: string,
  item: Item,
) {
  if (item.imageId) await pushPhoto(supabase, userId, item.imageId);
  const { error } = await supabase.from("items").upsert(itemToRow(item, userId));
  if (error) throw error;
}

export async function pushOutfit(
  supabase: SupabaseClient,
  userId: string,
  outfit: Outfit,
) {
  const { error } = await supabase
    .from("outfits")
    .upsert(outfitToRow(outfit, userId));
  if (error) throw error;
}

export async function pushInspo(
  supabase: SupabaseClient,
  userId: string,
  inspo: Inspo,
) {
  for (const imageId of inspo.imageIds) {
    await pushPhoto(supabase, userId, imageId);
  }
  const { error } = await supabase
    .from("inspo")
    .upsert(inspoToRow(inspo, userId));
  if (error) throw error;
}

const TABLE = { item: "items", outfit: "outfits", inspo: "inspo" } as const;

export async function pushDeletion(
  supabase: SupabaseClient,
  userId: string,
  kind: "item" | "outfit" | "inspo",
  id: string,
  imageIds: string[] = [],
) {
  const { error } = await supabase
    .from(TABLE[kind])
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  for (const imageId of imageIds) {
    await deletePhoto(supabase, userId, imageId);
  }
}
