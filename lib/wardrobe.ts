import type { Filters, Item, Outfit, SortKey, WearEvent } from "./types";

const DAY_MS = 86_400_000;

/** Items and outfits both carry a wear log, so the helpers below take either. */
type Wearable = { wears: WearEvent[] };

/** Local-timezone "YYYY-MM-DD" — wear dates are days, not instants. */
export function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function lastWornDate(item: Wearable): string | null {
  if (item.wears.length === 0) return null;
  return item.wears.reduce((a, b) => (a.date > b.date ? a : b)).date;
}

export function daysSinceWorn(item: Wearable): number | null {
  const last = lastWornDate(item);
  if (!last) return null;
  const then = new Date(`${last}T00:00:00`).getTime();
  const now = new Date(`${todayISO()}T00:00:00`).getTime();
  return Math.max(0, Math.round((now - then) / DAY_MS));
}

export function formatLastWorn(item: Wearable): string {
  const days = daysSinceWorn(item);
  if (days === null) return "Never worn";
  if (days === 0) return "Worn today";
  if (days === 1) return "Worn yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return m === 1 ? "1 month ago" : `${m} months ago`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "Over a year ago" : `${y} years ago`;
}

export function costPerWear(item: Item): number | null {
  if (item.price == null || item.price <= 0) return null;
  return item.price / Math.max(1, item.wears.length);
}

function matchesSearch(item: Item, query: string): boolean {
  const haystack = [
    item.name,
    item.brand,
    item.subtype,
    item.color,
    item.location,
    item.notes,
    ...item.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function filterItems(items: Item[], filters: Filters): Item[] {
  return items.filter((item) => {
    if (item.wishlist) return false;
    if (filters.statuses.length && !filters.statuses.includes(item.status))
      return false;
    if (
      filters.locations.length &&
      !(item.location && filters.locations.includes(item.location))
    )
      return false;
    if (!filters.includeArchived && item.archived) return false;
    if (filters.favoritesOnly && !item.favorite) return false;
    if (filters.search.trim() && !matchesSearch(item, filters.search.trim()))
      return false;
    if (
      filters.categories.length &&
      !filters.categories.includes(item.category)
    )
      return false;
    if (
      filters.seasons.length &&
      !filters.seasons.some((s) => item.seasons.includes(s))
    )
      return false;
    if (filters.colors.length && !(item.color && filters.colors.includes(item.color)))
      return false;
    if (filters.brands.length && !(item.brand && filters.brands.includes(item.brand)))
      return false;
    if (filters.tags.length && !filters.tags.some((t) => item.tags.includes(t)))
      return false;
    if (
      filters.formality.length &&
      !(item.formality && filters.formality.includes(item.formality))
    )
      return false;

    if (filters.neverWorn && item.wears.length > 0) return false;

    if (filters.notWornDays !== null) {
      const days = daysSinceWorn(item);
      // Never-worn pieces are the most neglected of all, so they qualify.
      if (days !== null && days < filters.notWornDays) return false;
    }

    return true;
  });
}

export function sortItems(items: Item[], sort: SortKey): Item[] {
  const copy = [...items];
  switch (sort) {
    case "recent":
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case "oldest":
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case "mostWorn":
      return copy.sort((a, b) => b.wears.length - a.wears.length);
    case "leastWorn":
      return copy.sort((a, b) => a.wears.length - b.wears.length);
    case "neglected":
      return copy.sort((a, b) => {
        // Never worn sorts to the very top, then longest-ago first.
        const da = daysSinceWorn(a) ?? Number.POSITIVE_INFINITY;
        const db = daysSinceWorn(b) ?? Number.POSITIVE_INFINITY;
        return db - da;
      });
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}

export interface ClosetStats {
  total: number;
  neverWorn: number;
  wornThisMonth: number;
  favorites: number;
  /** Pieces untouched for 90+ days (never-worn included). */
  neglected: number;
  /** Pieces that aren't ready to wear right now (wash, cleaner, repair). */
  unavailable: number;
  wishlist: number;
  topBrand: { name: string; count: number } | null;
  mostWorn: Item | null;
}

export function computeStats(items: Item[]): ClosetStats {
  const active = items.filter((i) => !i.archived && !i.wishlist);
  const cutoff = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);

  const brandCounts = new Map<string, number>();
  for (const item of active) {
    if (item.brand) {
      brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1);
    }
  }
  let topBrand: ClosetStats["topBrand"] = null;
  for (const [name, count] of brandCounts) {
    if (!topBrand || count > topBrand.count) topBrand = { name, count };
  }

  const mostWorn = active.reduce<Item | null>(
    (best, item) =>
      item.wears.length > 0 && (!best || item.wears.length > best.wears.length)
        ? item
        : best,
    null,
  );

  return {
    total: active.length,
    neverWorn: active.filter((i) => i.wears.length === 0).length,
    wornThisMonth: active.filter((i) => i.wears.some((w) => w.date >= cutoff))
      .length,
    favorites: active.filter((i) => i.favorite).length,
    neglected: active.filter((i) => {
      const d = daysSinceWorn(i);
      return d === null || d >= 90;
    }).length,
    unavailable: active.filter((i) => i.status !== "ready").length,
    wishlist: items.filter((i) => i.wishlist && !i.archived).length,
    topBrand,
    mostWorn,
  };
}

/** Distinct brands/tags present in the closet, for the filter menus. */
export function collectFacets(items: Item[]) {
  const brands = new Set<string>();
  const tags = new Set<string>();
  const locations = new Set<string>();
  for (const item of items) {
    if (item.brand) brands.add(item.brand);
    if (item.location) locations.add(item.location);
    for (const t of item.tags) tags.add(t);
  }
  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
    locations: [...locations].sort((a, b) => a.localeCompare(b)),
  };
}

