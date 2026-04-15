-- Sprint 7 — venues, speakers, community posts + seminars column additions
-- Applied to branch DB (onpsghadqnpwsigzqzer) only in Phase 1.
-- Production promotion happens AFTER the PR merges to main.
--
-- ROLLBACK (paste into psql against the branch DB if this migration needs to
-- be reverted; Supabase doesn't auto-generate down migrations):
--
--   begin;
--   alter table public.seminars drop column if exists speaker_ids;
--   alter table public.seminars drop column if exists venue_id;
--   alter table public.seminars drop column if exists status;
--   alter table public.seminars drop column if exists dates;
--   drop index if exists public.seminars_venue_id_idx;
--   drop table if exists public.community_posts cascade;
--   drop table if exists public.speakers cascade;
--   drop table if exists public.venues cascade;
--   commit;

begin;

-- ─── venues ────────────────────────────────────────────────────────────────
create table if not exists public.venues (
  id text primary key,
  name text not null,
  address text not null,
  zone text not null,
  stars int not null check (stars between 1 and 5),
  capacity_max int not null check (capacity_max >= 0),
  capacity_seminar int not null check (capacity_seminar >= 0),
  tarif_demi_journee int not null check (tarif_demi_journee >= 0),
  tarif_journee int not null check (tarif_journee >= 0),
  tarif_semaine int not null check (tarif_semaine >= 0),
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  services text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venues enable row level security;

-- Admin-only access (matches participants/leads/tasks model).
drop policy if exists "venues_admin_all" on public.venues;
create policy "venues_admin_all" on public.venues
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── speakers ──────────────────────────────────────────────────────────────
create table if not exists public.speakers (
  id text primary key,
  name text not null,
  title text not null,
  company text not null,
  expertise text[] not null default '{}',
  linkedin_url text not null default '',
  email text not null default '',
  phone text not null default '',
  tarif_demi_journee int not null check (tarif_demi_journee >= 0),
  tarif_journee int not null check (tarif_journee >= 0),
  disponible boolean not null default true,
  langues text[] not null default '{}',
  note text not null default '',
  avatar_initials text not null default '',
  biography text,
  formations_history text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.speakers enable row level security;

drop policy if exists "speakers_admin_all" on public.speakers;
create policy "speakers_admin_all" on public.speakers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── community_posts ───────────────────────────────────────────────────────
-- Phase 1 RLS: authenticated users only. Phase 3 adds /api/community/post
-- for rate-limited anonymous inserts from the client portal.
create table if not exists public.community_posts (
  id text primary key,
  author text not null,
  initials text not null,
  date text not null,
  text text not null check (char_length(text) <= 2000),
  seminar_tag text not null,
  participant_id text,
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

-- Public read (community feed is intentionally public).
drop policy if exists "community_posts_public_read" on public.community_posts;
create policy "community_posts_public_read" on public.community_posts
  for select to anon, authenticated using (true);

-- Writes require authentication in Phase 1. Phase 3 will add a dedicated
-- /api/community/post endpoint that inserts via the service role.
drop policy if exists "community_posts_auth_write" on public.community_posts;
create policy "community_posts_auth_write" on public.community_posts
  for insert to authenticated with check (true);

-- ─── seminars column additions ────────────────────────────────────────────
-- Upstream Sprint 7 adds per-seminar date ranges, status, venue, and speakers.
alter table public.seminars add column if not exists dates jsonb;
alter table public.seminars add column if not exists status text;
alter table public.seminars add column if not exists venue_id text references public.venues(id) on delete set null;
alter table public.seminars add column if not exists speaker_ids text[];

-- Index the FK so venue-based lookups and joins stay O(log n) as the table grows.
create index if not exists seminars_venue_id_idx on public.seminars(venue_id);

commit;
