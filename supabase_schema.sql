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
  date TEXT NOT NULL
);

-- Disable Row Level Security temporarily to allow anonymous inserts from your frontend
ALTER TABLE public.participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seminars DISABLE ROW LEVEL SECURITY;
