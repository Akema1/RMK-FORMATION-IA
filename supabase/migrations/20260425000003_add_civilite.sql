-- Add civilite column to participants — 2026-04-25
--
-- The registration code path (api/_lib/registration.ts) inserts `civilite`
-- and the email templates render `${civilite} ${prenom} ${nom}` for the
-- formal salutation, but no migration ever added the column. Smoke testing
-- against the dev preview surfaced PGRST204:
--   "Could not find the 'civilite' column of 'participants' in the schema cache"
--
-- Civilite is optional ("M." / "Mme") and only used cosmetically in emails.
-- This migration is non-destructive: nullable TEXT with a CHECK constraint
-- limiting values to the two we accept (matching the Zod enum).

BEGIN;

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS civilite TEXT
    CHECK (civilite IS NULL OR civilite IN ('M.', 'Mme'));

COMMIT;
