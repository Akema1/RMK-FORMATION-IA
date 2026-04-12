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

-- Table: leads (Prospects CRM)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  nom TEXT NOT NULL,
  entreprise TEXT,
  contact TEXT,
  source TEXT,
  status TEXT DEFAULT 'froid'::text CHECK (status IN ('froid', 'tiede', 'chaud', 'converti', 'perdu')),
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
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL,
  assignee TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT DEFAULT 'pending'::text CHECK (status IN ('pending', 'in_progress', 'done', 'blocked'))
);

-- Table: expenses (Dépenses budgétaires)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status TEXT DEFAULT 'planned'::text CHECK (status IN ('planned', 'approved', 'paid', 'cancelled')),
  date TEXT NOT NULL
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seminars ENABLE ROW LEVEL SECURITY;

-- participants: public can INSERT (registration), authenticated can do everything
CREATE POLICY "Allow public registration inserts"
  ON public.participants FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to participants"
  ON public.participants FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- seminars: public can SELECT (catalog/landing page), authenticated can do everything
CREATE POLICY "Allow public read seminars"
  ON public.seminars FOR SELECT
  TO anon USING (true);

CREATE POLICY "Allow authenticated full access to seminars"
  ON public.seminars FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- leads: authenticated only
CREATE POLICY "Allow authenticated full access to leads"
  ON public.leads FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- tasks: authenticated only
CREATE POLICY "Allow authenticated full access to tasks"
  ON public.tasks FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- expenses: authenticated only
CREATE POLICY "Allow authenticated full access to expenses"
  ON public.expenses FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Idempotent migration: add CHECK constraints on existing installs
-- ============================================================
-- CREATE TABLE IF NOT EXISTS above is a no-op on existing tables, so fresh
-- installs get constraints from the column definitions, while pre-existing
-- deployments need these ALTER statements. Each block tolerates re-runs.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_amount_check')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_amount_check CHECK (amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_status_check')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_status_check CHECK (status IN ('pending','confirmed','cancelled','waitlist')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_payment_check')
  THEN ALTER TABLE public.participants ADD CONSTRAINT participants_payment_check CHECK (payment IS NULL OR payment IN ('pending','partial','paid','refunded')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seminars_seats_check')
  THEN ALTER TABLE public.seminars ADD CONSTRAINT seminars_seats_check CHECK (seats > 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_status_check')
  THEN ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN ('froid','tiede','chaud','converti','perdu')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check')
  THEN ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('pending','in_progress','done','blocked')); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_check')
  THEN ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_check CHECK (amount >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_status_check')
  THEN ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check CHECK (status IN ('planned','approved','paid','cancelled')); END IF;
END $$;
