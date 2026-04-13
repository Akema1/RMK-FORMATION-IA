-- Migration: Schema reshape to align with upstream ui-ux-audit column model
-- ---------------------------------------------------------------------------
-- Upstream's TypeScript types (src/admin/types.ts) use different column names
-- for tasks/expenses and a different status enum for leads than main had.
-- Since prod tables are confirmed EMPTY (0 rows), we reshape via DROP+CREATE
-- rather than column-level ALTER + backfill.
--
-- Changes:
--   1. leads.status enum: ('froid','tiede','chaud','converti','perdu')
--                      -> ('froid','tiede','chaud','signé')
--   2. tasks: drop old columns, recreate with (task, owner, deadline, seminar,
--             priority, status{todo,progress,done})
--   3. expenses: drop old columns, recreate with (label, category, amount,
--                seminar, paid)
--
-- Safety:
--   * DATA LOSS GUARD: raises exception if any target table has rows. This
--     migration is for the empty-branch scenario ONLY. If you ever need to
--     apply this against a populated DB, replace with column-level ALTERs
--     and a backfill strategy.
--   * Re-creates RLS policies (strict: authenticated-only for tasks/expenses,
--     matching main's security posture — NOT upstream's anon-write policies)
--
-- Intended target: Supabase BRANCH (integrate-upstream-ui-ux-audit), NOT prod.

-- ============================================================
-- 0. Data-loss guard
-- ============================================================
DO $$
DECLARE
  leads_count INTEGER;
  tasks_count INTEGER;
  expenses_count INTEGER;
BEGIN
  SELECT count(*) INTO leads_count FROM public.leads;
  SELECT count(*) INTO tasks_count FROM public.tasks;
  SELECT count(*) INTO expenses_count FROM public.expenses;

  IF leads_count > 0 OR tasks_count > 0 OR expenses_count > 0 THEN
    RAISE EXCEPTION 'REFUSING TO RESHAPE: target tables are not empty (leads=%, tasks=%, expenses=%). This migration is destructive and only safe against empty branch DBs. Write a column-level ALTER migration instead.',
      leads_count, tasks_count, expenses_count;
  END IF;
END $$;

-- ============================================================
-- 1. leads: swap status check constraint
-- ============================================================
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('froid','tiede','chaud','signé'));

-- Update default to match new enum (keep 'froid' as default)
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'froid'::text;

-- ============================================================
-- 2. tasks: drop and recreate with upstream column model
-- ============================================================
DROP TABLE IF EXISTS public.tasks CASCADE;

CREATE TABLE public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  task TEXT NOT NULL,
  owner TEXT NOT NULL,
  deadline TEXT,
  seminar TEXT,
  priority TEXT DEFAULT 'medium'::text CHECK (priority IN ('high','medium','low')),
  status TEXT DEFAULT 'todo'::text CHECK (status IN ('todo','progress','done'))
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Strict: authenticated only. Auto-task creation on registration goes through
-- the backend service-role key, never anon inserts.
CREATE POLICY "Allow authenticated full access to tasks"
  ON public.tasks FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. expenses: drop and recreate with upstream column model
-- ============================================================
DROP TABLE IF EXISTS public.expenses CASCADE;

CREATE TABLE public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  seminar TEXT,
  paid BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to expenses"
  ON public.expenses FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
