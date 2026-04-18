-- Seed: baseline seminars matching src/data/seminars.ts (single source of truth).
-- Run via `supabase db reset --linked` or applied automatically on fresh preview branches.
--
-- Intentionally does NOT seed admin_users — admin access is tied to your own
-- email and should be added manually post-reset:
--   INSERT INTO public.admin_users (email) VALUES ('your@email.com');

INSERT INTO public.seminars (id, code, title, week, icon, color, seats, targets, sectors, dates) VALUES
  (
    's1', 'S1',
    'IA Stratégique pour Dirigeants',
    '26 – 30 Mai 2026',
    'Briefcase', '#2980B9', 20,
    '["DG","CEO","DGA","Directeurs de département","Cadres dirigeants"]'::jsonb,
    '["Banque","Assurance","Télécoms","Énergie","Distribution","Industrie"]'::jsonb,
    '{"start":"2026-05-26","presentiel":"Mar 26 – Jeu 28 Mai","online":"Ven 29 – Sam 30 Mai"}'::jsonb
  ),
  (
    's2', 'S2',
    'IA appliquée à la Finance',
    '2 – 6 Juin 2026',
    'BarChart3', '#2980B9', 20,
    '["DAF","Analystes financiers","Trésoriers","Risk Managers","Contrôleurs de gestion"]'::jsonb,
    '["Banques (SGBCI, SIB, BICICI, Ecobank)","Assurances","SGI","Microfinance","BCEAO/BRVM"]'::jsonb,
    '{"start":"2026-06-02","presentiel":"Mar 2 – Jeu 4 Juin","online":"Ven 5 – Sam 6 Juin"}'::jsonb
  ),
  (
    's3', 'S3',
    'IA pour les Notaires',
    '9 – 13 Juin 2026',
    'Scale', '#2980B9', 15,
    '["Notaires","Clercs de notaires","Collaborateurs d''études","Juristes immobilier"]'::jsonb,
    '["Études notariales Abidjan","Études notariales hors Abidjan","Cabinets juridiques"]'::jsonb,
    '{"start":"2026-06-09","presentiel":"Mar 9 – Jeu 11 Juin","online":"Ven 12 – Sam 13 Juin"}'::jsonb
  ),
  (
    's4', 'S4',
    'IA pour les Ressources Humaines',
    '16 – 20 Juin 2026',
    'Users', '#2980B9', 15,
    '["DRH","Responsables RH","Chargés de recrutement","Responsables formation","Managers"]'::jsonb,
    '["Multinationales CI","Grandes entreprises locales","Secteur public","ONG internationales"]'::jsonb,
    '{"start":"2026-06-16","presentiel":"Mar 16 – Jeu 18 Juin","online":"Ven 19 – Sam 20 Juin"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  title = EXCLUDED.title,
  week = EXCLUDED.week,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  seats = EXCLUDED.seats,
  targets = EXCLUDED.targets,
  sectors = EXCLUDED.sectors,
  dates = EXCLUDED.dates;
