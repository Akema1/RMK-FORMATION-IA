-- Sprint 8: Partial unique index on participants (email, seminar).
-- Closes the registration race condition where check-then-insert allows
-- concurrent duplicate submissions. The check-duplicate endpoint remains
-- as an optimistic pre-check; this index is the authoritative backstop.
--
-- Partial: excludes cancelled rows so a participant can cancel and re-register
-- for the same seminar. Uses lower(email) for case-insensitive matching.

-- Step 1: Remove active duplicates (keep most recent per email+seminar).
-- Only deletes rows if duplicates exist — no-op on clean data.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lower(email), seminar
           ORDER BY created_at DESC
         ) AS rn
  FROM public.participants
  WHERE status NOT IN ('cancelled')
)
DELETE FROM public.participants
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Create the partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_seminar_active_udx
  ON public.participants (lower(email), seminar)
  WHERE status NOT IN ('cancelled');
