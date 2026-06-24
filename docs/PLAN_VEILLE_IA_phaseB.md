# Plan d'implémentation — Veille IA (Approche B, vertical Décideurs)

Source design doc (APPROVED) : `~/.gstack/projects/Akema1-RMK-FORMATION-IA/alexis-unknown-design-20260624-121038.md`
Statut : DRAFT (à passer par les review gates avant code — voir §12)
Date : 2026-06-24

> **Note séquencement.** Le design doc recommandait A (brief envoyé à la main) avant B.
> Décision prise : on construit B sans attendre le chiffre de validation. L'Approche A
> reste lançable **en parallèle à coût quasi nul** (le brief peut s'appuyer sur la capture
> email de la Slice 1). Le risque de demande non prouvée est assumé.

---

## 1. Périmètre Phase B

Construire le **vertical Décideurs** comme vraie plateforme de veille intégrée à
RMK-FORMATION-IA. **Hors périmètre** (clones ultérieurs) : verticaux Builders et Finance,
personnalisation + WhatsApp + Décrypteur (= Phase C). Nom de travail : **« Veille IA »**
(terme que les dirigeants comprennent : veille stratégique/technologique).

Définition de « fait » pour B : un flux public d'articles curés par secteur, alimenté par
un pipeline d'agents + relecture humaine, avec capture email (double opt-in) et CTA
« Diagnostic IA » routé vers le CRM.

## 2. Architecture sur la stack existante (carte de réutilisation)

