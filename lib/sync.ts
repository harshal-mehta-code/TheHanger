import type { SupabaseClient } from "@supabase/supabase-js";
import * as db from "./db";
import { thumbnailFrom } from "./image";
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

/** Photo transfers in flight at once during a reconcile. */
const PHOTO_CONCURRENCY = 6;

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

/**
 * Run an async job over a list a few at a time.
 *
 * Photo transfers used to run strictly one after another, which made a first
 * sign-in on a second device a few hundred sequential round trips. Six at once
 * is enough to saturate a phone connection without stampeding the bucket.
 */
async function mapLimit<T>(
  values: T[],
  limit: number,
  run: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, values.length) },
    async () => {
      while (cursor < values.length) {
        const value = values[cursor++];
        await run(value);
      }
    },
  );
  await Promise.all(workers);
}

async function uploadObject(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
) {
  // upsert:false means an object already there is left alone — photos are
  // immutable (replacing a photo mints a new id), so a conflict is a no-op.
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: false,
      cacheControl: "31536000",
    });
  // "already exists" is the expected happy path on a re-sync.
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
}

/** Upload a photo and its thumbnail if the cloud doesn't have them yet. */
async function pushPhoto(
  supabase: SupabaseClient,
  userId: string,
  imageId: string,
) {
  const [full, thumb] = await Promise.all([
    db.readImage(imageId),
    db.readImage(db.thumbKey(imageId)),
  ]);
  if (full) await uploadObject(supabase, photoPath(userId, imageId), full);
  if (thumb) {
    await uploadObject(supabase, photoPath(userId, db.thumbKey(imageId)), thumb);
  }
}

/**
 * Fetch a photo this device is missing. The thumbnail comes first: it is what
 * the grid renders, it is a fraction of the bytes, and a closet that fills in
 * while the full photos arrive is far better than a blank one that doesn't.
 */
async function pullPhoto(
  supabase: SupabaseClient,
  userId: string,
  imageId: string,
) {
  for (const key of [db.thumbKey(imageId), imageId]) {
    if (await db.readImage(key)) continue;
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .download(photoPath(userId, key));
    // A missing photo shouldn't fail the whole sync; a closet added to before
    // thumbnails existed simply has no thumbnail to fetch.
    if (error || !data) continue;
    await db.writeImage(key, data);
  }
  // Older photos reached the cloud without a thumbnail. Deriving one here
  // keeps the grid cheap on this device rather than re-downloading later.
  if (!(await db.readImage(db.thumbKey(imageId)))) {
    const full = await db.readImage(imageId);
    if (full) {
      const thumb = await thumbnailFrom(full);
      if (thumb) await db.writeImage(db.thumbKey(imageId), thumb);
    }
  }
}

async function deletePhoto(
  supabase: SupabaseClient,
  userId: string,
  imageId: string,
) {
  await supabase.storage
    .from(PHOTO_BUCKET)
    .remove([
      photoPath(userId, imageId),
      photoPath(userId, db.thumbKey(imageId)),
    ]);
}

/**
 * Drop photos the closet no longer points at. Replacing a photo mints a new
 * id, so without this every re-shot piece left its predecessor in the bucket
 * for good — a slow leak paid for in storage that nothing can ever reach.
 */
export async function pushPhotoDeletions(
  supabase: SupabaseClient,
  userId: string,
  imageIds: string[],
) {
  for (const imageId of imageIds) {
    await deletePhoto(supabase, userId, imageId);
  }
}

/* ---------------------------------------------------------------- sync */

/** The moment a row was soft-deleted in the cloud, or null if it is live. */
function remoteDeletedAt(row: Row | undefined): number | null {
  if (!row?.deleted_at) return null;
  const at = new Date(String(row.deleted_at)).getTime();
  return Number.isNaN(at) ? Date.now() : at;
}

/**
 * Decide what a cloud tombstone means for the copy we hold locally.
 *
 * A delete is a fact with a timestamp like any other, so it only wins if it is
 * newer than the local record. That is what makes restore-from-trash safe: a
 * revived record carries a fresh `updatedAt`, so it beats the tombstone and is
 * pushed back up even when the restore itself never reached the cloud.
 */
