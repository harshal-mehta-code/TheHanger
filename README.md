# The Hanger

A calm, fashion-first way to catalogue a wardrobe: photograph every piece, see
what's actually in rotation, and rediscover the things that have been hiding at
the back of the closet.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind 4.
Deploys to Vercel as a static front end — no database, no accounts, no server.

## What it does

**Three views** — *Closet* (everything you own), *Outfits* (saved looks), and
*Insights* (what the closet is actually doing). Sections sit in the header on a
laptop and in a bottom bar on a phone.

**Kept calm on purpose** — the closet screen is clothes, not controls. All
narrowing lives behind one *Filters* button beside the category rail, so a phone
shows about 220px of chrome and then garments; the four stat tiles appear only
where there's room for them, and reduce to a single line on a phone.

**Quick add** — Pick a batch of photos at once and give each a name, category
and seasons in a single pass. Cataloguing a whole wardrobe one modal at a time
is the slow part of an app like this; everything else can be filled in later.

**Dark mode** — Toggle from the settings menu; follows the system setting until
you choose. The theme resolves before first paint, so there's no flash.

**Inventory** — Add a piece with a photo (camera or upload, drag-and-drop on
desktop), a name, category, colour, brand, size, seasons, dress code, tags,
purchase date and price. Photos are downscaled to 1400px and re-encoded before
they're stored, so a few hundred pieces stay comfortably within the browser's
storage budget.

**Filter** — One sheet holds category, season, colour, brand, tag, dress code,
favourites, order, laundry status, and the ones that matter most for a real closet: *never worn*
and *not worn in 30 days / 3 months / 6 months / a year*. Free-text search spans
name, brand, style, colour, tags and notes. Sort by newest, longest unworn, most
worn, least worn, or A–Z.

**Outfits** — Save combinations of pieces as a named look. Logging a look as
worn counts a wear for every piece in it, so tracking stays honest without extra
taps. Filter looks by season, dress code, favourites, or *wearable now*, which
hides any look with a piece in the wash.

**Laundry status** — Each piece is ready to wear, in the wash, at the cleaner,
or waiting to be mended. Cards show it, filters respect it, and outfits know
when one of their pieces is unavailable.

**Wishlist** — Track pieces you want but don't own. They're kept out of the
closet grid and out of every statistic until you tap *I bought it*.

**Insights** — Wear activity by month, what you own by category, best and worst
cost per wear, the pieces working hardest, the ones waiting longest, and spend
by category.

**Wear tracking** — One tap on a card logs that a piece was worn today; the
detail sheet can backdate a wear or remove one. Everything else — "3 weeks
ago", "needs love", cost per wear — is derived from that log.

**Closet pulse** — Four tiles across the top: total pieces, worn this month,
needs love (unworn 90+ days), and loved. The last two are buttons that apply
themselves as filters.

**Archive** — Move a piece out of the active closet without deleting it, for
things being donated, sold, or stored for the season.

**Backup** — Export the whole closet — pieces, photos, outfits and wear history
— as a single JSON file; restore it on another device or browser from the same
menu. Restoring re-keys everything, so a backup merges into an existing closet
rather than colliding with it.

## Where the data lives

Everything is stored in **IndexedDB in the browser** — item records in one
object store, photos as blobs in another. Nothing is uploaded anywhere, which
means no sign-in, no hosting bill, and complete privacy.

The trade-off worth knowing: **the closet lives in one browser on one device.**
A phone and a laptop each keep their own copy. The backup/restore menu bridges
them manually. If you want true sync across devices, see *Adding sync* below.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run lint`, `npm run typecheck`.

Empty closet? Open the settings menu (the sliders icon in the header) and choose
**Load a sample closet** to explore with twelve pieces and realistic wear
history.

## Deploying to Vercel

Import the repository at [vercel.com/new](https://vercel.com/new). Vercel detects
Next.js and needs no configuration or environment variables — the app is fully
static. Push to the branch and it redeploys.

On a phone, "Add to Home Screen" installs it as a standalone app (web manifest
and icons are included).

## Adding sync later

The storage layer is deliberately isolated so this stays a contained change:

- `lib/db.ts` — every IndexedDB read and write, and the photo URL cache.
- `lib/store.tsx` — the React context; the only place components mutate state.

Swapping in a hosted backend (Vercel Postgres or Neon for records, Vercel Blob
for photos) means reimplementing those two files behind the same interface;
components and the wardrobe logic in `lib/wardrobe.ts` don't change. Multi-device
sync also implies auth, so that's the other half of the work.

## Layout

```
app/
  layout.tsx        fonts, metadata, closet provider
  page.tsx          the closet: pulse, filters, grid, overlays
  outfits/page.tsx  saved looks
  insights/page.tsx charts and leaderboards
  globals.css       design tokens and component classes
  icon.svg, apple-icon.tsx, manifest.ts
components/
  AppHeader         wordmark, section nav, search, settings
  ItemCard          grid card with quick favourite / wore-it-today actions
  ItemDetail        detail sheet with status, wear history
  ItemEditor        add & edit form
  FilterBar         scope toggle, category rail, advanced filter panel
  ClosetPulse       the four stat tiles
  OutfitCard        collage card for a saved look
  OutfitDetail      look sheet, drills into each piece
  OutfitEditor      look builder with a piece picker
  SettingsMenu      backup, restore, sample closet, erase
  Modal, ItemPhoto, Icons
lib/
  types.ts          Item, Outfit, Filters and the rest of the domain model
  taxonomy.ts       categories, seasons, colours, dress codes, statuses, tags
  db.ts             IndexedDB access (v2) + object-URL cache
  store.tsx         React context and all mutations
  wardrobe.ts       filtering, sorting, stats, "last worn" formatting
  image.ts          photo downscaling and data-URL conversion
  sample.ts         the demo closet
scripts/
  generate-sample-art.mjs   redraws public/sample/*.svg
```
