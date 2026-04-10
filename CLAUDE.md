# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RMK Seminar Manager — a full-stack SPA for managing AI training seminars (RMK Conseils × CABEXIA, Abidjan, May 2026). Features: public landing page with registration, admin dashboard (CRM, financials, task management), client portal, AI-powered content generation, and multi-channel notifications (email/WhatsApp).

## Commands

```bash
npm run dev      # Start Express + Vite dev server (port 8080)
npm run build    # Production build to /dist
npm run lint     # TypeScript type-check only (tsc --noEmit)
npm run clean    # Remove /dist
npx playwright test                    # Run all E2E tests
npx playwright test e2e/phase4.spec.ts # Run specific test file
```

## Architecture

**Frontend**: React 19 + TypeScript + Vite 6 SPA with React Router v7.
**Backend**: Express.js server (`server.ts`, port 8080) — serves the Vite dev middleware in development and static `/dist` in production. Also hosts API endpoints for AI generation and notifications.
**Database**: Supabase (PostgreSQL). Schema in `supabase_schema.sql`. Client initialized in `src/lib/supabaseClient.ts`.
**Styling**: Tailwind CSS v4 with shadcn/ui (base-nova style). Components live in `components/ui/`.

### Routing (App.tsx)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | LandingPage | Public: seminar catalog, registration form |
| `/admin` | AdminDashboard | Admin: CRM, charts, tasks, expenses, AI tools |
| `/portal` | ClientPortal | Participant: registration lookup, attestation download |

All page components are lazy-loaded.

### Backend API Endpoints (server.ts)

- `POST /api/ai/generate` — Gemini 2.5-flash text generation (email drafts, WhatsApp replies, LinkedIn posts)
- `POST /api/notify-registration` — Send email (Resend) + WhatsApp (Twilio) notifications
- `POST /webhook/prospect` — Cold email generation webhook
- `POST /webhook/whatsapp` — WhatsApp closer AI webhook
- CRON: Daily LinkedIn post generation at 08:00 UTC

### Key Data

`src/data/seminars.ts` is the **single source of truth** for seminar definitions (titles, dates, pricing, capacity, colors). Import from here rather than hardcoding seminar data.

### Path Alias

`@/*` maps to the project root (configured in both `tsconfig.json` and `vite.config.ts`). shadcn/ui components are at `@/components/ui/*`.

### Environment Variables

See `.env.example`. Required: `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Optional: `RESEND_API_KEY`, `TWILIO_*` vars. Variables prefixed `VITE_` are exposed to the client.

### Supabase Tables

- **participants** — seminar registrations (nom, prenom, email, tel, societe, fonction, seminar, amount, status, payment)
- **leads** — CRM prospects
- **tasks** — operational task tracking
- **expenses** — budget tracking

### Key Libraries

- **@google/genai** — Gemini API client (server-side only via Express endpoints)
- **html2canvas + jsPDF** — Client-side PDF/flyer export
- **recharts** — Dashboard charts
- **motion** — Animations
- **date-fns** — Date formatting (French locale used throughout)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
