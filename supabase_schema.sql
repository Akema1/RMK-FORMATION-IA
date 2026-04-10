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
  entreprise TEXT NOT NULL,
  status TEXT DEFAULT 'Nouveau'::text,
  value INTEGER DEFAULT 0,
  lastContact TEXT
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