function deletionWins(localUpdatedAt: number, deletedAt: number): boolean {
  return deletedAt >= localUpdatedAt;
}

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

  // One missing or unreachable table must not stop the other four. Before
  // this, a schema that lagged a release froze sync everywhere at once.
  const failures: string[] = [];
  const section = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (err) {
      failures.push(
        `${name} (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  };

  /* --- deletions first, so a tombstone isn't undone by our own push --- */
  const tombstones = await db.readDeletions();
  const sent: string[] = [];
  for (const t of tombstones) {
    const { error } = await supabase
      .from(TABLE[t.kind])
      .update({ deleted_at: new Date(t.deletedAt).toISOString() })
      // Plans are keyed by date rather than an id column.
      .eq(t.kind === "plan" ? "date" : "id", t.ref)
      .eq("user_id", userId);
    if (!error) sent.push(t.id);
  }
  await db.clearDeletions(sent);

  /* --- items --- */
  await section("pieces", async () => {
    const localItems = await db.readAllItems();
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
    const photosToPush: string[] = [];
    for (const item of localItems) {
      const remote = remoteItems.get(item.id);
      const deletedAt = remoteDeletedAt(remote);
      if (deletedAt !== null) {
        if (deletionWins(item.updatedAt, deletedAt)) {
          // Deleted elsewhere, and we hold nothing newer. Route it through the
          // trash rather than erasing it, so the 30-day net covers this device
          // too — the machine where the tap happened shouldn't be the only way
          // back.
          await db.trashItem(item.id);
        } else {
          // Revived or edited here after the delete: ours is the newer fact,
          // and `deleted_at: null` in the pushed row clears the tombstone.
          toUpsert.push(itemToRow(item, userId));
          if (item.imageId) photosToPush.push(item.imageId);
        }
        continue;
      }
      const remoteUpdated = remote
        ? new Date(String(remote.updated_at)).getTime()
        : -1;
      if (item.updatedAt > remoteUpdated) {
        toUpsert.push(itemToRow(item, userId));
        if (item.imageId) photosToPush.push(item.imageId);
      }
    }

    const incoming: Item[] = [];
    for (const [id, row] of remoteItems) {
      if (row.deleted_at) continue;
      const local = localById.get(id);
      const remoteUpdated = new Date(String(row.updated_at)).getTime();
      if (!local || remoteUpdated > local.updatedAt) incoming.push(rowToItem(row));
    }

    // Photos move before the records that name them, in both directions, so a
    // record is never visible on a device that can't show its picture.
    await mapLimit(photosToPush, PHOTO_CONCURRENCY, (imageId) =>
      pushPhoto(supabase, userId, imageId),
    );
    await mapLimit(
      incoming.map((i) => i.imageId).filter((x): x is string => Boolean(x)),
      PHOTO_CONCURRENCY,
      (imageId) => pullPhoto(supabase, userId, imageId),
    );
    for (const item of incoming) {
      await db.writeItem(item);
      pulled++;
    }

    if (toUpsert.length) {
      const { error } = await supabase.from("items").upsert(toUpsert);
      if (error) throw error;
      pushed += toUpsert.length;
    }
  });

  /* --- inspo --- */
  await section("inspiration boards", async () => {
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
    const inspoPhotosToPush: string[] = [];
    for (const board of localInspo) {
      const remote = remoteInspo.get(board.id);
      const deletedAt = remoteDeletedAt(remote);
      if (deletedAt !== null) {
        if (deletionWins(board.updatedAt, deletedAt)) {
          await db.trashInspo(board.id);
        } else {
          inspoUpserts.push(inspoToRow(board, userId));
          inspoPhotosToPush.push(...board.imageIds);
        }
        continue;
      }
      const remoteUpdated = remote
        ? new Date(String(remote.updated_at)).getTime()
        : -1;
      if (board.updatedAt > remoteUpdated) {
        inspoUpserts.push(inspoToRow(board, userId));
        inspoPhotosToPush.push(...board.imageIds);
      }
    }

    const incomingBoards: Inspo[] = [];
    for (const [id, row] of remoteInspo) {
      if (row.deleted_at) continue;
      const local = localInspoById.get(id);
      const remoteUpdated = new Date(String(row.updated_at)).getTime();
      if (!local || remoteUpdated > local.updatedAt) {
        incomingBoards.push(rowToInspo(row));
      }
    }

    await mapLimit(inspoPhotosToPush, PHOTO_CONCURRENCY, (imageId) =>
      pushPhoto(supabase, userId, imageId),
    );
    await mapLimit(
      incomingBoards.flatMap((b) => b.imageIds),
      PHOTO_CONCURRENCY,
      (imageId) => pullPhoto(supabase, userId, imageId),
    );
    for (const board of incomingBoards) {
      await db.writeInspo(board);
      pulled++;
    }

    if (inspoUpserts.length) {
      const { error } = await supabase.from("inspo").upsert(inspoUpserts);
      if (error) throw error;
      pushed += inspoUpserts.length;
    }
  });

  /* --- outfits --- */
  await section("looks", async () => {
    const localOutfits = await db.readAllOutfits();
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
      const deletedAt = remoteDeletedAt(remote);
      if (deletedAt !== null) {
        if (deletionWins(outfit.updatedAt, deletedAt)) {
          await db.trashOutfit(outfit.id);
        } else {
          outfitUpserts.push(outfitToRow(outfit, userId));
        }
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
  });

  /* --- plans --- */
  await section("the calendar", async () => {
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
      const deletedAt = remoteDeletedAt(remote);
      if (deletedAt !== null) {
        // A day has no trash of its own — it is one line, cheap to re-enter.
        if (deletionWins(plan.updatedAt, deletedAt)) {
          await db.removePlan(plan.date);
        } else {
          planUpserts.push(planToRow(plan, userId));
        }
        continue;
      }
      const remoteUpdated = remote
        ? new Date(String(remote.updated_at)).getTime()
        : -1;
      if (plan.updatedAt > remoteUpdated) {
        planUpserts.push(planToRow(plan, userId));
      }
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
  });

  /* --- trips --- */
  await section("packing lists", async () => {
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
      const deletedAt = remoteDeletedAt(remote);
      if (deletedAt !== null) {
        if (deletionWins(trip.updatedAt, deletedAt)) {
          await db.trashTrip(trip.id);
        } else {
          tripUpserts.push(tripToRow(trip, userId));
        }
        continue;
      }
      const remoteUpdated = remote
        ? new Date(String(remote.updated_at)).getTime()
        : -1;
      if (trip.updatedAt > remoteUpdated) {
        tripUpserts.push(tripToRow(trip, userId));
      }
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
  });

  if (failures.length) throw new Error(`Couldn't sync ${failures.join("; ")}`);

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
  kind: db.DeletableKind,
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
