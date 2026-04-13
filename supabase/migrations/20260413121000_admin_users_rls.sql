-- ============================================================
-- Blocker #4: admin_users + is_admin() + scoped RLS
-- ============================================================
-- Replaces the permissive "Allow authenticated full access" policies
-- introduced by the upstream ui-ux-audit merge with an allowlist model:
--   - public.admin_users (email PK) holds the authorized admin emails
--   - public.is_admin() SECURITY DEFINER checks auth.jwt() ->> 'email'
--     against admin_users, bypassing RLS on admin_users itself
--   - All leads / tasks / expenses / settings admin writes now require
--     is_admin() instead of merely being authenticated
--   - participants keeps anon INSERT (registration) but authenticated
--     reads are now scoped to the caller's own row by email (ClientPortal
--     magic-link lookup); admin full access via is_admin()
--   - seminars keeps public SELECT, admin writes via is_admin()
--
-- APPLY: supabase db query --linked -f supabase/migrations/20260413121000_admin_users_rls.sql
-- DO NOT run against main/prod Supabase project.
-- ============================================================

-- ---------- admin_users table ----------
CREATE TABLE IF NOT EXISTS public.admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Self-read only: an authenticated user can see their own row (used by the
-- client to check whether they're an admin). No INSERT/UPDATE/DELETE policies
-- -> those go through service role / migrations only.
DROP POLICY IF EXISTS "admin_users self read" ON public.admin_users;
CREATE POLICY "admin_users self read"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- ---------- is_admin() helper ----------
-- SECURITY DEFINER so it bypasses admin_users RLS (prevents recursion when
-- called from policies on other tables). Pinned search_path prevents
-- search_path redirection attacks.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- Least privilege: is_admin() only needs to be callable by authenticated
-- sessions. anon never has an email claim so granting there is meaningless
-- and violates defense-in-depth. CREATE OR REPLACE FUNCTION preserves
-- existing role grants, so REVOKE must name anon explicitly (not just PUBLIC).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- Rewrite policies: drop permissive, add is_admin()-scoped
-- ============================================================

-- ---------- participants ----------
-- Keep anon INSERT for public registration; swap authenticated full-access
-- for (a) per-row self read by email (ClientPortal) and (b) admin full access.
DROP POLICY IF EXISTS "Allow authenticated full access to participants" ON public.participants;

DROP POLICY IF EXISTS "participants self read" ON public.participants;
CREATE POLICY "participants self read"
  ON public.participants FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "participants admin all" ON public.participants;
CREATE POLICY "participants admin all"
  ON public.participants FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- (The "Allow public registration inserts" anon policy from supabase_schema.sql
--  is intentionally left in place.)

-- ---------- seminars ----------
-- Keep public SELECT (catalog). Admin writes only.
DROP POLICY IF EXISTS "Allow authenticated full access to seminars" ON public.seminars;

DROP POLICY IF EXISTS "seminars admin all" ON public.seminars;
CREATE POLICY "seminars admin all"
  ON public.seminars FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- leads ----------
DROP POLICY IF EXISTS "Allow authenticated full access to leads" ON public.leads;

DROP POLICY IF EXISTS "leads admin all" ON public.leads;
CREATE POLICY "leads admin all"
  ON public.leads FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- tasks ----------
DROP POLICY IF EXISTS "Allow authenticated full access to tasks" ON public.tasks;

DROP POLICY IF EXISTS "tasks admin all" ON public.tasks;
CREATE POLICY "tasks admin all"
  ON public.tasks FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- expenses ----------
DROP POLICY IF EXISTS "Allow authenticated full access to expenses" ON public.expenses;

DROP POLICY IF EXISTS "expenses admin all" ON public.expenses;
CREATE POLICY "expenses admin all"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------- settings ----------
DROP POLICY IF EXISTS "Allow authenticated full access to settings" ON public.settings;

DROP POLICY IF EXISTS "settings admin all" ON public.settings;
CREATE POLICY "settings admin all"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Seed admin emails (branch DB only — rotate passwords before prod)
-- ============================================================
INSERT INTO public.admin_users (email) VALUES
  ('donzigre@gmail.com'),
  ('ericatta@gmail.com')
ON CONFLICT (email) DO NOTHING;
