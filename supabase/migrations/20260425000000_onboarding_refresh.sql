-- Onboarding refresh — 2026-04-25
-- Adds acquisition tracking, payment reference/provider, consent timestamp,
-- and admin confirmation metadata to public.participants, plus a new
-- public.participant_survey table for the onboarding questionnaire.
--
-- Highlights:
--   1. ALTER TABLE participants ADD COLUMN IF NOT EXISTS for 10 new columns
--      (referral_channel, referrer_name, channel_other, consent_at,
--       payment_provider, payment_reference, confirmed_at,
--       confirmed_by_admin_id, confirmation_notes, onboarding_completed_at).
--   2. CHECK constraints scope referral_channel and payment_provider to known
--      values (NULL allowed so legacy rows survive the migration).
--   3. Case-insensitive UNIQUE index on payment_reference (where present)
--      prevents duplicate payment refs across providers.
--   4. Composite index (status, payment, created_at) backs the admin CRM list.
--   5. consent_at backfilled from created_at so existing participants are not
--      blocked by future NOT NULL or RLS checks gated on consent.
--   6. participant_survey table is RLS-protected: participants upsert their
--      own row (matched by JWT email), admins read all rows.
--
-- ─── Rollback ─────────────────────────────────────────────────────────────
-- See 20260425000001_onboarding_refresh_down.sql for the matching rollback.
-- That down migration drops new columns and the participant_survey table —
-- data loss is intentional. Coordinate with admin before running.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. participants — new columns
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS referral_channel TEXT
    CHECK (referral_channel IS NULL OR referral_channel IN
      ('Recommandation','LinkedIn','Facebook','Instagram','Google','Email','Évènement','Autre')),
  ADD COLUMN IF NOT EXISTS referrer_name TEXT,
  ADD COLUMN IF NOT EXISTS channel_other TEXT,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT
    CHECK (payment_provider IS NULL OR payment_provider IN
      ('wave','orange_money','bank_transfer','cash','flutterwave')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  -- Snapshot of auth.users.id at confirmation time. Intentionally no FK:
  -- audit rows must survive the admin's removal from the allowlist.
  ADD COLUMN IF NOT EXISTS confirmed_by_admin_id UUID,
  ADD COLUMN IF NOT EXISTS confirmation_notes TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- payment_reference must be unique (case-insensitive) when present
CREATE UNIQUE INDEX IF NOT EXISTS participants_payment_reference_udx
  ON public.participants (upper(payment_reference))
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS participants_referral_channel_idx
  ON public.participants (referral_channel);

CREATE INDEX IF NOT EXISTS participants_status_payment_created_idx
  ON public.participants (status, payment, created_at);

-- Backfill consent_at for existing rows so legacy participants aren't blocked
UPDATE public.participants
   SET consent_at = created_at
 WHERE consent_at IS NULL;

-- 2. participant_survey — new table
CREATE TABLE IF NOT EXISTS public.participant_survey (
  participant_id UUID PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  secteur TEXT,
  collaborateurs TEXT,
  niveau TEXT CHECK (niveau IS NULL OR niveau IN ('Débutant','Intermédiaire','Avancé')),
  defi TEXT,
  attentes TEXT[],
  recommendation TEXT,
  started_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.participant_survey ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant_survey self upsert" ON public.participant_survey;
CREATE POLICY "participant_survey self upsert"
  ON public.participant_survey
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
       WHERE p.id = participant_survey.participant_id
         AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
       WHERE p.id = participant_survey.participant_id
         AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "participant_survey admin read" ON public.participant_survey;
CREATE POLICY "participant_survey admin read"
  ON public.participant_survey
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
    )
  );

COMMIT;
