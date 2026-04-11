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
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending'::text,
  payment TEXT,
  notes TEXT
);

-- Table: leads (Prospects CRM)
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  nom TEXT NOT NULL,
  entreprise TEXT,
  contact TEXT,
  source TEXT,
  status TEXT DEFAULT 'froid'::text,
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
  seats INTEGER NOT NULL,
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
  status TEXT DEFAULT 'pending'::text
);

-- Table: expenses (Dépenses budgétaires)
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'planned'::text,
  date TEXT NOT NULL,
  seminar TEXT
);

-- Enable Row Level Security on all tables
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seminars ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can insert participants (public registration form)
CREATE POLICY "anon_insert_participants" ON public.participants
  FOR INSERT TO anon WITH CHECK (true);

-- Policy: authenticated users have full access to participants
CREATE POLICY "auth_all_participants" ON public.participants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: anyone can insert leads (public lead magnet)
CREATE POLICY "anon_insert_leads" ON public.leads
  FOR INSERT TO anon WITH CHECK (true);

-- Policy: authenticated users have full access to leads
CREATE POLICY "auth_all_leads" ON public.leads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: authenticated users have full access to tasks
CREATE POLICY "auth_all_tasks" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: anon can insert tasks (auto-generated from registration)
CREATE POLICY "anon_insert_tasks" ON public.tasks
  FOR INSERT TO anon WITH CHECK (true);

-- Policy: authenticated users have full access to expenses
CREATE POLICY "auth_all_expenses" ON public.expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Policy: anyone can read seminars (public catalog)
CREATE POLICY "anon_read_seminars" ON public.seminars
  FOR SELECT TO anon USING (true);

-- Policy: authenticated users have full access to seminars
CREATE POLICY "auth_all_seminars" ON public.seminars
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
