-- Sprint 8: Server-side seminar capacity enforcement (TODOS P2 #13).
-- Prevents overselling the 20-seat ateliers by:
--   1. BEFORE INSERT OR UPDATE trigger on participants
--   2. pg_advisory_xact_lock keyed by seminar id to serialize concurrent inserts
--   3. Count active rows (status NOT IN 'cancelled','waitlist') joined against
--      seminars.seats for the authoritative capacity
--   4. Raise SQLSTATE P0013 with message "Atelier complet" when at capacity
--
-- Fail-open for unknown seminars: pack2/pack4 have no row in `seminars`, so
-- the trigger no-ops for them. Pack capacity is tracked as TODOS P2 #14.
--
-- Exposes public.get_seminar_capacity() as a SECURITY DEFINER function (not a
-- view) because view RLS semantics vary across Postgres minor versions. The
-- function form is explicit and guaranteed to bypass the RLS on participants
-- that otherwise blocks anon SELECT.
--
-- ─── Rollback ─────────────────────────────────────────────────────────────
-- To revert this migration manually:
--   BEGIN;
--   DROP TRIGGER IF EXISTS participants_enforce_capacity ON public.participants;
--   DROP FUNCTION IF EXISTS public.enforce_seminar_capacity();
--   DROP FUNCTION IF EXISTS public.get_seminar_capacity();
--   COMMIT;
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Trigger function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_seminar_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seats      INTEGER;
  v_active     INTEGER;
  v_new_active BOOLEAN;
  v_old_active BOOLEAN;
BEGIN
  -- Skip when the new row would not occupy a seat.
  v_new_active := COALESCE(NEW.status, 'pending') NOT IN ('cancelled','waitlist');
  IF NOT v_new_active THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only enforce if the change is (a) moving to a different seminar,
  -- or (b) transitioning into an active status from an inactive one. Pure
  -- pending→confirmed stays active→active, no re-check needed (the row was
  -- already counted when first inserted).
  IF TG_OP = 'UPDATE' THEN
    v_old_active := COALESCE(OLD.status, 'pending') NOT IN ('cancelled','waitlist');
    IF v_old_active AND OLD.seminar IS NOT DISTINCT FROM NEW.seminar THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Look up the authoritative seat count. Fail-open for unknown seminar ids
  -- (packs, legacy data) — they don't occupy a single atelier's seat pool.
  SELECT seats INTO v_seats FROM public.seminars WHERE id = NEW.seminar;
  IF v_seats IS NULL THEN
    RETURN NEW;
  END IF;

  -- Advisory lock keyed by seminar id. Scoped to the transaction, so it auto-
  -- releases on commit or rollback. Concurrent inserts for the SAME seminar
  -- serialize; different seminars proceed in parallel.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('participants_capacity:' || NEW.seminar, 0)
  );

  -- Count active registrations for this seminar, excluding the row being
  -- updated (so an UPDATE that changes seminar s1→s2 doesn't double-count).
  SELECT count(*) INTO v_active
  FROM public.participants
  WHERE seminar = NEW.seminar
    AND status NOT IN ('cancelled','waitlist')
    AND (TG_OP = 'INSERT' OR id <> OLD.id);

  IF v_active >= v_seats THEN
    RAISE EXCEPTION 'Atelier complet'
      USING ERRCODE = 'P0013',
            HINT = 'Choisissez un autre atelier ou inscrivez-vous sur la liste d''attente.';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Trigger binding
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS participants_enforce_capacity ON public.participants;
CREATE TRIGGER participants_enforce_capacity
  BEFORE INSERT OR UPDATE OF seminar, status
  ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seminar_capacity();

-- ─────────────────────────────────────────────────────────────
-- 3. Public capacity function (SECURITY DEFINER)
--
-- RLS on participants blocks anonymous count queries. We expose aggregate
-- capacity via a function marked SECURITY DEFINER so it runs with the owner's
-- rights regardless of the caller. Only aggregate counts and seat totals are
-- returned — never individual participant rows.
--
-- Marked STABLE (no writes, deterministic within a tx) so the planner can
-- cache results inside a single query. search_path is pinned to public to
-- prevent search_path hijacking in SECURITY DEFINER context.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_seminar_capacity()
RETURNS TABLE (
  id           TEXT,
  code         TEXT,
  seats        INTEGER,
  active_count INTEGER,
  is_full      BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.code,
    s.seats,
    COALESCE(p.active_count, 0)::int AS active_count,
    (COALESCE(p.active_count, 0) >= s.seats) AS is_full
  FROM public.seminars s
  LEFT JOIN (
    SELECT seminar, count(*)::int AS active_count
    FROM public.participants
    WHERE status NOT IN ('cancelled','waitlist')
    GROUP BY seminar
  ) p ON p.seminar = s.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_seminar_capacity() TO anon, authenticated;

COMMIT;
