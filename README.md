# The Hanger

A calm, fashion-first way to catalogue a wardrobe: photograph every piece, see
what's actually in rotation, and rediscover the things that have been hiding at
the back of the closet.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind 4.
Deploys to Vercel as a static front end. It works with no account and no
network; add a Supabase project and the same closet syncs across devices.

## What it does

**Five views** — *Closet* (everything you own), *Outfits* (looks built from
pieces you own), *Inspo* (reference material and vibes), *Plan* (a calendar of
what to wear and packing lists for trips), and *Insights* (what the closet is
actually doing). Sections sit in the header on a laptop and in a bottom bar on a
phone.

**Kept calm on purpose** — the closet screen is clothes, not controls. All
narrowing lives behind one *Filters* button beside the category rail, so a phone
shows about 220px of chrome and then garments; the four stat tiles appear only
where there's room for them, and reduce to a single line on a phone.

**Quick add** — Pick a batch of photos at once and give each a name, category
and seasons in a single pass. Cataloguing a whole wardrobe one modal at a time
is the slow part of an app like this; everything else can be filled in later.

**Dark mode** — Light by default; switch from the settings menu and the choice
sticks. The theme resolves before first paint, so there's no flash.

**Storage locations** — Track where each piece physically lives. Five standard
locations ship with the app (Bedroom Closet, Coat Closet, Bedroom Dresser,
Sub-storage, Storage Bin) and any location she types becomes a first-class
option, offered on every piece after that. Locations are filterable and
searchable.

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

**Inspo** — A board for whole looks and vibes: screenshots from Pinterest, a
colour story, jewellery and shoes that go together. Several images per board,
free-text notes, a link back to the source, seasons and tags — and you can link
pieces you already own that fit the vibe, so it's clear what you're working
with. This replaces the old wishlist checkbox; existing wishlist pieces are
migrated into the closet with a `wishlist` tag so nothing is lost.

**Plan · Calendar** — Plan what to wear on any day: pick a saved look or
individual pieces, add a note ("dinner with the Shahs — gold earrings"), and the
month grid shows a thumbnail of the plan on that day. Tapping a past or present
day offers *Mark as worn*, which logs a wear for every piece in one tap, so
planning and tracking are the same gesture rather than two chores.

**Plan · Packing lists** — A list per trip, with dates and a destination. Add
whole looks or single pieces; the checklist is **derived, never copied**, so
editing a look later updates every list it's packed in. Each row shows which
look the piece came from, where it's kept, and whether it's in the wash — the
three things that actually stall packing. Tick as you go and the progress bar
follows.

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

**Recently deleted** — Deleting moves a piece to a 30-day trash rather than
erasing it, and the toast offers a straight *Undo*. Restoring brings back the
record, its photo, its wear history and the looks it belonged to, and un-deletes
it in the cloud too. A delete arriving from another device lands in that
device's trash as well, so the machine where the tap happened isn't the only way
back. Curating a wardrobe is hours of work, so a mis-tap is never final.

**Backup** — Export everything — pieces, photos, outfits, wear history,
inspiration boards, the calendar and packing lists — as a single JSON file;
restore it on another device or browser from the same menu. Restoring re-keys
everything, so a backup merges into an existing closet rather than colliding
with it, and a day already on the calendar is never overwritten by an incoming
one.

## Where the data lives

Everything is stored in **IndexedDB in the browser** — item records in one
object store, photos as blobs in another. No account is needed. The app asks for
a storage-persistence grant on first load, because without one iOS Safari evicts
script-writable storage after about a week without a visit.

Add a Supabase project (below) and the same closet follows you across devices:
the browser stays the source of truth for reading, and the cloud becomes a
mirror your other devices read from.

## Sync across devices

Optional. Unset, the app is a private local-only closet, exactly as it was
before accounts existed.

**1. Create a project** at [supabase.com](https://supabase.com) (the free tier
is plenty).

**2. Create the schema.** Open Dashboard → SQL Editor → New query, paste all of
[`supabase/schema.sql`](supabase/schema.sql), and run it. It creates the tables,
the row-level-security policies, and the private `wardrobe` bucket for photos.
Re-running it later is safe.

