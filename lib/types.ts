export type Season = "spring" | "summer" | "fall" | "winter";

export type CategoryId =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "bags"
  | "accessories"
  | "jewelry"
  | "activewear"
  | "loungewear";

export type Formality = "casual" | "everyday" | "work" | "party" | "formal";

/** Where a piece physically is right now — drives "what can I actually wear". */
export type ItemStatus = "ready" | "wash" | "cleaner" | "repair";

/** A single logged wear. */
export interface WearEvent {
  /** ISO date, day precision: "2026-09-06". */
  date: string;
  note?: string;
}

export interface Item {
  id: string;
  name: string;
  category: CategoryId;
  /** Free-text sub-type, e.g. "silk blouse", "ankle boot". */
  subtype?: string;
  brand?: string;
  /** Key of a COLORS entry. */
  color?: string;
  size?: string;
  /** Where the piece physically lives, e.g. "Bedroom Closet". Free text so a
   *  location she invents is a first-class value, not a second-class "other". */
  location?: string;
  seasons: Season[];
  formality?: Formality;
  tags: string[];
  notes?: string;
  /** ISO date the piece was bought. */
  purchasedOn?: string;
  price?: number;
  favorite: boolean;
  /** Marked for donating / selling. */
  archived: boolean;
  /**
   * Legacy: superseded by Inspo. Kept on the record so upgrading never
   * destroys data; the v5 migration clears it and tags those pieces instead.
   */
  wishlist: boolean;
  status: ItemStatus;
  /** Key into the `images` object store; absent when no photo yet. */
  imageId?: string;
  wears: WearEvent[];
  createdAt: number;
  updatedAt: number;
}

/** A saved combination of pieces. Wearing one logs a wear on every member. */
export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  seasons: Season[];
  formality?: Formality;
  tags: string[];
  notes?: string;
  favorite: boolean;
  wears: WearEvent[];
  createdAt: number;
  updatedAt: number;
}

/**
 * A saved look or vibe. Unlike an Outfit — which is built from pieces she owns
 * — an Inspo is reference material: screenshots from Pinterest, a colour story,
 * a whole look she wants to remember. It can optionally point at pieces she
 * already owns that fit the vibe.
 */
export interface Inspo {
  id: string;
  title: string;
  note?: string;
  /** Where it came from, so she can get back to the original. */
  sourceUrl?: string;
  /** Several images per board — a look is rarely one picture. */
  imageIds: string[];
  /** Pieces from the closet that go with this vibe. */
  itemIds: string[];
  tags: string[];
  seasons: Season[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export type InspoDraft = Omit<
  Inspo,
  "id" | "createdAt" | "updatedAt" | "favorite" | "imageIds"
> & { favorite?: boolean };

export type OutfitDraft = Omit<
  Outfit,
  "id" | "createdAt" | "updatedAt" | "wears" | "favorite"
> & { favorite?: boolean };

/** The shape accepted when creating or editing — id/timestamps are managed. */
export type ItemDraft = Omit<
  Item,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "wears"
  | "favorite"
  | "archived"
  | "wishlist"
  | "status"
> & {
  favorite?: boolean;
  archived?: boolean;
  wishlist?: boolean;
  status?: ItemStatus;
};

export type SortKey =
  | "recent"
  | "oldest"
  | "leastWorn"
  | "mostWorn"
  | "neglected"
  | "name";

export interface Filters {
  search: string;
  statuses: ItemStatus[];
  locations: string[];
  categories: CategoryId[];
  seasons: Season[];
  colors: string[];
  brands: string[];
  tags: string[];
  formality: Formality[];
  favoritesOnly: boolean;
  /** Only pieces not worn in the last N days. `null` disables the filter. */
  notWornDays: number | null;
  /** Never-worn pieces only. */
  neverWorn: boolean;
  includeArchived: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  statuses: [],
  locations: [],
  categories: [],
  seasons: [],
  colors: [],
  brands: [],
  tags: [],
  formality: [],
  favoritesOnly: false,
  notWornDays: null,
  neverWorn: false,
  includeArchived: false,
  sort: "recent",
};