| Besoin | Réutilise (existant) | Net-new |
|---|---|---|
| Front SPA | React 19 + Vite + React Router v7, shadcn/Tailwind, `src/pages` lazy | routes `/veille/*`, pages publiques |
| Back API | Express `api/app.ts`, `ApiResponse<T>`, `express-rate-limit` | endpoints `/api/veille/*` |
| IA | `ai` + `@ai-sdk/gateway` (`gateway("anthropic/...")`), pattern `src/admin/callAI.ts` | agents ingest/curate/brief |
| Cron | `node-cron` (dev) + `vercel.json` cron (prod) | 3 entrées cron veille |
| DB | Supabase, RLS `is_admin()`, pattern idempotent `supabase_schema.sql` | tables `veille_*` |
| CRM | table `leads` (froid/tiede/chaud/signé) | source='veille' |
| Email | Resend (déjà câblé) | envoi brief + double opt-in |
| Admin | `src/admin/Nav.tsx`, `AgentHub`, `ContentStudio` (file d'attente, callAI) | `VeilleReviewPage`, `VeilleSourcesPage` |
| Déploiement | Vercel (live) | — |

## 3. Modèle de données (migration Supabase, style idempotent existant)

```sql
-- Sources de veille (flux mondiaux + régionaux)
CREATE TABLE IF NOT EXISTS public.veille_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('rss','api','scrape')),
  lang TEXT DEFAULT 'en',
  sector_tags JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMPTZ
);

-- Items bruts ingérés (avant curation) — hash pour dédup
CREATE TABLE IF NOT EXISTS public.veille_items_raw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source_id UUID REFERENCES public.veille_sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  title TEXT,
  excerpt TEXT,                 -- court extrait seulement, jamais le texte intégral (cf. §9 copyright)
  published_at TIMESTAMPTZ,
  content_hash TEXT NOT NULL,   -- dédup exacte
  status TEXT DEFAULT 'new' CHECK (status IN ('new','duplicate','rejected','curated')),
  CONSTRAINT veille_items_raw_url_udx UNIQUE (url)
);

-- Articles curés (synthèse transformative, PAS de reproduction)
CREATE TABLE IF NOT EXISTS public.veille_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  raw_item_id UUID REFERENCES public.veille_items_raw(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title_fr TEXT NOT NULL,
  summary_fr TEXT NOT NULL,     -- synthèse originale
  so_what JSONB DEFAULT '{}'::jsonb,  -- { "banque": "...", "agro": "..." }
  primary_sector TEXT NOT NULL,
  sectors JSONB DEFAULT '[]'::jsonb,
  source_url TEXT NOT NULL,     -- lien + attribution obligatoires
  source_name TEXT,
  image_url TEXT,
  author TEXT DEFAULT 'agent' CHECK (author IN ('agent','human')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_review','published','archived')),
  reviewed_by TEXT,
  formation_links JSONB DEFAULT '[]'::jsonb,  -- cross-sell vers seminars
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS veille_articles_status_idx ON public.veille_articles (status);
CREATE INDEX IF NOT EXISTS veille_articles_sector_idx ON public.veille_articles (primary_sector);

-- Abonnés à la veille / brief (double opt-in)
CREATE TABLE IF NOT EXISTS public.veille_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  sectors JSONB DEFAULT '[]'::jsonb,
  source_utm TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','unsub','bounced')),
  CONSTRAINT veille_subscribers_email_udx UNIQUE (lower(email)),
  CONSTRAINT veille_subscribers_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Éditions hebdo du brief (par secteur)
CREATE TABLE IF NOT EXISTS public.veille_editions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  sector TEXT NOT NULL,
  week TEXT NOT NULL,
  article_ids JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','in_review','sent')),
  sent_at TIMESTAMPTZ
);
```

**RLS (même pattern que `participants`/`seminars`)** :
- `veille_articles` : `anon SELECT` **uniquement** `WHERE status='published'` ; `is_admin()` ALL.
- `veille_subscribers` : `anon INSERT WITH CHECK (true)` (capture publique) ; `is_admin()` ALL. Confirmation double opt-in via backend service-role.
- `veille_sources`, `veille_items_raw`, `veille_editions` : `is_admin()` only.
- Capture diagnostic → écrit dans `leads` via backend service-role (jamais anon direct).

## 4. Pipeline éditorial agentique

`api/agents/` (à côté de l'existant). Modèles via gateway (discipline coût du ROADMAP) :

| Agent | Trigger | Modèle | Action | Done |
|---|---|---|---|---|
| `veille-ingest` | cron */3h | (pas d'LLM) | pull sources RSS/API → `veille_items_raw` + `content_hash` | items insérés, dédup exacte par URL/hash |
| `veille-dedup` | post-ingest | embeddings | similarité cosinus > 0.85 → `status='duplicate'` | doublons marqués |
| `veille-curate` | cron quotidien | Haiku→Sonnet | items `new` → `title_fr` + `summary_fr` (synthèse) + `so_what` par secteur + `formation_links` + score confiance → `status='in_review'` | drafts en file |
| `veille-brief` | cron hebdo | Sonnet | assemble édition/secteur depuis `published` → `veille_editions` draft → validation → Resend | brief envoyé aux abonnés du secteur |

**Relecture humaine obligatoire** entre `in_review` et `published` (anti-slop, anti-
hallucination, ton de marque). Cadence plafonnée ~15-25 items/sem/relecteur (cf. design doc).

**Harnais d'éval (work item à part, pas de la config)** : golden set d'items avec
secteur attendu + qualité du « so what » ; check de grounding (chaque affirmation
traçable à la source) ; classification secteur (précision) ; dédup (0 doublon publié).
Toute modif d'agent doit passer la suite (régression, modèle ROADMAP).

## 5. API (dans `api/app.ts`, envelope `ApiResponse<T>`, validation Zod)

Public :
- `GET /api/veille/articles?sector=&page=` → published only.
- `GET /api/veille/articles/:slug`.
- `POST /api/veille/subscribe` → `veille_subscribers` (Zod email), envoi email de confirmation (double opt-in).
- `GET /api/veille/confirm?token=` → `confirmed=true`.
- `POST /api/veille/diagnostic` → crée un `leads` (source='veille', notes=secteur), rate-limited.

Admin (`is_admin()` + auth) :
- `POST /api/veille/curate/run`, `POST /api/veille/articles/:id/review` (approve/edit/reject), `POST /api/veille/brief/run`, CRUD `veille_sources`.

Cron (`vercel.json`) : ingest */3h, curate quotidien, brief hebdo. Réplique node-cron en dev (comme le cron LinkedIn existant dans `server.ts`).

## 6. UI publique (`src/pages/veille/`, lazy-loaded)

- `VeilleHome` : flux par secteur (filtre), cartes article, CTA capture + diagnostic.
- `ArticlePage` : synthèse + « so what mon secteur » + lien source (attribution) + CTA formation.
- `SectorPage`, `DossierPage`, `BriefArchive`.
- Composants funnel : `SubscribeForm` (double opt-in), `DiagnosticCTA`, cross-links formation. Réutilise `ChatWidget` existant.
- Design system existant (shadcn/Tailwind, `LogoRMK`). **Décision marque/domaine** : sous-domaine `veille.rmk-…` (SEO + spin-out) vs route `/veille` (rapide). Voir §11.

Admin (`src/admin/`) : `VeilleReviewPage` (file 1-clic approve/reject, réutilise pattern `ContentStudio`/`AgentHub`), `VeilleSourcesPage`, `VeilleEditionsPage` ; ajout au `Nav.tsx`.

## 7. Découpage en tranches livrables (chaque slice = shippable)

- **Slice 0 — infra** : migration `veille_*` + RLS + types (`src/admin/types.ts`) + squelette API + seed 1 secteur (banque) + 3 sources. *Aucune UI publique.*
- **Slice 1 — bout-en-bout minimal (curation manuelle)** : publier un article à la main → `/veille` rend les `published` d'1 secteur + `ArticlePage` + `SubscribeForm` (double opt-in) + `DiagnosticCTA` → `leads`. **Pas encore d'agents.** Déjà un vrai produit + débloque la capture email de l'Approche A.
- **Slice 2 — agents ingest+curate** : `veille-ingest` + `veille-dedup` + `veille-curate` → file de relecture admin → publish 1-clic. Harnais d'éval v1.
- **Slice 3 — brief hebdo** : `veille-brief` → Resend aux abonnés par secteur + `BriefArchive`.
- **Slice 4 — SEO + perf + funnel analytics** : meta/OG/sitemap, Core Web Vitals, mesure appels diagnostic / lecteur.
- **Plus tard (Phase C)** : perso + WhatsApp + Décrypteur ; clone verticaux Builders/Finance.

## 8. Tests (cf. règles : 80% min, AAA)

- **Unit (vitest, `api/`)** : validation Zod subscribe/diagnostic, dédup hash, schéma de sortie curate, machine à états review, politiques RLS.
- **E2E (Playwright, `e2e/`)** : `/veille` charge, flux subscribe (double opt-in), CTA diagnostic → lead créé, ArticlePage rend.
- **Éval agents** : golden set, grounding/hallucination, précision classification secteur, 0 doublon publié.

## 9. Risques

| Risque | Niveau | Mitigation |
|---|---|---|
| **Copyright/licence (agrégation)** | **HAUT** | Ne JAMAIS republier le texte intégral. Stocker lien + synthèse originale transformative + attribution. C'est aussi le wedge (la valeur = la synthèse). |
| Hallucination / slop | HAUT | Grounding strict à la source, seuil de confiance, **relecture humaine obligatoire** avant publish, harnais d'éval. |
| Goulot de relecture | MOYEN | Cadence plafonnée ~15-25 items/sem ; auto-publish interdit au lancement. |
| Demande non prouvée (gate A sauté) | MOYEN | Lancer le brief Approche A en parallèle (capture Slice 1) ; suivre appels diagnostic / lecteur. |
| RLS / fuite contenu non publié | MOYEN | `anon SELECT` limité à `status='published'` ; leads via service-role. |
| SEO lent | MOYEN | Ne pas attendre de trafic organique avant des mois ; pousser via email/LinkedIn. |
| WhatsApp quotas (Phase C) | DIFFÉRÉ | opt-in + quotas (risk register ROADMAP). |

## 10. Sécurité (gates projet : edits `api/`/`server.ts`/auth/schema → gemini-security-scan + qwen-security)

- Pas de secret en dur (clés via env, cf. existant).
- Rate-limit sur `/subscribe` et `/diagnostic` (`express-rate-limit` déjà présent).
- Anti-abus capture : honeypot + double opt-in.
- Validation Zod à toutes les frontières.

## 11. Décisions à trancher

1. **Marque & domaine** : sous-domaine `veille.rmk-…` (SEO + spin-out propres) vs `/veille` (rapide). → reco sous-domaine si spin-out sérieux.
2. **Premier secteur** : banque ou agro (celui avec le plus de cas locaux RMK).
3. **Embeddings dédup** : API (simple) vs local (coût). 
4. **Liste de sources** initiale (10-15 flux mondiaux + régionaux : arXiv/blogs labo, presse tech, Ecofin/CIO Mag/We Are Tech en signaux régionaux).
5. **Deliverability email** de masse (Resend domaine vérifié / SPF-DKIM).

## 12. Prochaines étapes (workflow projet)

1. **Review gates obligatoires** (CLAUDE.md) sur ce plan : `plan-eng-review` (schéma + API + RLS = architecture-impacting) **+** `gemini-plan-review` **+** `qwen-plan-review` en parallèle. Synthèse des désaccords avant code.
2. Puis **TDD par slice** (`test-driven-development`), Slice 0 → 1 d'abord.
3. `gstack:ship` → `land-and-deploy` → `canary` (site déjà live).

---

## Revue d'ingénierie — décisions verrouillées (plan-eng-review, 2026-06-24)

Périmètre du premier build réduit à **Slice 1 minimal**.

Verrouillé :
- **2 tables seulement maintenant** : `veille_articles` + `veille_subscribers`. `veille_sources`, `veille_items_raw`, `veille_editions` arrivent avec leurs agents (Slice 2-3).
- **Subscribe = endpoint service-role** `/api/veille/subscribe` (calque `/api/lead/capture`), limiter dédié `veilleLimiter`. PAS d'insert RLS anon (contredit le pattern établi, api/app.ts:91,620-623).
- **Opt-in simple** maintenant ; double opt-in en Slice 3 (envoi automatisé).
- **CTA Diagnostic = réutilise `/api/lead/capture`** avec `source='veille-diagnostic-banque'`. Pas de nouvel endpoint, pas de nouvelle table.
- **RLS** : `veille_articles` anon SELECT `status='published'` uniquement ; `veille_subscribers` admin-only SELECT (pas de moisson d'emails) ; writes via service-role.
- **Route `/veille`** pour Slice 1 (réversible ; sous-domaine = décision spin-out ultérieure).
- **Index** : `veille_articles(status, primary_sector, published_at DESC)`.
- **Types/schémas partagés** : un seul `VeilleArticle` (type + Zod) importé front+back (DRY).
- **Tests** (calque vitest + Playwright existants) : `api/__tests__/veille-subscribe.test.ts`, `api/__tests__/veille-articles.test.ts`, `e2e/veille.spec.ts`.

**Risque ajouté (Slice 2) — injection de prompt via contenu ingéré.** L'agent `curate` lira du contenu de sources tierces et le passera à un LLM : traiter tout contenu ingéré comme non fiable (frontières structurées / échappement, calque `escapeXml` api/app.ts:52). Aussi dans TODOS.md.

### NOT in scope (différé explicitement)
- Agents ingest/dedup/curate/brief — Slice 2-3.
- Tables `veille_sources`, `veille_items_raw`, `veille_editions` — avec leurs agents.
- Double opt-in + envoi automatisé du brief — Slice 3.
- Harnais d'éval agents — Slice 2.
- SEO/sitemap/OG + analytics funnel — Slice 4.
- Personnalisation, WhatsApp, Décrypteur, verticaux Builders/Finance — Phase C.
- Sous-domaine / marque distincte — décision spin-out ultérieure.
- Migration WhatsApp Cloud API ; cron Vercel sub-daily (nécessite plan Pro) — avec les agents.

### What already exists (réutilisé, non reconstruit)
- `/api/lead/capture` (api/app.ts:624) → CTA Diagnostic.
- Pattern écriture publique service-role (api/app.ts:91,620-623) → subscribe.
- Limiters, `requireAuth`/`requireAdmin`, Zod, `sanitizeText`/`escapeXml`, AI gateway, cron Vercel (`/api/cron/linkedin`), vitest + tests de régression.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | strategy covered by the office-hours design doc |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | n/a |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | scope cut to Slice 1; 2 decisions made, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | recommended next (public /veille UI) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | n/a |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED (PLAN) — scope reduced to Slice 1 minimal, ready to implement. Design Review recommended before/with the public UI build.
