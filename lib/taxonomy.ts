import type { CategoryId, Formality, ItemStatus, Season } from "./types";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** Plural noun used in copy, e.g. "3 dresses". */
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "tops", label: "Tops", emoji: "👚" },
  { id: "bottoms", label: "Bottoms", emoji: "👖" },
  { id: "dresses", label: "Dresses", emoji: "👗" },
  { id: "outerwear", label: "Outerwear", emoji: "🧥" },
  { id: "shoes", label: "Shoes", emoji: "👠" },
  { id: "bags", label: "Bags", emoji: "👜" },
  { id: "accessories", label: "Accessories", emoji: "🧣" },
  { id: "jewelry", label: "Jewelry", emoji: "💍" },
  { id: "activewear", label: "Activewear", emoji: "🩱" },
  { id: "loungewear", label: "Loungewear", emoji: "🛋️" },
];

export const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
) as Record<CategoryId, string>;

export const CATEGORY_EMOJI: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.emoji]),
) as Record<CategoryId, string>;

export interface SeasonMeta {
  id: Season;
  label: string;
  emoji: string;
}

export const SEASONS: SeasonMeta[] = [
  { id: "spring", label: "Spring", emoji: "🌸" },
  { id: "summer", label: "Summer", emoji: "☀️" },
  { id: "fall", label: "Fall", emoji: "🍂" },
  { id: "winter", label: "Winter", emoji: "❄️" },
];

export const SEASON_LABEL: Record<Season, string> = Object.fromEntries(
  SEASONS.map((s) => [s.id, s.label]),
) as Record<Season, string>;

export const FORMALITIES: { id: Formality; label: string }[] = [
  { id: "casual", label: "Casual" },
  { id: "everyday", label: "Everyday" },
  { id: "work", label: "Work" },
  { id: "party", label: "Party" },
  { id: "formal", label: "Formal" },
];

export interface StatusMeta {
  id: ItemStatus;
  label: string;
  /** Wording used on the card badge, shorter than the menu label. */
  short: string;
  emoji: string;
  /** Ready is the default and deliberately gets no badge. */
  badge: boolean;
}

export const STATUSES: StatusMeta[] = [
  { id: "ready", label: "Ready to wear", short: "Ready", emoji: "✨", badge: false },
  { id: "wash", label: "In the wash", short: "In the wash", emoji: "🧺", badge: true },
  { id: "cleaner", label: "At the cleaner", short: "At cleaner", emoji: "🧼", badge: true },
  { id: "repair", label: "Needs repair", short: "Needs repair", emoji: "🪡", badge: true },
];

export const STATUS_BY_ID: Record<ItemStatus, StatusMeta> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s]),
) as Record<ItemStatus, StatusMeta>;

export interface ColorMeta {
  id: string;
  label: string;
  /** CSS color for the swatch. */
  hex: string;
  /** Swatches this light need a border to stay visible on cream. */
  light?: boolean;
}

export const COLORS: ColorMeta[] = [
  { id: "black", label: "Black", hex: "#171414" },
  { id: "white", label: "White", hex: "#FFFFFF", light: true },
  { id: "cream", label: "Cream", hex: "#F0E6D6", light: true },
  { id: "grey", label: "Grey", hex: "#9A9490" },
  { id: "beige", label: "Beige", hex: "#CDB49A" },
  { id: "brown", label: "Brown", hex: "#7A5340" },
  { id: "red", label: "Red", hex: "#C0362C" },
  { id: "pink", label: "Pink", hex: "#E79BB4" },
  { id: "orange", label: "Orange", hex: "#D97B3A" },
  { id: "yellow", label: "Yellow", hex: "#E4BC4C" },
  { id: "green", label: "Green", hex: "#5F7D5A" },
  { id: "blue", label: "Blue", hex: "#4A6C99" },
  { id: "navy", label: "Navy", hex: "#26344F" },
  { id: "purple", label: "Purple", hex: "#7B5C9E" },
  { id: "denim", label: "Denim", hex: "#5C7A9E" },
  { id: "metallic", label: "Metallic", hex: "#C3B393" },
  { id: "print", label: "Print", hex: "#B4436C" },
];

export const COLOR_BY_ID: Record<string, ColorMeta> = Object.fromEntries(
  COLORS.map((c) => [c.id, c]),
);

/**
 * Where pieces are kept. These are only defaults — the editor accepts any
 * location she types, and anything in use shows up alongside these.
 */
export const STANDARD_LOCATIONS = [
  "Bedroom Closet",
  "Coat Closet",
  "Bedroom Dresser",
  "Sub-storage",
  "Storage Bin",
];

/** Suggested tags offered in the editor; users can add anything. */
export const TAG_SUGGESTIONS = [
  "everyday",
  "date night",
  "office",
  "weekend",
  "vacation",
  "wedding guest",
  "cozy",
  "statement",
  "layering",
  "needs tailoring",
  "dry clean",
  "vintage",
  "sentimental",
];
