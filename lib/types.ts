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
  /** Key into the `images` object store; absent when no photo yet. */
  imageId?: string;
  wears: WearEvent[];
  createdAt: number;
  updatedAt: number;
}

/** The shape accepted when creating or editing — id/timestamps are managed. */
export type ItemDraft = Omit<
  Item,
  "id" | "createdAt" | "updatedAt" | "wears" | "favorite" | "archived"
> & {
  favorite?: boolean;
  archived?: boolean;
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
