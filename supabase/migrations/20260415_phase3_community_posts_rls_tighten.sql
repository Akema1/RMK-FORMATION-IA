-- Sprint 7 Phase 3: tighten community_posts write policy + normalize emails.
--
-- Phase 1 (20260414_sprint7_venues_speakers_community.sql) shipped the
-- community_posts table with `with check (true)` so authenticated clients
-- could write directly. Phase 3 moves all writes through
-- POST /api/community/post, which uses the service role and therefore
-- bypasses RLS. Replacing the policy with `with check (false)` makes it
-- impossible for any non-service-role caller to insert — defense in depth:
-- even if the API endpoint has a bug, the database refuses to accept a
-- direct write from a client SDK.
--
-- SELECT remains public (the community feed is intentionally public).
--
-- ORDERING: this migration must be applied AFTER the endpoint + client
-- code are live on the Vercel preview (Tasks 1–8). If it runs before the
-- deploy, there is a window where the old client tries to do direct
-- inserts against a policy that now refuses them, and the community tab
-- breaks on preview. Applying the migration with an explicit
-- --project-ref onpsghadqnpwsigzqzer (branch DB) also prevents accidental
-- apply against the prod link.

begin;

-- ── Step 1: email normalization (conditional) ────────────────────────────
-- The /api/community/post endpoint normalizes incoming emails to lowercase
-- before looking up the participant (src/api/community/post.ts calls
-- email.trim().toLowerCase()). Any mixed-case row in participants.email
-- would silently 403 every post attempt from that participant even though
-- the registration is valid.
--
-- Per Task 9 Step 1 of the plan, audit mixed-case emails BEFORE landing
-- this migration:
--
--   curl -s "${VITE_SUPABASE_URL}/rest/v1/participants?select=id,email" \
--     -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
--     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
--     | jq -r '.[] | select(.email != (.email | ascii_downcase)) | [.id, .email] | @tsv'
--
-- If the audit returns any rows, uncomment the line below before running
-- `supabase db push`. If empty, leave it commented — the line is a no-op
-- in the empty case but an unnecessary UPDATE on an audited-clean table
-- is preferable to skip entirely.
--
-- update public.participants set email = lower(email) where email <> lower(email);

-- ── Step 2: swap the Phase 1 authenticated-write policy for a deny ───────
drop policy if exists "community_posts_auth_write" on public.community_posts;

create policy "community_posts_service_role_only_write" on public.community_posts
  for insert to authenticated, anon
  with check (false);

-- The public read policy (community_posts_public_read, from the Phase 1
-- migration) is left untouched. The service role bypasses RLS by default,
-- so no explicit service-role insert policy is needed.

commit;

-- ─── ROLLBACK (manual, for emergency revert) ─────────────────────────────
-- If this migration causes incidents and the endpoint deploy can't be
-- un-reverted, run the following SQL to re-open direct writes:
--
--   drop policy if exists "community_posts_service_role_only_write"
--     on public.community_posts;
--   create policy "community_posts_auth_write" on public.community_posts
--     for insert to authenticated with check (true);
--
-- This restores Phase 1 behavior. Use only in incident response.
