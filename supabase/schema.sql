-- The Hanger — cloud schema.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It is idempotent, so re-running it after an update is safe.
--
-- Every row is owned by a user and readable only by that user. The app talks to
-- Postgres straight from the browser with the anon key, so row-level security is
-- the whole security model — not a nicety. Nothing here trusts the client.

-- ---------------------------------------------------------------- items

create table if not exists public.items (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,

  name         text not null,
  category     text not null,
  subtype      text,
  brand        text,
  color        text,
  size         text,
  location     text,
  seasons      text[] not null default '{}',
  formality    text,
  tags         text[] not null default '{}',
  notes        text,
  purchased_on date,
  price        numeric,
  favorite     boolean not null default false,
  archived     boolean not null default false,
  wishlist     boolean not null default false,
  status       text    not null default 'ready',

  -- Storage object name for the photo, or null. The blob itself lives in the
  -- `wardrobe` bucket under <user_id>/<image_id>.
  image_id     text,

  -- Wear log, stored whole: it is small, always read with the item, and never
  -- queried across items.
  wears        jsonb not null default '[]'::jsonb,

  created_at   timestamptz not null default now(),
  -- Drives last-write-wins during sync, so the client sets it, not the server.
  updated_at   timestamptz not null default now(),
  -- Soft delete: a tombstone has to outlive the row, or a second device would
  -- push the piece straight back.
  deleted_at   timestamptz
);

create index if not exists items_user_updated_idx
  on public.items (user_id, updated_at desc);

-- Added after the first release; harmless on a fresh database.
alter table public.items add column if not exists location text;

-- ---------------------------------------------------------------- outfits

create table if not exists public.outfits (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,

  name       text not null,
  item_ids   uuid[] not null default '{}',
  seasons    text[] not null default '{}',
  formality  text,
  tags       text[] not null default '{}',
  notes      text,
  favorite   boolean not null default false,
  wears      jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists outfits_user_updated_idx
  on public.outfits (user_id, updated_at desc);

-- ---------------------------------------------------------------- inspo

-- Reference material: saved looks, colour stories, screenshots from elsewhere.
-- Unlike an outfit it isn't built from owned pieces, though it can point at
-- some.
create table if not exists public.inspo (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,

  title      text not null,
  note       text,
  source_url text,
  image_ids  text[] not null default '{}',
  item_ids   uuid[] not null default '{}',
  tags       text[] not null default '{}',
  seasons    text[] not null default '{}',
  favorite   boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists inspo_user_updated_idx
  on public.inspo (user_id, updated_at desc);

-- ---------------------------------------------------------------- planning

-- One plan per day per person, so the natural key is (user_id, date).
create table if not exists public.plans (
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null,
  outfit_id  uuid,
  item_ids   uuid[] not null default '{}',
  note       text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, date)
);

create table if not exists public.trips (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,

  name        text not null,
  destination text,
  start_date  date,
  end_date    date,
  notes       text,
  outfit_ids  uuid[] not null default '{}',
  item_ids    uuid[] not null default '{}',
  packed      uuid[] not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists trips_user_updated_idx
  on public.trips (user_id, updated_at desc);

-- ---------------------------------------------------------------- policies

alter table public.items   enable row level security;
alter table public.outfits enable row level security;
alter table public.inspo   enable row level security;
alter table public.plans   enable row level security;
alter table public.trips   enable row level security;

do $$
begin
  -- Four explicit policies per table rather than one `for all`: it keeps the
  -- with-check on insert/update visible, which is what stops a client writing
  -- a row owned by somebody else.
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'items_select_own') then
    create policy items_select_own on public.items for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'items_insert_own') then
    create policy items_insert_own on public.items for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'items_update_own') then
    create policy items_update_own on public.items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'items' and policyname = 'items_delete_own') then
    create policy items_delete_own on public.items for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'outfits' and policyname = 'outfits_select_own') then
    create policy outfits_select_own on public.outfits for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'outfits' and policyname = 'outfits_insert_own') then
    create policy outfits_insert_own on public.outfits for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'outfits' and policyname = 'outfits_update_own') then
    create policy outfits_update_own on public.outfits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'outfits' and policyname = 'outfits_delete_own') then
    create policy outfits_delete_own on public.outfits for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'inspo' and policyname = 'inspo_select_own') then
    create policy inspo_select_own on public.inspo for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inspo' and policyname = 'inspo_insert_own') then
    create policy inspo_insert_own on public.inspo for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inspo' and policyname = 'inspo_update_own') then
    create policy inspo_update_own on public.inspo for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inspo' and policyname = 'inspo_delete_own') then
    create policy inspo_delete_own on public.inspo for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'plans' and policyname = 'plans_select_own') then
    create policy plans_select_own on public.plans for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'plans' and policyname = 'plans_insert_own') then
    create policy plans_insert_own on public.plans for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'plans' and policyname = 'plans_update_own') then
    create policy plans_update_own on public.plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'plans' and policyname = 'plans_delete_own') then
    create policy plans_delete_own on public.plans for delete using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'trips' and policyname = 'trips_select_own') then
    create policy trips_select_own on public.trips for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'trips' and policyname = 'trips_insert_own') then
    create policy trips_insert_own on public.trips for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'trips' and policyname = 'trips_update_own') then
    create policy trips_update_own on public.trips for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'trips' and policyname = 'trips_delete_own') then
    create policy trips_delete_own on public.trips for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------- photos

-- Private bucket; the app reads through the authenticated client, never a
-- public URL, so one person's wardrobe is not guessable from another's.
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', false)
on conflict (id) do nothing;

do $$
begin
  -- Objects are stored as <user_id>/<image_id>, so the first path segment is
  -- the owner check.
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'wardrobe_read_own') then
    create policy wardrobe_read_own on storage.objects for select
      using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'wardrobe_insert_own') then
    create policy wardrobe_insert_own on storage.objects for insert
      with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'wardrobe_update_own') then
    create policy wardrobe_update_own on storage.objects for update
      using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'wardrobe_delete_own') then
    create policy wardrobe_delete_own on storage.objects for delete
      using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