/** Standard locations plus any she has invented, deduped and ordered. */
export function knownLocations(inUse: string[], standard: string[]) {
  const extra = inUse.filter((l) => !standard.includes(l));
  return [...standard, ...extra];
}

/** Resolves an outfit's member ids to items, dropping any since deleted. */
export function outfitPieces(outfit: Outfit, items: Item[]): Item[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return outfit.itemIds
    .map((id) => byId.get(id))
    .filter((i): i is Item => Boolean(i));
}

export interface OutfitFilters {
  search: string;
  seasons: Filters["seasons"];
  formality: Filters["formality"];
  favoritesOnly: boolean;
  /** Hide outfits with a piece in the wash, at the cleaner, or being repaired. */
  wearableOnly: boolean;
  sort: SortKey;
}

export const EMPTY_OUTFIT_FILTERS: OutfitFilters = {
  search: "",
  seasons: [],
  formality: [],
  favoritesOnly: false,
  wearableOnly: false,
  sort: "recent",
};

export function filterOutfits(
  outfits: Outfit[],
  items: Item[],
  filters: OutfitFilters,
): Outfit[] {
  const query = filters.search.trim().toLowerCase();
  return outfits.filter((outfit) => {
    if (filters.favoritesOnly && !outfit.favorite) return false;
    if (
      filters.seasons.length &&
      !filters.seasons.some((s) => outfit.seasons.includes(s))
    )
      return false;
    if (
      filters.formality.length &&
      !(outfit.formality && filters.formality.includes(outfit.formality))
    )
      return false;

    if (filters.wearableOnly) {
      const pieces = outfitPieces(outfit, items);
      if (pieces.some((p) => p.status !== "ready" || p.archived)) return false;
    }

    if (query) {
      const pieces = outfitPieces(outfit, items);
      const haystack = [
        outfit.name,
        outfit.notes,
        ...outfit.tags,
        ...pieces.map((p) => `${p.name} ${p.brand ?? ""}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!query.split(/\s+/).every((t) => haystack.includes(t))) return false;
    }

    return true;
  });
}

export function sortOutfits(outfits: Outfit[], sort: SortKey): Outfit[] {
  const copy = [...outfits];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case "mostWorn":
      return copy.sort((a, b) => b.wears.length - a.wears.length);
    case "leastWorn":
      return copy.sort((a, b) => a.wears.length - b.wears.length);
    case "neglected":
      return copy.sort(
        (a, b) =>
          (daysSinceWorn(b) ?? Number.POSITIVE_INFINITY) -
          (daysSinceWorn(a) ?? Number.POSITIVE_INFINITY),
      );
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export function currentSeason(): "spring" | "summer" | "fall" | "winter" {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}
