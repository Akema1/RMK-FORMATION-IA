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

## Tooling

Active plugins: **gstack**, **superpowers-gemini-plugin**, **serena**.
Third-opinion reviewer: **qwen3.6-plus via OpenRouter** (`llm` CLI, already configured).

### Gemini model routing

The superpowers plugin calls `gemini` without `-m`, which means the CLI default (currently **gemini-2.5-pro**) is used for every automated gate (pre-commit, plan-review, etc.). This is intentional: gemini-2.5-pro is GA, has higher quota under OAuth personal, and won't rate-limit on frequent calls.

For deep manual reviews, use **gemini-3-pro-preview** via `.claude/bin/gemini-deep-review`. Don't wire it into automated gates — preview-model quota is small and you'll get flakes.

```bash
.claude/bin/gemini-deep-review              # diff main...HEAD
.claude/bin/gemini-deep-review feat/branch  # diff against a different base
git diff | .claude/bin/gemini-deep-review - # pipe a diff in directly
```

### Code navigation

Activate serena at the start of every session. Use serena's symbolic tools (`find_symbol`, `get_symbols_overview`, `find_referencing_symbols`, `search_for_pattern`) instead of Grep/Glob for TS/TSX source code. Only fall back to Grep/Glob for non-code files (config, SQL, markdown, `.env`).

## Workflow

### Planning (non-trivial changes only)

1. `superpowers-gemini-plugin:brainstorming` — only when intent is unclear or there's a fork decision.
2. `superpowers-gemini-plugin:writing-plans` — author the plan.
3. **Parallel plan review** — MANDATORY after any plan is written:
   - `superpowers-gemini-plugin:gemini-plan-review` (Gemini second opinion)
   - `.claude/bin/qwen-plan-review <plan-path>` (Qwen third opinion)
   - Both run in parallel in one message. Synthesize disagreements before presenting options.
4. `plan-eng-review` (gstack) — only for architecture-impacting changes (schema, auth, API surface, infra).

Skip planning entirely for mechanical fixes (typos, config flips, single-file tweaks).

### Implementation

- **TDD**: `superpowers-gemini-plugin:test-driven-development` for any feature or non-trivial bugfix.
- **Debugging**: start with `gstack:investigate` (4-phase, root-cause). If stuck after 3+ hypotheses, run Gemini + Qwen debug consults in parallel:
  - `superpowers-gemini-plugin:gemini-debug-consult`
  - `.claude/bin/qwen-debug <context-file>`
- **Parallelism**: 2+ independent tasks → `dispatching-parallel-agents` + `using-git-worktrees`.

### Review gates — qwen is MANDATORY at every gemini review point

Every time the superpowers plugin invokes Gemini for a review, run Qwen in parallel on the same input. Both reviewers run in a single message (two parallel tool calls). Do not act on the diff until both have responded.

| Gate | Gemini | Qwen (mandatory parallel) | Trigger |
|---|---|---|---|
| Pre-commit | `gemini-pre-commit-review` | `.claude/bin/qwen-pre-commit` | Every commit (auto) |
| Code review | `gemini-code-review` | `.claude/bin/qwen-review` | >100 LOC diff, or on request |
| Security scan | `gemini-security-scan` | `.claude/bin/qwen-security` | Edits to `api/`, `server.ts`, auth, schema |
| Plan review | `gemini-plan-review` | `.claude/bin/qwen-plan-review` | After `writing-plans` |
| Debug consult | `gemini-debug-consult` | `.claude/bin/qwen-debug` | Stuck 3+ hypotheses |
| Test critique | `gemini-test-critique` | `.claude/bin/qwen-test-critique` | After test file edits |
| Design review | `gemini-design-review` | `.claude/bin/qwen-design-review` | After brainstorming |

### Presenting parallel reviews — synthesis mode

After running Gemini + Qwen in parallel, **do not dump both outputs verbatim**. Synthesize:

1. **Agreements** — one sentence: "Both flag X."
2. **Disagreements** — name each reviewer, summarize their position, state which one I find more credible and why (cite the code).
3. **My recommendation** — one paragraph. What I think matters, what I'd act on, what I'd override.
4. Then wait for the user's decision.

Raw reviewer outputs go in collapsed blocks only if the user asks to see them.

### Verification (before claiming done)

- `superpowers-gemini-plugin:verification-before-completion` — run commands, confirm output, cite evidence. No success claims without running the verification command.
- For UI work: actually open the browser via `gstack:browse` or the Playwright MCP. Lint passing ≠ feature working.

### Branch workflow

All work follows this merge order: `dev_<name>` → `Improvements` → `main`.

- PRs from personal dev branches must target **`Improvements`**, never `main` directly.
- `Improvements` is the integration branch; it gets merged to `main` after validation.

### Ship

```
gstack:ship → gstack:land-and-deploy → gstack:canary
```

`canary` diffs console errors + Core Web Vitals against a pre-deploy baseline. Always run it after landing on `main` since this project is already live on Vercel.

### Periodic

- **Weekly**: `gstack:retro` + `gstack:health`.
- **Quarterly / pre-major-release**: `gstack:cso` (infra + supply-chain + STRIDE audit).

### Tool-selection tiebreakers

| Role | Primary | Do NOT use |
|---|---|---|
| Code review (pre-landing) | `gstack:review` + `gemini-code-review` + `qwen-review` | — |
| Security scan (per-change) | `gemini-security-scan` + `qwen-security` | `cso` (too broad) |
| Security audit (periodic) | `gstack:cso` | `gemini-security-scan` (too narrow) |
| Debugging (start) | `gstack:investigate` | `systematic-debugging` alone |
| Debugging (stuck) | `gemini-debug-consult` + `qwen-debug` | — |
| Visual review | `gstack:design-review` | `gemini-design-review` |
| API-surface review | `gemini-design-review` + `qwen-design-review` | `gstack:design-review` |
| Planning author | `superpowers:writing-plans` | `gstack:autoplan` (heavier) |
| Plan review (arch) | `gemini-plan-review` + `qwen-plan-review` + `plan-eng-review` | — |

### Safety defaults

- Touching prod DB, force-push, or destructive ops → `gstack:guard` mode first.
- Scoped refactors → `gstack:freeze <dir>` to prevent drift.
- Long sessions → `gstack:checkpoint` before context compression.

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
