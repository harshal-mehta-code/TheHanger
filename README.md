# The Hanger

A calm, fashion-first way to catalogue a wardrobe: photograph every piece, see
what's actually in rotation, and rediscover the things that have been hiding at
the back of the closet.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind 4.
Deploys to Vercel as a static front end — no database, no accounts, no server.

## What it does

**Inventory** — Add a piece with a photo (camera or upload, drag-and-drop on
desktop), a name, category, colour, brand, size, seasons, dress code, tags,
purchase date and price. Photos are downscaled to 1400px and re-encoded before
they're stored, so a few hundred pieces stay comfortably within the browser's
storage budget.

**Filter** — Category, season, colour, brand, tag, dress code, favourites, and
the ones that matter most for a real closet: *never worn* and *not worn in
30 days / 3 months / 6 months / a year*. Free-text search spans name, brand,
style, colour, tags and notes. Sort by newest, longest unworn, most worn, least
worn, or A–Z.

**Wear tracking** — One tap on a card logs that a piece was worn today; the
detail sheet can backdate a wear or remove one. Everything else — "3 weeks
ago", "needs love", cost per wear — is derived from that log.

**Closet pulse** — Four tiles across the top: total pieces, worn this month,
needs love (unworn 90+ days), and loved. The last two are buttons that apply
themselves as filters.

**Archive** — Move a piece out of the active closet without deleting it, for
things being donated, sold, or stored for the season.

**Backup** — Export the whole closet, photos included, as a single JSON file;
restore it on another device or browser from the same menu.

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
  page.tsx          the closet: header, pulse, filters, grid, overlays
  globals.css       design tokens and component classes
  icon.svg, apple-icon.tsx, manifest.ts
components/
  ItemCard          grid card with quick favourite / wore-it-today actions
  ItemDetail        detail sheet with wear history
  ItemEditor        add & edit form
  FilterBar         category rail, season chips, advanced filter panel
  ClosetPulse       the four stat tiles
  SettingsMenu      backup, restore, sample closet, erase
  Modal, ItemPhoto, Icons
lib/
  types.ts          Item, Filters and the rest of the domain model
  taxonomy.ts       categories, seasons, colours, dress codes, tag suggestions
  db.ts             IndexedDB access + object-URL cache
  store.tsx         React context and all mutations
  wardrobe.ts       filtering, sorting, stats, "last worn" formatting
  image.ts          photo downscaling and data-URL conversion
  sample.ts         the demo closet
```
