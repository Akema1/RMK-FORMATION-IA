-- Migration: Upstream ui-ux-audit merge (additive schema changes)
-- ----------------------------------------------------------------
-- Applies only the NEW schema objects introduced by merging
-- donzigre/fix/ui-ux-audit into main. All pre-existing tables, constraints,
-- and policies are already present on the linked database (see prior migration
-- pass on 2026-04-13 that deployed constraints + indexes).
--
-- Changes:
--   1. expenses.seminar column (per-seminar expense tracking)
--   2. settings table (admin key/value store for BudgetConfig etc.)
--
-- Safety:
--   * Fully idempotent — safe to re-run
--   * Additive only — no DROP, no column removal, no type changes
--   * Strict authenticated-only RLS on settings (no anon access)
--
-- Intended target: Supabase BRANCH (e.g. integrate-upstream-ui-ux-audit),
-- NOT production main. Review on branch, then promote via Supabase dashboard.

-- ============================================================
-- 1. expenses.seminar column
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'seminar'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN seminar TEXT;
  END IF;
END $$;

-- ============================================================
-- 2. settings table (admin key/value store)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS (no-op if already enabled)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated only. Admin panel is the sole writer; no anon access.
-- Wrapped in DO block to avoid errors if policy already exists (CREATE POLICY
-- is not IF NOT EXISTS-aware prior to PG 15).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'settings'
      AND policyname = 'Allow authenticated full access to settings'
  ) THEN
    CREATE POLICY "Allow authenticated full access to settings"
      ON public.settings FOR ALL
      TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Trigger: keep updated_at in sync on UPDATE
CREATE OR REPLACE FUNCTION public.set_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_set_updated_at ON public.settings;
CREATE TRIGGER settings_set_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_settings_updated_at();
