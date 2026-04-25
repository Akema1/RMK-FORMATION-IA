-- Phase 1A review fixes — 2026-04-25
--
-- Two corrections from the post-Phase-1A code review:
--   1. participant_survey RLS used FOR ALL, which permitted DELETE.
--      A participant could DROP their own survey via the API. Replaced
--      with three explicit policies (SELECT, INSERT, UPDATE) so DELETE
--      requires the service role.
--   2. The RLS policy joined participants on lower(email), which forced
--      a sequential scan of public.participants on every survey upsert.
--      Added a functional index on lower(email).
--
-- Pairs with 20260425000000_onboarding_refresh.sql (the original
-- onboarding refresh migration) and is non-destructive — only policy
-- definitions and a new index are touched.

BEGIN;

-- 1. Drop the over-broad FOR ALL policy
DROP POLICY IF EXISTS "participant_survey self upsert" ON public.participant_survey;

-- 2. Three scoped policies: SELECT (read own), INSERT (create own), UPDATE (modify own)
DROP POLICY IF EXISTS "participant_survey self select" ON public.participant_survey;
CREATE POLICY "participant_survey self select"
  ON public.participant_survey
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
       WHERE p.id = participant_survey.participant_id
         AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "participant_survey self insert" ON public.participant_survey;
CREATE POLICY "participant_survey self insert"
  ON public.participant_survey
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
       WHERE p.id = participant_survey.participant_id
         AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "participant_survey self update" ON public.participant_survey;
CREATE POLICY "participant_survey self update"
  ON public.participant_survey
  FOR UPDATE
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

-- 3. Functional index to support the RLS lookup at scale
CREATE INDEX IF NOT EXISTS participants_lower_email_idx
  ON public.participants (lower(email));

COMMIT;
