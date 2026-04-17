-- Table: participants (Inscriptions aux séminaires)
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  tel TEXT,
  societe TEXT NOT NULL,
  fonction TEXT NOT NULL,
  seminar TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT DEFAULT 'pending'::text CHECK (status IN ('pending', 'confirmed', 'cancelled', 'waitlist')),
  payment TEXT CHECK (payment IS NULL OR payment IN ('pending', 'partial', 'paid', 'refunded')),
  notes TEXT,
  CONSTRAINT participants_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE INDEX IF NOT EXISTS participants_email_idx ON public.participants (email);
CREATE INDEX IF NOT EXISTS participants_seminar_idx ON public.participants (seminar);

-- Partial unique index: prevents duplicate active registrations for the same
-- (email, seminar) pair. Cancelled rows are excluded so cancel+re-register works.
-- Added in Sprint 8. Applied via Supabase Management API.
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_seminar_active_udx
  ON public.participants (lower(email), seminar)
  WHERE status NOT IN ('cancelled');

-- Table: leads (Prospects CRM)
-- Status enum aligned with upstream ui-ux-audit merge: froid|tiede|chaud|signé.
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  nom TEXT NOT NULL,
  entreprise TEXT,
  contact TEXT,
  source TEXT,
  status TEXT DEFAULT 'froid'::text CHECK (status IN ('froid', 'tiede', 'chaud', 'signé')),
  notes TEXT
);

-- Table: seminars (Configuration des séminaires)
CREATE TABLE IF NOT EXISTS public.seminars (
  id TEXT PRIMARY KEY, -- Using custom string IDs like 's1', 's2' for compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  week TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  seats INTEGER NOT NULL CHECK (seats > 0),
  targets JSONB DEFAULT '[]'::jsonb,
  sectors JSONB DEFAULT '[]'::jsonb,
  flyer_subtitle TEXT,
  flyer_highlight TEXT,
  flyer_bullets JSONB DEFAULT '[]'::jsonb,
  flyer_image TEXT
);

-- Table: tasks (Tâches opérationnelles)
-- Column model aligned with upstream ui-ux-audit merge (task/owner/priority/seminar).
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  task TEXT NOT NULL,
  owner TEXT NOT NULL,
  deadline TEXT,
  seminar TEXT,
  priority TEXT DEFAULT 'medium'::text CHECK (priority IN ('high', 'medium', 'low')),
  status TEXT DEFAULT 'todo'::text CHECK (status IN ('todo', 'progress', 'done'))
);

-- Table: expenses (Dépenses budgétaires)
-- Column model aligned with upstream ui-ux-audit merge (label/category/paid bool).
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  seminar TEXT,
  paid BOOLEAN NOT NULL DEFAULT false
);

-- Table: settings (Admin key/value config — e.g. budget_config)
-- Introduced by the upstream ui-ux-audit merge. Used by AdminDashboard to
-- persist BudgetConfig and similar admin-only state across sessions.
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- admin_users allowlist + is_admin() helper
-- ============================================================
-- Source of truth for who counts as an admin. Populated via migrations /
-- service-role, never via client. is_admin() is SECURITY DEFINER so it
-- bypasses RLS on admin_users (avoids recursion when called from other
-- tables' policies) and has a pinned search_path to block redirection.
CREATE TABLE IF NOT EXISTS public.admin_users (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seminars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- All CREATE POLICY statements are idempotent via preceding DROP IF EXISTS —
-- required for re-applying supabase_schema.sql against an existing install.

-- admin_users: self read only; writes via service role / migrations
DROP POLICY IF EXISTS "admin_users self read" ON public.admin_users;
CREATE POLICY "admin_users self read"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- participants: anon INSERT (public registration), authenticated SELECT on own
-- row (ClientPortal magic-link lookup), admin full access via is_admin()
DROP POLICY IF EXISTS "Allow public registration inserts" ON public.participants;
CREATE POLICY "Allow public registration inserts"
  ON public.participants FOR INSERT
  TO anon WITH CHECK (true);

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

-- seminars: public SELECT (catalog/landing page), admin-only writes
DROP POLICY IF EXISTS "Allow public read seminars" ON public.seminars;
CREATE POLICY "Allow public read seminars"
  ON public.seminars FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "seminars admin all" ON public.seminars;
CREATE POLICY "seminars admin all"
  ON public.seminars FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- leads: admin only (anon lead capture goes through backend with service role)
DROP POLICY IF EXISTS "leads admin all" ON public.leads;
CREATE POLICY "leads admin all"
  ON public.leads FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- tasks: admin only (auto-task creation on registration goes through backend)
DROP POLICY IF EXISTS "tasks admin all" ON public.tasks;
CREATE POLICY "tasks admin all"
  ON public.tasks FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- expenses: admin only
DROP POLICY IF EXISTS "expenses admin all" ON public.expenses;
CREATE POLICY "expenses admin all"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- settings: admin only (admin key/value store)
DROP POLICY IF EXISTS "settings admin all" ON public.settings;
CREATE POLICY "settings admin all"
  ON public.settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- Idempotent migration: add CHECK constraints on existing installs
-- ============================================================
-- CREATE TABLE IF NOT EXISTS above is a no-op on existing tables, so fresh
-- installs get constraints from the column definitions, while pre-existing
-- deployments need these ALTER statements. Each block tolerates re-runs.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_amount_check')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_amount_check CHECK (amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_email_format')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_status_check')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_status_check CHECK (status IN ('pending','confirmed','cancelled','waitlist')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_payment_check')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_payment_check CHECK (payment IS NULL OR payment IN ('pending','partial','paid','refunded')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seminars_seats_check')
  THEN ALTER TABLE public.seminars ADD CONSTRAINT seminars_seats_check CHECK (seats > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_status_check')
  THEN ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN ('froid','tiede','chaud','signé')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check')
  THEN ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','progress','done')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check')
  THEN ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('high','medium','low')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_check')
  THEN ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_check CHECK (amount >= 0); END IF;
END $$;

-- ============================================================
-- Idempotent migration: add expenses.seminar column on existing installs
-- ============================================================
-- New column introduced by the upstream ui-ux-audit merge for per-seminar
-- expense tracking. Safe to re-run.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'seminar'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN seminar TEXT;
  END IF;
END $$;
