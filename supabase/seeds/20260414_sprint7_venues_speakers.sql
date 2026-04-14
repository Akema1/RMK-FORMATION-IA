-- Sprint 7 — branch-DB seed data for venues + speakers.
-- Idempotent: safe to re-run. Source of truth: src/admin/config.ts
-- (DEFAULT_VENUES, DEFAULT_SPEAKERS). Keep in sync if either side changes.
--
-- FORMATION_TEMPLATES has no table (config-only), so it is NOT seeded here.
--
-- Apply to branch DB only:
--   supabase link --project-ref onpsghadqnpwsigzqzer
--   supabase db query --linked -f supabase/seeds/20260414_sprint7_venues_speakers.sql
--   supabase link --project-ref zsnnpmpxcisktfnkxfrx    # restore prod default

begin;

-- ─── venues ────────────────────────────────────────────────────────────────
insert into public.venues (
  id, name, address, zone, stars, capacity_max, capacity_seminar,
  tarif_demi_journee, tarif_journee, tarif_semaine,
  contact_name, contact_phone, contact_email, services, notes
) values
  ('v1','Hôtel Ivoire Sofitel','Boulevard Hassan II, Cocody','Cocody',5,500,200,450000,850000,3500000,'Konan Ama','+225 27 22 48 26 00','events@sofitel-abidjan.com',ARRAY['wifi','projecteur','écran interactif','catering','parking','climatisation']::text[],'Salle de conférence premium, vue panoramique sur la lagune'),
  ('v2','Radisson Blu Abidjan','Avenue Lamblin, Plateau','Plateau',5,400,150,400000,780000,3200000,'Diallo Fatoumata','+225 27 22 20 20 10','events@radissonblu-abidjan.com',ARRAY['wifi','projecteur 4K','visioconférence','catering','parking VIP']::text[],'Salles modulables, équipement AV haut de gamme'),
  ('v3','Pullman Abidjan','Rue du Commerce, Plateau','Plateau',5,350,120,380000,720000,2950000,'Kouamé Eric','+225 27 20 22 23 00','h2275-sb3@accor.com',ARRAY['wifi','projecteur','catering','parking','restaurant gastronomique']::text[],'Cadre business international, service 5 étoiles'),
  ('v4','Hôtel du Plateau','Avenue Botreau Roussel, Plateau','Plateau',4,200,80,230000,450000,1800000,'N''Goran Sylvie','+225 27 22 32 10 10','seminaires@hotelduplateau.ci',ARRAY['wifi','projecteur','catering','parking']::text[],'Hôtel historique du Plateau, ambiance professionnelle'),
  ('v5','Novotel Abidjan','Rue des Jardins, Plateau','Plateau',4,300,100,250000,480000,1950000,'Touré Jean-Marc','+225 27 22 50 01 00','h1477-sb@accor.com',ARRAY['wifi','projecteur','tableaux blancs','catering','parking']::text[],'Salles lumineuses, cocktail dînatoire possible'),
  ('v6','Hôtel Tiama','Rue du Général de Gaulle, Plateau','Plateau',4,150,60,200000,380000,1550000,'Bamba Mariam','+225 27 22 21 78 00','commercial@tiama-hotel.ci',ARRAY['wifi','projecteur','catering']::text[],'Hôtel boutique, ambiance feutrée pour séminaires exclusifs'),
  ('v7','Hôtel Président','Boulevard de la République, Plateau','Plateau',4,180,70,220000,420000,1700000,'Assié Christophe','+225 27 22 21 20 20','events@hotelpresident.ci',ARRAY['wifi','projecteur','climatisation','catering','parking']::text[],'Vue sur la baie de Cocody, sécurité renforcée'),
  ('v8','Azalaï Hôtel Abidjan','Rue des Blokkaus, Zone 4','Zone 4',4,250,90,210000,400000,1620000,'Diaby Aminata','+225 27 21 75 00 00','abidjan@azalaihotels.com',ARRAY['wifi','projecteur','visioconférence','catering','parking gratuit']::text[],'Réseau hôtelier panafricain, équipements modernes'),
  ('v9','Palm Club Hôtel','Rue des Palmiers, Cocody','Cocody',3,100,40,120000,220000,880000,'Koné Bakary','+225 27 22 44 10 00','palmclub@aviso.ci',ARRAY['wifi','projecteur','parking']::text[],'Idéal pour petits groupes, cadre verdoyant'),
  ('v10','Golden Tulip Le Diplomate','Deux-Plateaux, Cocody','Cocody',4,220,80,185000,350000,1420000,'Traoré Isabelle','+225 27 22 41 00 00','events@goldentulip-abidjan.com',ARRAY['wifi','projecteur','catering','parking','piscine']::text[],'Quartier résidentiel Cocody, parking spacieux'),
  ('v11','Hôtel Noom Abidjan','Rue du Commerce, Plateau','Plateau',5,400,180,420000,800000,3300000,'Coulibaly Aminata','+225 27 20 30 40 50','events@noom-abidjan.com',ARRAY['wifi','projecteur 4K','visioconférence','catering','parking VIP','climatisation']::text[],'Hôtel contemporain design, salles modulables avec vue sur la lagune'),
  ('v12','Mövenpick Hôtel Abidjan','Rue des Jardins, Plateau','Plateau',5,350,150,390000,740000,3050000,'Bah Oumou','+225 27 21 00 10 00','events@movenpick-abidjan.com',ARRAY['wifi','projecteur','catering','parking','restaurant gastronomique']::text[],'Standard international Mövenpick, service haut de gamme')