**3. Copy the keys** from Dashboard → Settings → API: the *Project URL* and the
*anon / public* key.

**4. Set them as environment variables.** For the deployed app: Vercel →
your project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Then **redeploy** — these are inlined at build time, so an existing deployment
won't pick them up on its own. For local development, put the same two lines in
`.env.local` (see `.env.example`).

**5. Point auth at the deployed app.** Dashboard → Authentication → URL
Configuration: set *Site URL* to the production URL and add both it and
`http://localhost:3000` to *Redirect URLs*. Password reset sends people back to
`window.location.origin`, and Supabase refuses any origin not on that list — so
skipping this leaves reset broken in production only, which is an unpleasant
place to discover it.

**6. Sign up in the app** — settings menu → *Sign in to sync*. Use the same
email on her phone and her laptop and both stay in step.

By default Supabase emails a confirmation link on sign-up. To skip that for a
two-person app, turn off Dashboard → Authentication → Sign In / Providers →
*Confirm email*.

### How the sync works

Records carry an `updatedAt`, and the newer timestamp wins — last-write-wins,
per record. That is the right trade here: two devices rarely edit the same piece
in the same second, and the failure mode (one edit of one piece loses) is much
cheaper than merging field by field.

Deletes travel as tombstones, and a tombstone is just another timestamped fact:
it wins only if it is newer than the copy on the device. That is what makes
restoring safe — a revived piece carries a fresh `updatedAt`, so it outranks the
deletion and is pushed back up even if the restore itself happened with no
signal. Each table reconciles independently, so one that fails is reported by
name and doesn't stop the other four.

Local writes go to IndexedDB first and are mirrored to the cloud in the
background, so the app stays fast and keeps working with no signal; the next
sync carries anything that didn't make it. A full reconcile runs on sign-in, on
load while signed in, and from *Sync now*.

### Is the anon key safe in the browser?

Yes — that is what it is for. Every table has row-level security enabled with
policies that check `auth.uid() = user_id`, and photos live in a private bucket
whose policies key off the owning folder. The key grants only what those
policies allow, which is your own rows and nothing else.

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
Next.js and needs no build configuration — the app is fully static. Push to the
branch and it redeploys.

Without cloud sync that is the whole story. With it, set
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Settings →
Environment Variables (they live on the free plan; the *Custom Environments*
card on the Environments page is a different, paid feature and isn't needed).
Because the two values are inlined at build time, adding them changes nothing
until a build runs — redeploy afterwards, with the build cache off, or the app
keeps serving the local-only bundle.

On a phone, "Add to Home Screen" installs it as a standalone app (web manifest
and icons are included).

## Layout

```
app/
  layout.tsx        fonts, metadata, closet provider
  page.tsx          the closet: pulse, filters, grid, overlays
  outfits/page.tsx  saved looks
  inspo/page.tsx    reference boards
  plan/page.tsx     outfit calendar and packing lists
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
  InspoCard         collage card for a saved board
  InspoDetail       board sheet with a lightbox and linked pieces
  InspoEditor       multi-image board builder
  DayPlanSheet      what to wear on one day, and marking it worn
  TripSheet         a packing list and its derived checklist
  AccountSheet      sign in / create account / sync status
  TrashSheet        recently deleted, restore or erase
  SettingsMenu      account, backup, restore, sample closet, theme, erase
  Modal, ItemPhoto, Icons
lib/
  types.ts          Item, Outfit, Inspo, DayPlan, Trip, Filters
  taxonomy.ts       categories, seasons, colours, dress codes, statuses, tags
  db.ts             IndexedDB (v6): records, photos, tombstones, 30-day trash
  supabase.ts       cloud client; null when sync isn't configured
  auth.tsx          session, sign in / up / out
  sync.ts           row mapping, last-write-wins reconcile, photo transfer
  store.tsx         React context and all mutations
  wardrobe.ts       filtering, sorting, stats, "last worn" formatting
  image.ts          photo downscaling and data-URL conversion
  sample.ts         the demo closet
scripts/
  generate-sample-art.mjs   redraws public/sample/*.svg
supabase/
  schema.sql        tables, RLS policies, photo bucket
```
