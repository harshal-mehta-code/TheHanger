import type { SupabaseClient } from "@supabase/supabase-js";
import * as db from "./db";
import { PHOTO_BUCKET, photoPath } from "./supabase";
import type { DayPlan, Inspo, Item, Outfit, Trip } from "./types";

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

function planToRow(plan: DayPlan, userId: string): Row {
  return {
    // A day is unique per user, so the composite is the natural key.
    user_id: userId,
    date: plan.date,
    outfit_id: plan.outfitId ?? null,
    item_ids: plan.itemIds,
    note: plan.note ?? null,
    updated_at: new Date(plan.updatedAt).toISOString(),
    deleted_at: null,
  };
}

function rowToPlan(row: Row): DayPlan {
  return {
    date: String(row.date),
    outfitId: (row.outfit_id as string) ?? undefined,
    itemIds: (row.item_ids as string[]) ?? [],
    note: (row.note as string) ?? undefined,
    updatedAt: new Date(String(row.updated_at)).getTime(),
  };
}

function tripToRow(trip: Trip, userId: string): Row {
  return {
    id: trip.id,
    user_id: userId,
    name: trip.name,
    destination: trip.destination ?? null,
    start_date: trip.startDate ?? null,
    end_date: trip.endDate ?? null,
    notes: trip.notes ?? null,
    outfit_ids: trip.outfitIds,
    item_ids: trip.itemIds,
    packed: trip.packed,
    created_at: new Date(trip.createdAt).toISOString(),
    updated_at: new Date(trip.updatedAt).toISOString(),
    deleted_at: null,
  };
}

function rowToTrip(row: Row): Trip {
  return {
    id: String(row.id),
    name: String(row.name ?? "Trip"),
    destination: (row.destination as string) ?? undefined,
    startDate: (row.start_date as string) ?? undefined,
    endDate: (row.end_date as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    outfitIds: (row.outfit_ids as string[]) ?? [],
    itemIds: (row.item_ids as string[]) ?? [],
    packed: (row.packed as string[]) ?? [],
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
    const { error } = await supabase
      .from(TABLE[t.kind])
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

  /* --- plans --- */
  const localPlans = await db.readAllPlans();
  const { data: planRows, error: planErr } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", userId);
  if (planErr) throw planErr;

  const remotePlans = new Map<string, Row>(
    (planRows ?? []).map((r: Row) => [String(r.date), r]),
  );
  const localPlansByDate = new Map(localPlans.map((p) => [p.date, p]));

  const planUpserts: Row[] = [];
  for (const plan of localPlans) {
    const remote = remotePlans.get(plan.date);
    if (remote?.deleted_at) {
      await db.removePlan(plan.date);
      continue;
    }
    const remoteUpdated = remote
      ? new Date(String(remote.updated_at)).getTime()
      : -1;
    if (plan.updatedAt > remoteUpdated) planUpserts.push(planToRow(plan, userId));
  }
  for (const [date, row] of remotePlans) {
    if (row.deleted_at) continue;
    const local = localPlansByDate.get(date);
    const remoteUpdated = new Date(String(row.updated_at)).getTime();
    if (!local || remoteUpdated > local.updatedAt) {
      await db.writePlan(rowToPlan(row));
      pulled++;
    }
  }
  if (planUpserts.length) {
    const { error } = await supabase
      .from("plans")
      .upsert(planUpserts, { onConflict: "user_id,date" });
    if (error) throw error;
    pushed += planUpserts.length;
  }

  /* --- trips --- */
  const localTrips = await db.readAllTrips();
  const { data: tripRows, error: tripErr } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", userId);
  if (tripErr) throw tripErr;

  const remoteTrips = new Map<string, Row>(
    (tripRows ?? []).map((r: Row) => [String(r.id), r]),
  );
  const localTripsById = new Map(localTrips.map((t) => [t.id, t]));

  const tripUpserts: Row[] = [];
  for (const trip of localTrips) {
    const remote = remoteTrips.get(trip.id);
    if (remote?.deleted_at) {
      await db.removeTrip(trip.id);
      continue;
    }
    const remoteUpdated = remote
      ? new Date(String(remote.updated_at)).getTime()
      : -1;
    if (trip.updatedAt > remoteUpdated) tripUpserts.push(tripToRow(trip, userId));
  }
  for (const [id, row] of remoteTrips) {
    if (row.deleted_at) continue;
    const local = localTripsById.get(id);
    const remoteUpdated = new Date(String(row.updated_at)).getTime();
    if (!local || remoteUpdated > local.updatedAt) {
      await db.writeTrip(rowToTrip(row));
      pulled++;
    }
  }
  if (tripUpserts.length) {
    const { error } = await supabase.from("trips").upsert(tripUpserts);
    if (error) throw error;
    pushed += tripUpserts.length;
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

export async function pushPlan(
  supabase: SupabaseClient,
  userId: string,
  plan: DayPlan,
) {
  const { error } = await supabase
    .from("plans")
    .upsert(planToRow(plan, userId), { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function pushTrip(
  supabase: SupabaseClient,
  userId: string,
  trip: Trip,
) {
  const { error } = await supabase.from("trips").upsert(tripToRow(trip, userId));
  if (error) throw error;
}

const TABLE = {
  item: "items",
  outfit: "outfits",
  inspo: "inspo",
  trip: "trips",
  plan: "plans",
} as const;

export async function pushDeletion(
  supabase: SupabaseClient,
  userId: string,
  kind: "item" | "outfit" | "inspo" | "trip" | "plan",
  id: string,
  imageIds: string[] = [],
) {
  // Plans are keyed by date rather than an id column.
  const { error } = await supabase
    .from(TABLE[kind])
    .update({ deleted_at: new Date().toISOString() })
    .eq(kind === "plan" ? "date" : "id", id)
    .eq("user_id", userId);
  if (error) throw error;
  for (const imageId of imageIds) {
    await deletePhoto(supabase, userId, imageId);
  }
}