on conflict (id) do nothing;

-- ─── speakers ──────────────────────────────────────────────────────────────
insert into public.speakers (
  id, name, title, company, expertise, linkedin_url, email, phone,
  tarif_demi_journee, tarif_journee, disponible, langues, note, avatar_initials,
  biography, formations_history
) values
  ('sp0','Djimtahadoum Memtingar','Expert-Consultant & Formateur en IA Générative','CABEXIA — Cabinet d''Expertise en Intelligence Artificielle',
   ARRAY['IA générative','Prompt Engineering avancé','Conseil stratégique IA','Transformation digitale','Conférences internationales']::text[],
   'https://linkedin.com/in/djimtahadoum-memtingar','contact@cabex-ia.com','+235 61 47 91 19',
   175000,350000,true,
   ARRAY['Français','Arabe']::text[],
   'Fondateur CABEXIA. 10+ entreprises, 230+ professionnels formés, 400+ ateliers, 10 000+ participants grand public. Formateur référent RMK Conseils.',
   'DM',
   'Expert-consultant, formateur et conférencier en intelligence artificielle générative, reconnu pour sa capacité à rendre l''IA concrète, accessible et immédiatement utile aux professionnels, aux institutions et aux entreprises. À travers CABEXIA, il accompagne la transformation des pratiques de travail en mettant l''intelligence artificielle au service de la productivité, de la performance et de la qualité des livrables. Son approche est résolument pratique, orientée résultats et conçue pour répondre aux réalités du terrain africain.',
   ARRAY[
     'Programme de formation de 2 000 jeunes à l''IA — Ministère des Postes & Économie Numérique (Tchad)',
     'Formation des femmes du Ministère du Pétrole, des Mines et de la Géologie',
     'Formation de 63 femmes journalistes — HAMA (Haute Autorité des Médias Audiovisuels)',
     'Formation de hauts cadres financiers — Guessconsulting Finance & Investissement',
     'Consultant au Rectorat universitaire du Tchad — intégration IA dans l''enseignement supérieur',
     'Consultant & formateur — Haute Autorité des Médias Audiovisuels (HAMA)',
     'Conférence Forum de Tunis — 6e Forum International, Deepfakes & mesures de protection',
     'Conférence ECOBANK — IA & éducation',
     'Conférence UBA — IA & entrepreneuriat'
   ]::text[]),
  ('sp1','Dr. Koffi Mensah','Expert IA Générative & NLP','TechAfrica Solutions',
   ARRAY['IA générative','NLP','ChatGPT Enterprise','Prompt Engineering']::text[],
   'https://linkedin.com/in/koffi-mensah-ia','k.mensah@techafrica.ci','+225 07 08 09 10 11',
   125000,250000,true,ARRAY['Français','Anglais']::text[],'Intervenu à l''ENSEA, HEC Abidjan, ISTI','KM',null,null),
  ('sp2','Aminata Diallo','Data Scientist & ML Engineer','Dakar AI Hub',
   ARRAY['Machine Learning','Data Science','Python','Analyse prédictive']::text[],
   'https://linkedin.com/in/aminata-diallo-ds','a.diallo@dakarAI.sn','+221 77 123 45 67',
   110000,220000,true,ARRAY['Français','Wolof','Anglais']::text[],'5 ans chez Orange Data Analytics, certifiée Google Cloud AI','AD',null,null),
  ('sp3','Jean-Baptiste Kouassi','Expert Automatisation & RPA','AutomateCI',
   ARRAY['Automatisation','RPA','Zapier/Make','Agents IA','No-code']::text[],
   'https://linkedin.com/in/jb-kouassi-automation','jb@automate.ci','+225 05 06 07 08 09',
   100000,200000,true,ARRAY['Français','Anglais']::text[],'Formateur certifié Make.com et Zapier, 200+ automatisations déployées','JK',null,null),
  ('sp4','Fatou Ndiaye','Experte IA & Finance / RegTech','FinTech Afrique',
   ARRAY['IA & Finance','RegTech','Analyse de risque IA','Crypto & Blockchain']::text[],
   'https://linkedin.com/in/fatou-ndiaye-fintech','f.ndiaye@fintechafrique.com','+221 76 234 56 78',
   115000,230000,true,ARRAY['Français','Anglais']::text[],'Ancienne directrice Digital BICICI, board member GSMA Africa','FN',null,null),
  ('sp5','Marc Dupont','Juriste spécialisé IA & LegalTech','Cabinet LexIA',
   ARRAY['IA & Droit','LegalTech','RGPD Afrique','Contrats IA','Propriété intellectuelle']::text[],
   'https://linkedin.com/in/marc-dupont-legaltech','m.dupont@lexia.ci','+225 07 12 34 56 78',
   120000,240000,false,ARRAY['Français']::text[],'Doctorat droit numérique Paris II, expert OHADA digital','MD',null,null),
  ('sp6','Dr. Soro Ibrahim','Expert IA & Santé / MedTech','HealthIA Africa',
   ARRAY['IA Santé','MedTech','Diagnostic assisté par IA','Télémédecine']::text[],
   'https://linkedin.com/in/soro-ibrahim-healthia','i.soro@healthia-africa.com','+225 05 45 67 89 01',
   130000,260000,true,ARRAY['Français','Anglais','Dioula']::text[],'Médecin + PhD en IA médicale, partenaire OMS Afrique','SI',null,null),
  ('sp7','Awa Coulibaly','Experte IA & RH / People Analytics','HRTech Côte d''Ivoire',
   ARRAY['IA & RH','People Analytics','Recrutement IA','Bien-être & IA']::text[],
   'https://linkedin.com/in/awa-coulibaly-hrtech','a.coulibaly@hrtech.ci','+225 07 56 78 90 12',
   105000,210000,true,ARRAY['Français']::text[],'DRH ex-Nestlé Afrique, fondatrice HRTech CI','AC',null,null),
  ('sp8','Prof. Yao Akoto','Expert IA & Enseignement / EdTech','Université FHB',
   ARRAY['IA & Éducation','EdTech','ChatGPT pour enseignants','Pédagogie numérique']::text[],
   'https://linkedin.com/in/yao-akoto-edtech','y.akoto@ufhb.edu.ci','+225 05 23 45 67 89',
   95000,190000,true,ARRAY['Français','Anglais','Akan']::text[],'Professeur UFHB, coordinateur programme IA MESRS Côte d''Ivoire','YA',null,null)
on conflict (id) do nothing;

commit;

-- Post-seed sanity check (run manually after apply):
--   select count(*) from public.venues;    -- expect 12
--   select count(*) from public.speakers;  -- expect 9
