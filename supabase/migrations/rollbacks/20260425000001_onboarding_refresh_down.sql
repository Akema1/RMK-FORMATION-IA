-- Rollback for onboarding refresh — 2026-04-25
--
-- WARNING: DESTRUCTIVE. This migration drops the participant_survey table
-- (every survey response is permanently lost) and removes 10 columns from
-- public.participants — including payment_reference, consent_at, and
-- onboarding_completed_at. Any value stored in those columns will be lost.
--
-- Do NOT run this in production without:
--   1. A confirmed pg_dump backup of public.participants and
--      public.participant_survey taken within the last 24h.
--   2. Sign-off from the admin owner — coordinate with the team before
--      executing.
--   3. Awareness that application code expecting these columns/table will
--      break until reverted to a pre-2026-04-25 release.
--
-- Pairs with 20260425000000_onboarding_refresh.sql.

BEGIN;

DROP TABLE IF EXISTS public.participant_survey;

DROP INDEX IF EXISTS public.participants_payment_reference_udx;
DROP INDEX IF EXISTS public.participants_referral_channel_idx;
DROP INDEX IF EXISTS public.participants_status_payment_created_idx;

ALTER TABLE public.participants
  DROP COLUMN IF EXISTS referral_channel,
  DROP COLUMN IF EXISTS referrer_name,
  DROP COLUMN IF EXISTS channel_other,
  DROP COLUMN IF EXISTS consent_at,
  DROP COLUMN IF EXISTS payment_provider,
  DROP COLUMN IF EXISTS payment_reference,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS confirmed_by_admin_id,
  DROP COLUMN IF EXISTS confirmation_notes,
  DROP COLUMN IF EXISTS onboarding_completed_at;

COMMIT;
