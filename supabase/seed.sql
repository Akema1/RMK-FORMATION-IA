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
    '07 – 11 Juillet 2026',
    'Briefcase', '#2980B9', 20,
    '["DG","CEO","DGA","Directeurs de département","Cadres dirigeants"]'::jsonb,
    '["Banque","Assurance","Télécoms","Énergie","Distribution","Industrie"]'::jsonb,
    '{"start":"2026-07-07","presentiel":"Mar 7 – Jeu 9 Juillet","online":"Ven 10 – Sam 11 Juillet"}'::jsonb
  ),
  (
    's2', 'S2',
    'IA appliquée à la Finance',
    '14 – 18 Juillet 2026',
    'BarChart3', '#2980B9', 20,
    '["DAF","Analystes financiers","Trésoriers","Risk Managers","Contrôleurs de gestion"]'::jsonb,
    '["Banques (SGBCI, SIB, BICICI, Ecobank)","Assurances","SGI","Microfinance","BCEAO/BRVM"]'::jsonb,
    '{"start":"2026-07-14","presentiel":"Mar 14 – Jeu 16 Juillet","online":"Ven 17 – Sam 18 Juillet"}'::jsonb
  ),
  (
    's3', 'S3',
    'IA pour les Notaires',
    '8 – 11 Septembre 2026',
    'Scale', '#2980B9', 15,
    '["Notaires","Clercs de notaires","Collaborateurs d''études","Juristes immobilier"]'::jsonb,
    '["Études notariales Abidjan","Études notariales hors Abidjan","Cabinets juridiques"]'::jsonb,
    '{"start":"2026-09-08","presentiel":"Mar 8 – Jeu 10 Septembre","online":"Ven 11 Septembre"}'::jsonb
  ),
  (
    's4', 'S4',
    'IA pour les Ressources Humaines',
    '15 – 18 Septembre 2026',
    'Users', '#2980B9', 15,
    '["DRH","Responsables RH","Chargés de recrutement","Responsables formation","Managers"]'::jsonb,
    '["Multinationales CI","Grandes entreprises locales","Secteur public","ONG internationales"]'::jsonb,
    '{"start":"2026-09-15","presentiel":"Mar 15 – Jeu 17 Septembre","online":"Ven 18 Septembre"}'::jsonb
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
