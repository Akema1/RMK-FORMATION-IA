-- Seed: 2 example PUBLISHED Veille IA articles (banque/finance) — Slice 1.
-- Purpose: make the /veille feed render during dev/QA before real curation.
-- REPLACE these with real curated content before launch.
-- Run AFTER applying supabase_schema.sql. Idempotent (ON CONFLICT DO NOTHING).
-- Transformative synthesis only (link + summary) — never reproduce the source.

INSERT INTO public.veille_articles
  (slug, title_fr, summary_fr, so_what, primary_sector, sectors,
   source_url, source_name, author, status, published_at, formation_links)
VALUES
(
  'scoring-credit-ia-uemoa',
  'Le scoring de crédit par IA arrive dans les banques de l''UEMOA',
  'Plusieurs banques de la zone testent des modèles de machine learning pour évaluer le risque de crédit à partir de données alternatives (mobile money, historique transactionnel). Les premiers retours montrent une meilleure inclusion des TPE et PME sans garantie formelle, mais soulèvent des questions de biais et de conformité BCEAO.',
  '{"banque": "Si vos décisions de crédit reposent uniquement sur les états financiers, un concurrent qui intègre le scoring alternatif approuvera plus vite et plus large. Commencez par un pilote sur un segment TPE."}'::jsonb,
  'banque',
  '["banque","finance"]'::jsonb,
  'https://www.example.com/source-a-remplacer',
  'Exemple — à remplacer',
  'human',
  'published',
  timezone('utc'::text, now()),
  '[{"label":"Formation : IA pour dirigeants de banque","url":"/#formations"}]'::jsonb
),
(
  'detection-fraude-temps-reel-ia',
  'Détection de fraude en temps réel : ce que l''IA change pour les banques ouest-africaines',
  'Les systèmes de détection de fraude par IA analysent les transactions en continu et bloquent les anomalies en millisecondes. Pour les banques de la région, l''enjeu est l''adaptation des modèles aux fraudes locales (mobile money, fausse identité) plutôt que l''import de modèles calibrés ailleurs.',
  '{"banque": "Un modèle de fraude entraîné sur des données européennes ratera les schémas locaux. Exigez de tout fournisseur une calibration sur vos propres données de transaction avant de signer."}'::jsonb,
  'banque',
  '["banque","finance"]'::jsonb,
  'https://www.example.com/source-a-remplacer-2',
  'Exemple — à remplacer',
  'human',
  'published',
  timezone('utc'::text, now()),
  '[]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
