# Supabase migrations

## Layout

- `20260410000000_baseline.sql` — full schema as of 2026-04-18. Replaces the pre-squash
  history (see below).
- `20260418000000_seminar_capacity_trigger.sql` — BEFORE INSERT OR UPDATE trigger on
  `participants` that enforces seat caps via `pg_advisory_xact_lock`. SECURITY DEFINER.

## 2026-04-18 squash

The repo previously had 6 migration files (April 13–16) plus 2 dashboard-only
migrations on the remote (`remote_schema`, `enable_rls_with_policies`) that were
never committed. Fresh preview branches couldn't apply the repo's migrations because
the April 13 migrations assumed schema established by the dashboard-only migrations.

Fix: dumped the current prod schema via `supabase db dump --linked --schema public`,
saved as the new baseline, deleted the 6 superseded files, wiped prod's `public` schema
and `supabase_migrations.schema_migrations` tracking table, then re-pushed cleanly.

One non-default grant was missing from the dump — `is_admin()` had an explicit
`REVOKE EXECUTE ... FROM anon` on prod that `pg_dump` didn't emit. Added manually
at the bottom of the baseline file to keep preview ↔ prod schemas identical.

Squashed files (recoverable in git history):
- `20260413113348_upstream_ui_ux_audit_merge.sql`
- `20260413120500_schema_reshape_upstream.sql`
- `20260413121000_admin_users_rls.sql`
- `20260414000000_sprint7_venues_speakers_community.sql`
- `20260415000000_phase3_community_posts_rls_tighten.sql`
- `20260416000000_email_uniqueness.sql`

## Workflow going forward

- New schema changes → new migration file with ISO8601 timestamp prefix
- Test on a preview branch before pushing to prod:
  ```
  supabase branches create <name>
  # follow db-url / link dance; push; smoke-test
  supabase branches delete <id>
  ```
- Seed data lives in `supabase/seed.sql` — applied automatically on fresh
  preview branches and runnable manually via `supabase db query --linked -f supabase/seed.sql`.
- Admin access requires a row in `public.admin_users`. After any schema reset:
  ```sql
  INSERT INTO public.admin_users (email) VALUES ('your@email.com');
  ```
