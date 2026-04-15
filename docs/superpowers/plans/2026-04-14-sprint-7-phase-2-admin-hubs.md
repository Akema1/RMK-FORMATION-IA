# Sprint 7 Phase 2 — Admin Hubs Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-gemini-plugin:subagent-driven-development (recommended) or superpowers-gemini-plugin:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the upstream admin UI restructure onto `integrate/upstream-sprint-7` — collapse the 12-tab admin into an 8-tab hub layout, replace global `BudgetConfig`/`Prices` with per-seminar configuration, wire the new `ContentStudio` and `AgentHub` groupings, resolve the Phase 1 ChatWidget tripwire, and fix the rate-limiter test-isolation fragility — without reintroducing security regressions that main's hardening pass removed.

**Architecture:** Phase 2 ports upstream source files and adapts them to our hardened server contract. The touchpoints are: (a) top-level shell (`AdminDashboard.tsx`, `Nav.tsx`), (b) two new grouping components (`ContentStudio`, `AgentHub`) that wrap existing and ported-upstream pages, (c) content-studio pages (`BrochurePage`, `brochurePdf`, `CertificatePage`, `InvitationPage`), (d) a rewritten `FinancePage` / `SeminarsManagement` pair that moves budget and pricing from singleton settings to per-seminar configs stored in `settings.seminar_budgets` and `settings.seminar_pricing`, (e) a ported `WebProspectionPage` that calls a new server-side `prospection` template instead of the upstream `callGemini` helper, (f) deletion of `src/admin/PricesPage.tsx`, and (g) a test-isolation fix for the AI rate limiter. All ports preserve main's security invariants: the `placeholder.supabase.co` login bypass stays removed, every admin fetcher keeps `ADMIN_FETCH_LIMIT`, and no raw client-supplied system prompts reach the LLM.

**Tech Stack:** React 19 + TypeScript 5, Vite 6, React Router v7, Supabase JS v2, Express 4, Zod, express-rate-limit, Vitest + supertest, Vercel AI Gateway (Claude Haiku).

---

## Pre-flight — Read Before Starting Any Task

- **Target branch:** `integrate/upstream-sprint-7`, currently at commit `33d1b44` (13 commits ahead of main).
- **Target database:** Supabase branch DB `onpsghadqnpwsigzqzer` (not production).
- **Upstream source of truth for ports:** `upstream/main` remote (https://github.com/donzigre/RMK-FORMATION-IA). Fetch with `git fetch upstream` before any task that reads upstream files.
- **Never use `--no-verify`.** Qwen + Gemini pre-commit hooks must pass on every commit.
- **Never run `git push --force`.** If a push is blocked, fix the real finding rather than bypassing.
- **Never reintroduce the `placeholder.supabase.co` dev-login bypass.** Upstream `AdminDashboard.tsx` lines 118-123 contain it. The port in Task 12 explicitly strips it.
- **Never remove `ADMIN_FETCH_LIMIT`.** Upstream has unbounded `.select('*')` calls; we keep the 500-row cap on every fetcher.

---

## File Structure

**Files to CREATE** (copied from `upstream/main` then adapted):

| Path | Responsibility |
|---|---|
| `src/admin/ContentStudio.tsx` | Wraps Brochure/Flyer/Certificates/Invitations in a tabbed panel |
| `src/admin/AgentHub.tsx` | Wraps Leads/Commercial/SEO/Prospection/Research in a tabbed panel |
| `src/admin/BrochurePage.tsx` | Brochure PDF builder UI |
| `src/admin/brochurePdf.ts` | Pure PDF generation helpers for brochures |
| `src/admin/CertificatePage.tsx` | Per-participant attestation generator |
| `src/admin/InvitationPage.tsx` | Invitation card generator |
| `src/admin/WebProspectionPage.tsx` | AI prospection UI (calls `callAI('prospection', ...)`) |
| `src/admin/AdminAssistant.tsx` | Admin-side assistant panel (upstream pattern; optional Phase 2 scope — see Task 7) |

**Files to MODIFY:**

| Path | Change |
|---|---|
| `api/prompts.ts` | Add `"prospection"` to `TemplateId` + `PROMPT_TEMPLATES`; add case in `renderSystemPrompt` with optional `seminarsContext` catalog grounding |
| `api/app.ts` | Extend `aiGenerateSchema` so `templateId="prospection"` accepts `{ sector, zone, need, seminarsContext? }` vars; accept `"prospection"` in server switch for `/api/ai/generate` |
| `api/__tests__/chat.test.ts` | Rate-limit describe block: `beforeAll` → `beforeEach` |
| `src/admin/Nav.tsx` | Replace 12-tab array with 8-tab array (remove leads/prices/agent/seo/flyer/research; add contenus/agents) |
| `src/admin/DashboardPage.tsx` | Add `seminarBudgets` prop + two new KPI tiles (Budget Charges, Marge Prev.) |
| `src/admin/FinancePage.tsx` | Rewrite: replace singleton `budgetConfig` with per-seminar `seminarBudgets`; expose `seminarBudgets`/`setSeminarBudgets` props |
| `src/admin/SeminarsManagement.tsx` | Absorb `PricesPage`: add `prices`/`setPrices`/`seminarPricing`/`setSeminarPricing` props and render per-seminar pricing rows |
| `src/pages/AdminDashboard.tsx` | Drop `BudgetConfig` state + settings fetch; add `seminarBudgets`/`seminarPricing` state + two new settings fetches; drop imports for `LeadsPage`/`PricesPage`/`AgentPage`/`SeoAgentPage`/`FlyerPage`/`ResearchPage`; add imports for `ContentStudio`/`AgentHub`; update page-map JSX; preserve `ADMIN_FETCH_LIMIT` and the anti-bypass comment |
| `src/admin/index.ts` | Export new components; drop `PricesPage` export |

**Files to DELETE:**

| Path | Reason |
|---|---|
| `src/admin/PricesPage.tsx` | Functionality absorbed into the rewritten `SeminarsManagement.tsx` |

**Files NOT touched in Phase 2** (deliberately):

- `src/components/ChatWidget.tsx` — the Phase 1 public-client-only version stays. No `mode="admin"` reintroduction. See Task 12 for the explicit decision.
- `src/admin/callAI.ts` — Phase 1 contract stands; Task 3 adds `"prospection"` to the `TemplateId` union there too.
- `src/admin/AgentPage.tsx`, `SeoAgentPage.tsx`, `ResearchPage.tsx`, `LeadsPage.tsx`, `FlyerPage.tsx` — already ported to `callAI`; Phase 2 just re-parents them under `AgentHub` / `ContentStudio`.
- `src/admin/types.ts` / `src/admin/config.ts` — Phase 1 already added `SeminarBudgetConfigs`, `SeminarPricingConfigs`, `DEFAULT_BUDGET_CONFIG`, `DEFAULT_SEMINAR_PRICING`. Task 1 verifies this and bails if anything is missing.

---

## Task 1 — Preflight verification (no code changes)

Establishes that Phase 1 foundation is actually present before the port starts. This is the "cheap fail-fast" gate. A subagent executing this task must **STOP and report `BLOCKED`** if any check fails.

**Files:** none (read-only).

- [ ] **Step 1: Confirm branch and clean tree**

Run: `git rev-parse --abbrev-ref HEAD && git status --short`
Expected: `integrate/upstream-sprint-7` and no modified/untracked files.

- [ ] **Step 2: Confirm Phase 1 types exist**

Run: `grep -nE "SeminarBudgetConfigs|SeminarPricingConfigs" src/admin/types.ts`
Expected: both symbols are exported (you should see lines around 81 and 105).

- [ ] **Step 3: Confirm Phase 1 defaults exist**

Run: `grep -nE "DEFAULT_BUDGET_CONFIG|DEFAULT_SEMINAR_PRICING" src/admin/config.ts`
Expected: both identifiers defined.

- [ ] **Step 4: Confirm ChatWidget is public-client-only (Phase 1 tripwire is still set)**

Run: `grep -n "mode" src/components/ChatWidget.tsx | head -5`
Expected: zero matches of `mode:` or `mode ?:` or `ChatWidgetProps` containing `mode`. If any `mode` prop exists, the tripwire was already disarmed — stop and surface this.

- [ ] **Step 5: Fetch upstream**

Run: `git fetch upstream main`
Expected: success. Subsequent tasks will `git show upstream/main:<path>` to read source files.

- [ ] **Step 6: No commit**

This task creates no changes. Do not commit.

---

## Task 2 — Fix rate-limiter test isolation (Qwen finding #1)

**Files:**
- Modify: `api/__tests__/chat.test.ts:150-184`

**Why:** `aiLimiter` is scoped to each `createApp()` instance (not module-scoped, contrary to the initial Qwen report — see `api/app.ts:209`), so each test that builds its own app gets its own counter. The real fragility is inside the `describe("POST /api/ai/chat rate limit")` block: it uses `beforeAll` to build `freshApp` once, then runs 21 requests in a single `it`. That passes today because only one test exists. The moment someone adds a second test to that `describe`, the first test's 20-request burst bleeds into the second test's window and produces phantom 429s. Fix: `beforeAll` → `beforeEach` so every test in that block gets a fresh limiter store.

- [ ] **Step 1: Add a failing second test that proves the leak**

Edit `api/__tests__/chat.test.ts`. Inside `describe("POST /api/ai/chat rate limit", ...)`, **after** the existing `it("returns 429 after the 20th request in one window", ...)`, add:

```ts
  it("starts fresh per test — first request returns 200, not 429", async () => {
    const res = await request(freshApp)
      .post("/api/ai/chat")
      .set("X-Forwarded-For", "203.0.113.42")
      .send(payload);
    expect(res.status).toBe(200);
  });
```

- [ ] **Step 2: Run to confirm the new test fails under `beforeAll`**

Run: `npx vitest run api/__tests__/chat.test.ts -t "starts fresh"`
Expected: FAIL. The counter from the previous test (21 requests) is still in the in-memory store, so request #22 on the same `freshApp` is 429, not 200. This is the bug.

- [ ] **Step 3: Apply the fix — `beforeAll` → `beforeEach`**

Replace:

```ts
  let freshApp: Express;
  beforeAll(() => {
    freshApp = createApp({ gracefulDegradation: true });
  });
```

with:

```ts
  let freshApp: Express;
  beforeEach(() => {
    freshApp = createApp({ gracefulDegradation: true });
  });
```

Make sure `beforeEach` is imported from `vitest` at the top of the file (the existing imports already include it if other describes use `beforeEach`; if not, add it: `import { describe, it, expect, beforeEach } from "vitest";` — keep any existing imports on that line).

- [ ] **Step 4: Run both tests to confirm the fix**

Run: `npx vitest run api/__tests__/chat.test.ts`
Expected: PASS on both rate-limit tests (the "returns 429 after the 20th request" test still passes because each test gets its own fresh limiter, and the new test returns 200 on its fresh instance).

- [ ] **Step 5: Commit**

```bash
git add api/__tests__/chat.test.ts
git commit -m "test(api): isolate aiLimiter state per test via beforeEach

Qwen Phase 1 finding #1: the rate-limit describe block built freshApp
once in beforeAll, so counter state from test 1 bled into test 2. Today
only one test exists so the bug is latent; added a second test that
asserts a fresh limiter starts at 0 requests, and flipped beforeAll to
beforeEach to guarantee isolation."
```

---

## Task 3 — Server-side `prospection` template

**Files:**
- Modify: `api/prompts.ts` (add `"prospection"` to `TemplateId` union, `PROMPT_TEMPLATES` array, and `renderSystemPrompt` switch)
- Modify: `api/app.ts` (extend `aiGenerateSchema` so `vars` for `prospection` accepts `{ sector: string, zone: string, need: string }`; add the commercial-style vars branch in the `/api/ai/generate` handler if needed)
- Modify: `src/admin/callAI.ts` (add `"prospection"` to the client-side `TemplateId` type)
- Test: `api/__tests__/prospection.test.ts` (new)

**Why:** Upstream `WebProspectionPage.tsx` calls `callGemini(systemPrompt, userPrompt, seminars, true)` — a raw client-supplied system prompt plus a JSON-mode flag. Our hardened server refuses raw system prompts: every call must pick a `templateId` that maps to a server-owned prompt. So the UI port (Task 8) is blocked until `prospection` exists as a server-owned template. The template is also the right place to enforce the "return JSON array of 8–12 prospects" contract.

**Quality gate (Qwen plan review #2):** Upstream passed the `seminars` array to `callGemini` specifically so the LLM could ground prospect suggestions in what RMK actually sells (codes, titles, weeks, seats, colors). The `prospection` template accepts an **optional** `seminarsContext` var carrying a compact projection of that catalog (`{ code, title, week }[]`). When present, the rendered system prompt inlines it as a catalog block; when absent, the prompt degrades gracefully. Passing the full `Seminar[]` shape would leak pricing internals — the projection is the minimum needed for grounding.

- [ ] **Step 1: Write the failing server test**

Create `api/__tests__/prospection.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../app.js";

describe("POST /api/ai/generate templateId=prospection", () => {
  let app: Express;
  beforeEach(() => {
    app = createApp({ gracefulDegradation: true });
  });

  it("rejects missing vars with 400", async () => {
    const res = await request(app)
      .post("/api/ai/generate")
      .set("Authorization", "Bearer dev")
      .send({ templateId: "prospection", vars: {} });
    expect(res.status).toBe(400);
  });

  it("accepts well-formed prospection vars", async () => {
    const res = await request(app)
      .post("/api/ai/generate")
      .set("Authorization", "Bearer dev")
      .send({
        templateId: "prospection",
        vars: { sector: "Banque", zone: "Abidjan", need: "Formation IA décideurs" },
      });
    // In gracefulDegradation, requireAuth passes on "Bearer dev" and the LLM
    // call is stubbed. We only care that the schema accepts the payload.
    expect([200, 401, 403, 500]).toContain(res.status);
    expect(res.status).not.toBe(400);
  });

  it("accepts optional seminarsContext projection", async () => {
    const res = await request(app)
      .post("/api/ai/generate")
      .set("Authorization", "Bearer dev")
      .send({
        templateId: "prospection",
        vars: {
          sector: "Banque",
          zone: "Abidjan",
          need: "Formation IA décideurs",
          seminarsContext: [
            { code: "S1", title: "IA Stratégique", week: "Sem 1 — Mai 2026" },
            { code: "S2", title: "IA Opérationnelle", week: "Sem 2 — Mai 2026" },
          ],
        },
      });
    expect(res.status).not.toBe(400);
  });

  it("rejects unknown templateId with 400", async () => {
    const res = await request(app)
      .post("/api/ai/generate")
      .set("Authorization", "Bearer dev")
      .send({ templateId: "not-a-real-template", vars: {} });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run api/__tests__/prospection.test.ts`
Expected: FAIL on the "accepts well-formed prospection vars" case (schema rejects `prospection` as not in the enum).

- [ ] **Step 3: Add `prospection` to the `TemplateId` union and list in `api/prompts.ts`**

Locate in `api/prompts.ts`:

```ts
export type TemplateId = "seo" | "commercial" | "research" | "chat";
```

Replace with:

```ts
export type TemplateId = "seo" | "commercial" | "research" | "chat" | "prospection";
```

Locate the `PROMPT_TEMPLATES` array (around line 166):

```ts
export const PROMPT_TEMPLATES: TemplateId[] = [
  "seo",
  "commercial",
  "research",
  "chat",
] as const;
```

Replace with:

```ts
export const PROMPT_TEMPLATES: TemplateId[] = [
  "seo",
  "commercial",
  "research",
  "chat",
  "prospection",
] as const;
```

- [ ] **Step 4: Add the `prospection` case in `renderSystemPrompt`**

In `api/prompts.ts`, inside `renderSystemPrompt`'s `switch (templateId)` block, **before** the `default`, add:

```ts
    case "prospection": {
      const sector = typeof vars?.sector === "string" ? vars.sector.slice(0, 200) : "";
      const zone = typeof vars?.zone === "string" ? vars.zone.slice(0, 200) : "";
      const need = typeof vars?.need === "string" ? vars.need.slice(0, 500) : "";
      if (!sector || !zone || !need) {
        throw new Error(
          "prospection template requires vars.sector, vars.zone, vars.need"
        );
      }

      // Optional seminars catalog projection — grounds the LLM in what RMK
      // actually sells. Accepts { code, title, week }[]; silently drops
      // anything that doesn't match the shape. Cap at 20 entries so the
      // prompt stays tight even if a caller forgets to slice.
      type SeminarCtx = { code: string; title: string; week: string };
      const rawCtx = Array.isArray(vars?.seminarsContext) ? vars.seminarsContext : [];
      const seminarsCtx: SeminarCtx[] = rawCtx
        .filter(
          (s): s is SeminarCtx =>
            !!s &&
            typeof (s as SeminarCtx).code === "string" &&
            typeof (s as SeminarCtx).title === "string" &&
            typeof (s as SeminarCtx).week === "string"
        )
        .slice(0, 20);

      const catalogBlock =
        seminarsCtx.length > 0
          ? `\n\nCatalogue RMK (ce que tu dois vendre — utilise ces titres mot-pour-mot dans tes messages d'approche) :\n${seminarsCtx
              .map((s) => `- [${s.code}] ${s.title} (${s.week})`)
              .join("\n")}`
          : "";

      return `Tu es un analyste commercial B2B pour RMK Conseils (Abidjan). Ta mission : identifier des prospects ENTREPRISES réels pour nos séminaires de formation IA.

Contexte : sector="${sector}" | zone="${zone}" | besoin="${need}"${catalogBlock}

Retourne UNIQUEMENT un tableau JSON (rien d'autre — pas de markdown, pas de commentaire), format strict :

[
  {
    "nom": "Nom réel de l'entreprise",
    "secteur": "Sous-secteur précis",
    "taille": "TPE / PME / Grande",
    "besoin": "Besoin identifié en IA (1-2 phrases)",
    "decideur": "Titre du profil décideur à contacter",
    "score": "Elevee / Moyenne / Faible",
    "message": "Message d'approche personnalisé (2-3 phrases, cite le séminaire RMK le plus pertinent si catalogue fourni)"
  }
]

Fournis entre 8 et 12 prospects. Utilise des entreprises RÉELLES du contexte. Réponds en français.`;
    }
```

- [ ] **Step 5: Extend the Zod schema in `api/app.ts`**

Locate `aiGenerateSchema` in `api/app.ts` (around line 88). It currently accepts any `templateId` in the enum but discriminates `vars` shape per template via inline checks in the handler. Confirm the schema uses `.passthrough()` or `z.record(z.unknown())` for `vars` — if so, no schema change is needed, the `renderSystemPrompt` throw will surface as a 500 which we turn into a 400.

Actually, to match the "400 on bad vars" contract the test expects, add an explicit discriminated branch. Replace `aiGenerateSchema` with:

```ts
const aiGenerateSchema = z.object({
  templateId: z.enum(PROMPT_TEMPLATES as readonly [TemplateId, ...TemplateId[]]),
  vars: z.record(z.unknown()).optional(),
  userPrompt: z.string().max(5000).optional(),
  messages: z
    .array(
      z.object({
        role: z.string(),
        text: z.string().max(5000).optional(),
        parts: z.array(z.unknown()).max(20).optional(),
      })
    )
    .max(20)
    .optional(),
}).refine(
  (v) => {
    if (v.templateId !== "prospection") return true;
    const vars = v.vars ?? {};
    return (
      typeof vars.sector === "string" &&
      typeof vars.zone === "string" &&
      typeof vars.need === "string" &&
      vars.sector.length > 0 &&
      vars.zone.length > 0 &&
      vars.need.length > 0
    );
  },
  { message: "prospection template requires vars.sector, vars.zone, vars.need", path: ["vars"] }
).refine(
  (v) => {
    // Optional seminarsContext: if present, must be an array of objects with
    // string code/title/week. Silently accepted at schema level; the template
    // renderer enforces the shape again and caps at 20 entries.
    if (v.templateId !== "prospection") return true;
    const ctx = v.vars?.seminarsContext;
    if (ctx === undefined) return true;
    if (!Array.isArray(ctx)) return false;
    return ctx.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).code === "string" &&
        typeof (s as Record<string, unknown>).title === "string" &&
        typeof (s as Record<string, unknown>).week === "string"
    );
  },
  { message: "prospection seminarsContext must be Array<{code,title,week}>", path: ["vars", "seminarsContext"] }
);
```

Keep any existing `.refine` or field-level validation that was already there; add the `prospection` refine in addition to them.

- [ ] **Step 6: Run the prospection test to confirm it passes**

Run: `npx vitest run api/__tests__/prospection.test.ts`
Expected: PASS on all three cases.

- [ ] **Step 7: Run full API test suite to confirm no regression**

Run: `npm run test 2>/dev/null || npx vitest run api/`
Expected: all tests pass.

- [ ] **Step 8: Add `"prospection"` to the client `TemplateId`**

Edit `src/admin/callAI.ts`:

```ts
export type TemplateId = 'seo' | 'commercial' | 'research';
```

Replace with:

```ts
export type TemplateId = 'seo' | 'commercial' | 'research' | 'prospection';
```

- [ ] **Step 9: Run typecheck**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add api/prompts.ts api/app.ts api/__tests__/prospection.test.ts src/admin/callAI.ts
git commit -m "feat(api): add template-locked prospection prompt for WebProspectionPage

Phase 2 prerequisite: upstream WebProspectionPage called callGemini with
a raw client-supplied system prompt + JSON-mode flag. Our hardened server
refuses raw prompts, so the prospection prompt now lives on the server
as templateId='prospection' with strict sector/zone/need vars.

Server enforces the JSON-only contract in the prompt and validates vars
via Zod. Client callAI type union extended so callers can pick it."
```

---

## Task 4 — Port Nav.tsx (12 tabs → 8 tabs)

**Files:**
- Modify: `src/admin/Nav.tsx` (full replacement of tab array)

**Why:** Nav drives which pages are reachable in the shell. Trimming it first gives the rest of Phase 2 a clear visual confirmation that the restructure landed, and it's effectively independent of the heavier ports.

- [ ] **Step 1: Replace lucide imports and tab array**

Find the import line `import { LayoutDashboard, GraduationCap, ClipboardList, Target, Wallet, CheckSquare, Tag, Bot, Search, FileImage, CalendarCheck, type LucideIcon } from 'lucide-react';` and replace with:

```ts
import { LayoutDashboard, GraduationCap, ClipboardList, Wallet, CheckSquare, CalendarCheck, Palette, Bot, type LucideIcon } from 'lucide-react';
```

Find the `tabs` array and replace with exactly:

```ts
const tabs: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "seminaires", label: "Séminaires", Icon: GraduationCap },
  { key: "inscriptions", label: "Inscriptions", Icon: ClipboardList },
  { key: "finance", label: "Finance", Icon: Wallet },
  { key: "tasks", label: "Tâches", Icon: CheckSquare },
  { key: "formation", label: "Suivi Formation", Icon: CalendarCheck },
  { key: "contenus", label: "Contenus", Icon: Palette },
  { key: "agents", label: "Agents & Prospection", Icon: Bot },
];
```

Leave the `Nav` component body (the JSX) unchanged.

- [ ] **Step 2: Typecheck**

Run: `npm run lint`
Expected: passes. (No dependent file consumes the `leads`/`prices`/`agent`/`seo`/`flyer`/`research` keys from `Nav` — they are only read inside `AdminDashboard.tsx`'s page map, which gets rewritten in Task 12.)

If `npm run lint` fails with errors about the page map in `AdminDashboard.tsx`: **that's expected** — the old tab keys no longer render anything, but the old imports are still valid. The errors will be resolved in Task 12. If lint fails for any other reason, stop and investigate.

- [ ] **Step 3: Commit**

```bash
git add src/admin/Nav.tsx
git commit -m "feat(admin): port Nav.tsx to 8-tab hub layout

Removes leads, prices, agent, seo, flyer, research tabs. Adds contenus
and agents tabs (grouped pages — see ContentStudio and AgentHub in
upcoming tasks). Matches upstream main."
```

---

## Task 5 — Port DashboardPage.tsx (add seminarBudgets prop + budget tiles)

**Files:**
- Modify: `src/admin/DashboardPage.tsx`

**Why:** The refactored dashboard surfaces two new KPIs — "Budget Charges" (sum of per-seminar planned charges) and "Marge Prev." (revenues minus charges). Both derive from `seminarBudgets`, which `AdminDashboard.tsx` will pass down in Task 12. This task prepares the consumer.

- [ ] **Step 1: Replace the file with the upstream version**

Reference: `git show upstream/main:src/admin/DashboardPage.tsx`. The target file has 82 lines and the diff from ours is ~10 lines (imports + prop + two new tile entries + budget calc). Copy the upstream file verbatim:

```bash
git show upstream/main:src/admin/DashboardPage.tsx > src/admin/DashboardPage.tsx
```

- [ ] **Step 2: Verify the diff is exactly the expected shape**

Run: `git diff src/admin/DashboardPage.tsx`
Expected: only these changes (any additional diff is suspicious):
- Import line gains `DEFAULT_BUDGET_CONFIG` from `./config`.
- Type import gains `SeminarBudgetConfigs, BudgetConfig` from `./types`.
- `DashboardPageProps` gains `seminarBudgets: SeminarBudgetConfigs;`.
- Function signature destructures `seminarBudgets`.
- New `totalBudgetCharges` and `margePrevisionnelle` computations after the existing totals.
- Two new entries in the KPI tile array: `"Budget Charges"` and `"Marge Prev."`.

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: errors in `src/pages/AdminDashboard.tsx` because it still passes `DashboardPage` without the new `seminarBudgets` prop. This is expected — Task 12 fixes it. Confirm the errors are only about the missing prop in `AdminDashboard.tsx`; any other error means a bad port.

- [ ] **Step 4: Commit**

```bash
git add src/admin/DashboardPage.tsx
git commit -m "feat(admin): port DashboardPage.tsx with per-seminar budget tiles

Adds seminarBudgets prop and two new KPI tiles (Budget Charges, Marge
Prev.) computed from the sum of planned charges across seminars.
AdminDashboard will wire the prop in a later task; typecheck is
intentionally broken between this commit and that one."
```

---

## Task 6 — Port content-studio leaf pages (Brochure, brochurePdf, Certificate, Invitation)

**Files:**
- Create: `src/admin/BrochurePage.tsx` (168 lines from upstream)
- Create: `src/admin/brochurePdf.ts` (765 lines from upstream — pure helpers)
- Create: `src/admin/CertificatePage.tsx` (234 lines from upstream)
- Create: `src/admin/InvitationPage.tsx` (151 lines from upstream)

**Why:** These are the leaves of `ContentStudio`. None of them exist in our tree today. They're self-contained — no cross-file type changes required — so Task 6 is four mechanical copies followed by typecheck and a single commit.

- [ ] **Step 1: Copy `brochurePdf.ts` first (helpers before consumer)**

```bash
git show upstream/main:src/admin/brochurePdf.ts > src/admin/brochurePdf.ts
```

- [ ] **Step 2: Copy `BrochurePage.tsx`**

```bash
git show upstream/main:src/admin/BrochurePage.tsx > src/admin/BrochurePage.tsx
```

- [ ] **Step 3: Copy `CertificatePage.tsx`**

```bash
git show upstream/main:src/admin/CertificatePage.tsx > src/admin/CertificatePage.tsx
```

- [ ] **Step 4: Copy `InvitationPage.tsx`**

```bash
git show upstream/main:src/admin/InvitationPage.tsx > src/admin/InvitationPage.tsx
```

- [ ] **Step 5: Typecheck and apply adaptation fixes**

Run: `npm run lint`

Expected adaptations (apply only those that actually error):

| Symptom | Fix |
|---|---|
| `Cannot find module './callGemini'` in any of these files | Replace import with `import { callAI } from './callAI';` and the call site with `callAI('research', { userPrompt })` or `callAI('commercial', { ... })` depending on context. Ask yourself what the prompt is actually doing. For pure PDF/canvas pages (BrochurePage, CertificatePage, InvitationPage), this import likely does not exist — double-check. |
| `Cannot find name 'jsPDF'` / `'html2canvas'` | Both are already in our `package.json` (see main CLAUDE.md). Verify with `grep -E "jspdf\|html2canvas" package.json`. If missing, install with `npm i jspdf html2canvas`. Commit the package changes separately in Step 7 below. |
| Missing type imports | Add to the import line from `./types`. |
| French strings with special characters that got mangled | Upstream uses plain ASCII transliterations (`Creez` not `Créez`). Keep them as-is; no retrofitting. |

Re-run `npm run lint` until clean **for these four files** (errors elsewhere in the tree from earlier tasks are still allowed — they resolve in Task 12).

- [ ] **Step 6: Smoke-import each new file**

Open a scratch file `/tmp/phase2-smoke.ts` (or inline in your editor) and confirm each file exports the expected symbol:

```ts
import { BrochurePage } from "./src/admin/BrochurePage";
import { CertificatePage } from "./src/admin/CertificatePage";
import { InvitationPage } from "./src/admin/InvitationPage";
import * as pdf from "./src/admin/brochurePdf";
```

Run `npx tsc --noEmit /tmp/phase2-smoke.ts` from the repo root. Expected: no errors about missing exports (module-resolution errors from the path are fine — we just want to confirm exports exist). Delete the scratch file afterward.

- [ ] **Step 7: Commit**

```bash
git add src/admin/BrochurePage.tsx src/admin/brochurePdf.ts src/admin/CertificatePage.tsx src/admin/InvitationPage.tsx
# If package.json changed from Step 5:
git add package.json package-lock.json 2>/dev/null || true
git commit -m "feat(admin): port content-studio leaf pages from upstream

Adds BrochurePage, brochurePdf helpers, CertificatePage, InvitationPage.
These are standalone — no cross-file type changes. ContentStudio wires
them in the next task."
```

---

## Task 7 — Port ContentStudio.tsx + (optional) AdminAssistant.tsx

**Files:**
- Create: `src/admin/ContentStudio.tsx` (61 lines)
- Create (optional): `src/admin/AdminAssistant.tsx` — **see Step 1 before deciding**

**Why:** `ContentStudio` is a thin tabbed wrapper over the four leaf pages from Task 6 plus our existing `FlyerPage`. It's mechanical.

`AdminAssistant.tsx` was listed in the Phase 2 scope in PR #3, but: (a) it's only wired in upstream `AdminDashboard.tsx` as the admin-side chat surface, (b) our Phase 1 tripwire deliberately drops the `ChatWidget mode="admin"` mount, and (c) the authed admin chat is explicitly deferred in Task 12. So `AdminAssistant.tsx` has **no caller** in Phase 2's final AdminDashboard. **Decision: skip it.** Step 1 verifies upstream doesn't wire it anywhere else we'd miss.

- [ ] **Step 1: Confirm `AdminAssistant` is only used by the admin chat surface**

Run: `git show upstream/main -- src/ | grep -l "AdminAssistant" 2>/dev/null`
Or more directly: `git grep -l "AdminAssistant" upstream/main`
Expected: zero files, or only `src/admin/AdminAssistant.tsx` itself. If any other file imports it, stop and surface — the plan needs to be revised.

If the check passes, skip the `AdminAssistant.tsx` creation.

- [ ] **Step 2: Copy `ContentStudio.tsx`**

```bash
git show upstream/main:src/admin/ContentStudio.tsx > src/admin/ContentStudio.tsx
```

- [ ] **Step 3: Verify imports resolve**

The upstream file imports `BrochurePage`, `FlyerPage`, `CertificatePage`, `InvitationPage` and types `Seminar`, `Participant`. All exist. Run:

```bash
npm run lint 2>&1 | grep -A1 ContentStudio
```

Expected: no errors attributed to `ContentStudio.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/admin/ContentStudio.tsx
git commit -m "feat(admin): port ContentStudio.tsx grouping component

Tabs over Brochure/Flyer/Certificates/Invitations. AdminAssistant
intentionally omitted — no caller in Phase 2 (admin ChatWidget mount
is deferred; see Task 12 decision)."
```

---

## Task 8 — Port WebProspectionPage.tsx (callGemini → callAI('prospection', ...))

**Files:**
- Create: `src/admin/WebProspectionPage.tsx` (adapted from 205-line upstream)

**Why:** Upstream posts `callGemini(systemPrompt, userPrompt, seminars, true)` — which we blocked during main's hardening. Task 3 added the server-side `prospection` template so the port now has a legal channel. The UI adaptation is: drop the client-side `systemPrompt` variable entirely, keep the form state for `sector`/`zone`/`need`, and call `callAI('prospection', { vars: { sector, zone, need } })`. The response shape is unchanged (JSON array of prospects), and the existing parse logic stays.

- [ ] **Step 1: Copy upstream then immediately patch the AI call**

```bash
git show upstream/main:src/admin/WebProspectionPage.tsx > src/admin/WebProspectionPage.tsx
```

- [ ] **Step 2: Replace the `callGemini` import and call**

Open `src/admin/WebProspectionPage.tsx`. Find:

```ts
import { callGemini } from './callGemini';
```

Replace with:

```ts
import { callAI } from './callAI';
```

Then find the `runProspection` function body — it will contain a multi-line `const systemPrompt = \`...\``.assignment followed by `const userPrompt = ...;` and `const res = await callGemini(systemPrompt, userPrompt, seminars, true);`. Replace that entire block (from the start of `const systemPrompt` through the `callGemini` call) with:

```ts
    try {
      // Qwen plan-review fix: upstream passed the `seminars` array to the
      // LLM for grounding. We project it to {code,title,week}[] so the
      // template can cite RMK catalog entries in prospect messages without
      // leaking pricing internals.
      const seminarsContext = seminars.map((sem) => ({
        code: sem.code,
        title: sem.title,
        week: sem.week,
      }));
      const res = await callAI('prospection', {
        vars: { sector: s, zone: z, need: n, seminarsContext },
      });
      setResult(res.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult(`Erreur: ${msg}`);
    } finally {
      setLoading(false);
    }
```

(Keep the variables `s`, `z`, `n` as they already exist in the function scope — upstream uses them as trimmed form inputs. `seminars` comes from the existing `WebProspectionPageProps`.)

Also remove the old `setResult(res.text); setLoading(false);` lines that the original `callGemini` branch used — they're now inside the try/finally.

- [ ] **Step 3: Verify the JSON-parsing block below still works**

Upstream parses `result` downstream with `result.match(/\[[\s\S]*\]/)` and `JSON.parse`. Our `prospection` template returns JSON-only in French, so this parser still matches. **Do not change the parser.**

- [ ] **Step 4: Typecheck**

Run: `npm run lint`
Expected: no errors in `WebProspectionPage.tsx`. If it complains about `callAI` not accepting `'prospection'`, re-run Task 3 Step 8 (you forgot the client-side type union).

- [ ] **Step 5: Commit**

```bash
git add src/admin/WebProspectionPage.tsx
git commit -m "feat(admin): port WebProspectionPage using server prospection template

Replaces upstream callGemini (raw client-supplied prompt + JSON flag)
with callAI('prospection', { vars: { sector, zone, need } }). Server
owns the system prompt, enforces JSON contract, and applies aiLimiter +
requireAuth. UI state and parsing unchanged."
```

---

## Task 9 — Port AgentHub.tsx (grouping component)

**Files:**
- Create: `src/admin/AgentHub.tsx` (65 lines)

**Why:** Wraps `LeadsPage`, `AgentPage`, `SeoAgentPage`, `WebProspectionPage`, `ResearchPage` in a tabbed surface. All five imports exist in our tree at this point (Task 8 created `WebProspectionPage`; the other four were already ported pre-Phase 2).

- [ ] **Step 1: Copy the upstream file**

```bash
git show upstream/main:src/admin/AgentHub.tsx > src/admin/AgentHub.tsx
```

- [ ] **Step 2: Typecheck**

Run: `npm run lint 2>&1 | grep -A1 AgentHub`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/admin/AgentHub.tsx
git commit -m "feat(admin): port AgentHub.tsx grouping component

Tabs over Leads/Commercial/SEO/Prospection/Research."
```

---

## Task 10 — Port FinancePage.tsx (singleton budget → per-seminar seminarBudgets)

**Files:**
- Modify (effectively rewrite): `src/admin/FinancePage.tsx` (current 498 → upstream 946 lines)

**Why:** This is the single largest file change in Phase 2. Upstream replaces the global `budgetConfig`/`setBudgetConfig` props with `seminarBudgets`/`setSeminarBudgets` and renders a separate budget panel per seminar (11 charge lines × N seminars, plus per-seminar persistence to `settings.seminar_budgets`). Because the delta is ~450 net-new lines of UI code, this task uses a **copy-verbatim-then-adapt** pattern rather than a full inline code dump — the adaptation points are what matter, and they're concrete.

**Acceptable escalation:** If the copy introduces more than 10 type errors outside the listed adaptation points, stop and report `BLOCKED` — upstream may have diverged further than the checkpoint assumed.

- [ ] **Step 1: Snapshot the current file for reference**

```bash
cp src/admin/FinancePage.tsx /tmp/FinancePage.tsx.pre-phase2
```

- [ ] **Step 2: Copy upstream verbatim**

```bash
git show upstream/main:src/admin/FinancePage.tsx > src/admin/FinancePage.tsx
```

- [ ] **Step 3: Typecheck to surface adaptation needs**

Run: `npm run lint 2>&1 | grep -E "FinancePage|error TS" | head -50`

Apply these known adaptations (expected symptoms listed first, fix second):

| Symptom | Fix |
|---|---|
| `Cannot find module './callGemini'` | If `FinancePage.tsx` imports `callGemini`, replace with `import { callAI } from './callAI';` and adapt any call site to the appropriate template (financial-analysis features, if any, should map to `'commercial'` with seminar context — but verify by reading upstream first). If there's no AI call at all, just delete the import. |
| `Property 'budgetConfig' does not exist` (in callers) | This is in `src/pages/AdminDashboard.tsx` only, and Task 12 handles it. Ignore for now. |
| Type errors on `SeminarBudgetConfigs` / `BudgetConfig` | Confirm Phase 1 types are correctly exported — `grep -n "SeminarBudgetConfigs" src/admin/types.ts`. If missing, STOP. |
| French special-character mangling | Leave upstream's transliterations as-is. |
| Missing `DEFAULT_BUDGET_CONFIG` import | Should come from `./config` — it exists in Phase 1. Verify with `grep "DEFAULT_BUDGET_CONFIG" src/admin/config.ts`. |

- [ ] **Step 4: Confirm the new prop signature**

The new file's `FinancePageProps` interface should declare:

```ts
interface FinancePageProps {
  participants: Participant[];
  seminars: Seminar[];
  prices: Prices;
  expenses: Expense[];
  refreshExpenses: () => Promise<void>;
  seminarBudgets: SeminarBudgetConfigs;
  setSeminarBudgets: React.Dispatch<React.SetStateAction<SeminarBudgetConfigs>>;
}
```

If the shape differs, the upstream source is the truth. AdminDashboard will match whatever upstream declares here.

- [ ] **Step 5: Re-run lint and clean up any remaining FinancePage-local errors**

Run: `npm run lint 2>&1 | grep FinancePage`
Expected: empty output (errors in `AdminDashboard.tsx` are still expected; they're fixed in Task 12).

- [ ] **Step 6: Persistence audit (Qwen plan-review #1 — data-loss gate)**

This is a **mandatory gate** before commit. Read the ported `FinancePage.tsx` and confirm it writes edits back to Supabase `settings.seminar_budgets` on change. Run:

```bash
grep -nE "supabase\.from\('settings'\).*(upsert|update|insert)|setSeminarBudgets" src/admin/FinancePage.tsx | head -20
```

Expected: at least one `supabase.from('settings')` call with `upsert`/`update` that references `seminar_budgets`, OR a clearly-wired `setSeminarBudgets` prop callback that the parent `AdminDashboard.tsx` persists (Task 12 should then mirror the state into Supabase on `setSeminarBudgets` call).

If neither exists — upstream only uses local state — **STOP and report `BLOCKED: upstream FinancePage lacks persistence wiring`**. Do not commit. Options are (a) add an `upsert` on edit here before committing, or (b) wire it in Task 12's `setSeminarBudgets` state setter. Pick one, execute, then continue.

Do not skip this step because "upstream probably handles it." Data loss on refresh is a P0 bug.

- [ ] **Step 7: Commit**

```bash
git add src/admin/FinancePage.tsx
git commit -m "feat(admin): port FinancePage.tsx with per-seminar budgets

Replaces global budgetConfig with seminarBudgets (Record<seminarId, BudgetConfig>).
Renders one budget panel per seminar, persists to settings.seminar_budgets.
AdminDashboard wiring lands in a later task — typecheck intentionally
remains broken between this commit and that one."
```

---

## Task 11 — Port SeminarsManagement.tsx (absorbs PricesPage)

**Files:**
- Modify (effectively rewrite): `src/admin/SeminarsManagement.tsx` (current 119 → upstream 975 lines)

**Why:** Upstream consolidates the old `PricesPage` functionality into `SeminarsManagement`: the seminar list gains a per-seminar pricing panel with custom `SeminarPricing` entries persisted to `settings.seminar_pricing`, alongside the global `DEFAULT_PRICES` fallback. Same copy-then-adapt treatment as Task 10.

- [ ] **Step 1: Snapshot**

```bash
cp src/admin/SeminarsManagement.tsx /tmp/SeminarsManagement.tsx.pre-phase2
```

- [ ] **Step 2: Copy upstream**

```bash
git show upstream/main:src/admin/SeminarsManagement.tsx > src/admin/SeminarsManagement.tsx
```

- [ ] **Step 3: Typecheck + adapt**

Run: `npm run lint 2>&1 | grep -E "SeminarsManagement|error TS" | head -50`

Known adaptations:

| Symptom | Fix |
|---|---|
| `Cannot find module './callGemini'` | Replace with `callAI`; most likely maps to `'research'` if the feature is "AI-assisted seminar description generation". Verify by reading the call site. |
| Missing type imports | Add `SeminarPricingConfigs` and `Prices` to the type import. Both exist from Phase 1. |
| `DEFAULT_SEMINAR_PRICING` missing from config import | Verify `grep -n "DEFAULT_SEMINAR_PRICING" src/admin/config.ts`. Exists from Phase 1. |

The new prop signature should look like:

```ts
interface SeminarsManagementProps {
  seminars: Seminar[];
  refreshSeminars: () => Promise<void>;
  prices: Prices;
  setPrices: React.Dispatch<React.SetStateAction<Prices>>;
  seminarPricing: SeminarPricingConfigs;
  setSeminarPricing: React.Dispatch<React.SetStateAction<SeminarPricingConfigs>>;
}
```

- [ ] **Step 4: Re-run lint**

Run: `npm run lint 2>&1 | grep SeminarsManagement`
Expected: empty (AdminDashboard.tsx errors are still expected).

- [ ] **Step 5: Persistence audit (same Qwen #1 gate)**

Same data-loss gate as Task 10 Step 6, for pricing this time. Run:

```bash
grep -nE "supabase\.from\('settings'\).*(upsert|update|insert)|setSeminarPricing|setPrices" src/admin/SeminarsManagement.tsx | head -20
```

Expected: either the file persists `seminar_pricing` and `prices` directly, or the `setPrices`/`setSeminarPricing` prop callbacks are clearly defined for the parent to persist in Task 12. If neither — **STOP and report `BLOCKED: upstream SeminarsManagement lacks persistence wiring`**. Don't commit.

- [ ] **Step 6: Commit**

```bash
git add src/admin/SeminarsManagement.tsx
git commit -m "feat(admin): port SeminarsManagement.tsx, absorb PricesPage

Per-seminar pricing panels replace the standalone Prices tab. Custom
pricing entries persist to settings.seminar_pricing; DEFAULT_PRICES
stays as the fallback."
```

---

## Task 11.5 — Mid-sprint typecheck fingerprint gate (Qwen plan-review #3)

**Files:** none (verification only).

**Why:** Tasks 5, 10, 11 deliberately leave the tree red until Task 12 wires the shell. Qwen's valid concern: a regression introduced by one of the big ports could hide inside the expected error noise and only surface after Task 12 fails to compile. This gate pins the expected error fingerprint: every remaining error must be in `src/pages/AdminDashboard.tsx` and must be about `seminarBudgets`, `seminarPricing`, or a removed import. If any error lives outside that file or names a different symbol, a big port broke something and we need to investigate before touching the shell.

- [ ] **Step 1: Capture current error set**

Run: `npm run lint 2>&1 | tee /tmp/phase2-typecheck.txt`
Expected: non-zero exit.

- [ ] **Step 2: Confirm every error is in `src/pages/AdminDashboard.tsx`**

Run: `grep -E "error TS[0-9]+:" /tmp/phase2-typecheck.txt | grep -v "src/pages/AdminDashboard.tsx"`
Expected: **empty output**. If any line prints, an error lives outside AdminDashboard — a big port introduced regression. **STOP and investigate** which file errored and why; do not start Task 12 until this is clean.

- [ ] **Step 3: Sanity-check the error shape**

Run: `grep -cE "seminarBudgets|seminarPricing|BudgetConfig|ContentStudio|AgentHub|PricesPage|LeadsPage|AgentPage|SeoAgentPage|FlyerPage|ResearchPage" /tmp/phase2-typecheck.txt`
Expected: a positive number. These are the symbols the Task 12 rewrite will resolve. If you get zero, the errors are about something unexpected — stop and read the full error log.

- [ ] **Step 4: Record the error count for Task 12 regression check**

Run: `grep -cE "error TS[0-9]+:" /tmp/phase2-typecheck.txt`
Record the number (call it `N_EXPECTED`). Task 12 Step 4 will assert the error count drops to zero — if it drops to anything else, something unexpected survived.

- [ ] **Step 5: No commit**

This task creates no changes. Proceed to Task 12.

---

## Task 12 — Rewrite AdminDashboard.tsx (shell restructure + chat decision)

**Files:**
- Modify: `src/pages/AdminDashboard.tsx`

**Why:** AdminDashboard is the shell that wires everything together. Post-Phase 2 it carries: `seminarBudgets`/`seminarPricing` state (replaces `budgetConfig`), imports for `ContentStudio`/`AgentHub` (replaces six individual page imports), and an updated page-map JSX that matches the new 8-tab Nav from Task 4. **Two hard constraints from main's hardening pass must be preserved**: (a) keep `ADMIN_FETCH_LIMIT = 500` on every fetcher, and (b) do NOT reintroduce upstream lines 118-123 (the `placeholder.supabase.co` dev-login bypass). **One decision lands in this task**: the ChatWidget admin mount.

### Decision: `<ChatWidget mode="admin">` — DROP entirely

Upstream mounts `<ChatWidget mode="admin" seminars={seminars} userName={user?.user_metadata?.name} />` at the bottom of the JSX. Our Phase 1 deliberately removed the `mode` prop from `ChatWidget` so that any `mode="admin"` call site would fail to compile — forcing this decision at port time.

**Resolution: drop the admin mount.** Do NOT add a new `/api/ai/admin-chat` route. Do NOT add a new `admin-chat` template. Do NOT mount `<ChatWidget />` (no prop) in the admin shell. Rationale:

1. Admin users already have richer template-locked AI surfaces (`ContentStudio` and `AgentHub`) via `/api/ai/generate` + `requireAuth` + `requireAdmin`. A free-form chat is strictly less useful than those.
2. Adding an authed admin chat requires: a new templateId, a new Zod schema branch, a new route with `requireAuth + requireAdmin`, and a new `mode` prop on `ChatWidget` (which we just removed). That's Phase-4-or-later scope.
3. The public ChatWidget is already mounted on the landing page in Phase 4 — admins can use that if they genuinely need a chat-style answer about the public program.

If in a future sprint someone needs an authed admin chat, the right path is: add templateId `"admin-chat"` to `api/prompts.ts`, add `POST /api/ai/admin-chat` with `aiLimiter + requireAuth + requireAdmin`, and add a new `<AdminChatWidget>` component — not reintroduce the `mode` prop.

- [ ] **Step 1: Diff current vs upstream for visual reference**

Run: `diff src/pages/AdminDashboard.tsx <(git show upstream/main:src/pages/AdminDashboard.tsx) | head -120`
Read the output. You're about to apply a port-with-adaptations, not a verbatim copy.

- [ ] **Step 2: Apply the port as a single deliberate edit (not a verbatim copy)**

Do NOT run `git show upstream/main:src/pages/AdminDashboard.tsx > src/pages/AdminDashboard.tsx`. That would reintroduce the login bypass and strip `ADMIN_FETCH_LIMIT`. Instead, apply these changes to the existing file:

**(a) Imports** — replace the current admin-module import block with:

```ts
import { DEFAULT_SEMINARS, DEFAULT_PRICES, SURFACE_BG, ORANGE, card, btnPrimary } from "../admin/config";
import type { Seminar, Participant, Expense, Task, Lead, Prices, SeminarBudgetConfigs, SeminarPricingConfigs } from "../admin/types";
import { Nav } from "../admin/Nav";
import { DashboardPage } from "../admin/DashboardPage";
import { SeminarsManagement } from "../admin/SeminarsManagement";
import { InscriptionsPage } from "../admin/InscriptionsPage";
import { FinancePage } from "../admin/FinancePage";
import { TasksPage } from "../admin/TasksPage";
import { FormationTrackingPage } from "../admin/FormationTrackingPage";
import { ContentStudio } from "../admin/ContentStudio";
import { AgentHub } from "../admin/AgentHub";
```

**Removed imports (confirm all are gone):** `DEFAULT_BUDGET_CONFIG`, `BudgetConfig`, `SeoAgentPage`, `FlyerPage`, `LeadsPage`, `PricesPage`, `AgentPage`, `ResearchPage`. The `LogoRMK` and `supabase` imports stay.

**(b) State** — inside the `AdminDashboard` function, replace:

```ts
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>(DEFAULT_BUDGET_CONFIG);
```

with:

```ts
  const [seminarBudgets, setSeminarBudgets] = useState<SeminarBudgetConfigs>({});
  const [seminarPricing, setSeminarPricing] = useState<SeminarPricingConfigs>({});
```

Leave `prices`, `seminars`, `participants`, `expenses`, `tasks`, `leads`, `isLoading`, `user` all unchanged.

**(c) Data fetchers** — keep all five existing fetchers AS-IS. They already have `ADMIN_FETCH_LIMIT` — do not remove it.

**(d) `loadAll` settings fetches** — find the `Promise.resolve(supabase.from('settings').select('*').eq('id', 'budget_config')...)` block inside `loadAll` and replace it with two fetches:

```ts
          Promise.resolve(supabase.from('settings').select('*').eq('id', 'seminar_budgets').single()).then(({ data }) => {
            if (data && data.value) setSeminarBudgets(data.value as SeminarBudgetConfigs);
          }).catch(() => { /* seminar budgets fetch failed silently */ }),
          Promise.resolve(supabase.from('settings').select('*').eq('id', 'seminar_pricing').single()).then(({ data }) => {
            if (data && data.value) setSeminarPricing(data.value as SeminarPricingConfigs);
          }).catch(() => { /* seminar pricing fetch failed silently */ })
```

**(e) Login handler** — keep the existing `handleLogin` AS-IS. **Do not add the upstream dev-mode bypass.** The comment at line 121-123 stays verbatim — it's the anti-regression signal.

**(f) Page map JSX** — find the block starting with `{page === "dashboard" && ...}` and replace with exactly:

```tsx
            {page === "dashboard" && <DashboardPage participants={participants} prices={prices} tasks={tasks} leads={leads} seminars={seminars} seminarBudgets={seminarBudgets} />}
            {page === "seminaires" && <SeminarsManagement seminars={seminars} refreshSeminars={fetchSeminars} prices={prices} setPrices={setPrices} seminarPricing={seminarPricing} setSeminarPricing={setSeminarPricing} />}
            {page === "inscriptions" && <InscriptionsPage participants={participants} seminars={seminars} refreshParticipants={fetchParticipants} />}
            {page === "finance" && <FinancePage participants={participants} seminars={seminars} prices={prices} expenses={expenses} refreshExpenses={fetchExpenses} seminarBudgets={seminarBudgets} setSeminarBudgets={setSeminarBudgets} />}
            {page === "tasks" && <TasksPage tasks={tasks} seminars={seminars} refreshTasks={fetchTasks} />}
            {page === "formation" && <FormationTrackingPage seminars={seminars} participants={participants} />}
            {page === "contenus" && <ContentStudio seminars={seminars} participants={participants} />}
            {page === "agents" && <AgentHub seminars={seminars} leads={leads} refreshLeads={fetchLeads} />}
```

**(g) ChatWidget mount** — do NOT add any `<ChatWidget .../>` below `</main>`. The closing `</div>` of the main container is the last JSX in the return.

- [ ] **Step 3: Anti-regression audit**

Run these three checks and confirm each passes:

```bash
grep -n "placeholder.supabase.co" src/pages/AdminDashboard.tsx
```
Expected: only matches inside the warning comment (around line 121-123 of the original). If you see a `const supabaseUrl = ...` or `alert(...)` block, you accidentally copied the bypass. Revert and redo Step 2(e).

```bash
grep -n "ADMIN_FETCH_LIMIT" src/pages/AdminDashboard.tsx
```
Expected: one `const ADMIN_FETCH_LIMIT = 500;` declaration plus five `.limit(ADMIN_FETCH_LIMIT)` call sites. If any fetcher lost it, restore.

```bash
grep -n "ChatWidget" src/pages/AdminDashboard.tsx
```
Expected: zero matches. If any match, delete the mount.

- [ ] **Step 4: Typecheck and assert error count dropped to zero**

Run: `npm run lint`
Expected: PASS. All cross-file errors from earlier tasks (DashboardPage, FinancePage, SeminarsManagement, Nav) resolve now because AdminDashboard finally matches their contracts.

If lint still prints errors, cross-reference with Task 11.5's `N_EXPECTED` count:

```bash
npm run lint 2>&1 | grep -cE "error TS[0-9]+:"
```

Expected: `0`. If any non-zero number survives, compare against `/tmp/phase2-typecheck.txt` — errors that were in the pre-Task-12 fingerprint should all be gone; any NEW error means the shell rewrite introduced a regression on top of the expected fixes. Fix before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminDashboard.tsx
git commit -m "feat(admin): restructure AdminDashboard shell for hub layout

- Replace global budgetConfig with per-seminar seminarBudgets + seminarPricing
- Drop imports for standalone Leads/Prices/Agent/SEO/Flyer/Research pages
- Add ContentStudio and AgentHub imports + JSX mounts
- Fetch settings.seminar_budgets and settings.seminar_pricing on init
- PRESERVE: ADMIN_FETCH_LIMIT on every fetcher
- PRESERVE: no placeholder.supabase.co dev-login bypass
- DECISION: drop ChatWidget admin mount — admin surfaces already cover
  AI needs via ContentStudio + AgentHub; an authed admin chat is deferred."
```

---

## Task 13 — Delete PricesPage.tsx

**Files:**
- Delete: `src/admin/PricesPage.tsx`

**Why:** Task 11 moved the functionality into `SeminarsManagement.tsx`. Task 12 removed the last import. It's now orphaned.

- [ ] **Step 1: Confirm no references**

Run: `grep -rn "PricesPage" src/ api/ 2>/dev/null`
Expected: zero matches. If any match exists, stop and patch it first.

- [ ] **Step 2: Delete**

```bash
git rm src/admin/PricesPage.tsx
```

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A src/admin/PricesPage.tsx
git commit -m "chore(admin): delete orphaned PricesPage.tsx

Functionality absorbed into SeminarsManagement.tsx per-seminar pricing
panels. No remaining references."
```

---

## Task 14 — Update `src/admin/index.ts` exports

**Files:**
- Modify: `src/admin/index.ts`

**Why:** Barrel file. Drop `PricesPage` export, add `ContentStudio`, `AgentHub`, `BrochurePage`, `CertificatePage`, `InvitationPage`, `WebProspectionPage` exports. Keep existing exports for everything else.

- [ ] **Step 1: Read current state**

Run: `cat src/admin/index.ts`
Identify the current export list.

- [ ] **Step 2: Apply edits**

Remove (if present): `export { PricesPage } from './PricesPage';`

Add (alphabetized with the rest of the page exports):

```ts
export { AgentHub } from './AgentHub';
export { BrochurePage } from './BrochurePage';
export { CertificatePage } from './CertificatePage';
export { ContentStudio } from './ContentStudio';
export { InvitationPage } from './InvitationPage';
export { WebProspectionPage } from './WebProspectionPage';
```

Leave `callAI`, `TemplateId`, and all existing exports alone.

- [ ] **Step 3: Typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/index.ts
git commit -m "chore(admin): update barrel exports for Phase 2 restructure"
```

---

## Task 15 — Full verification (typecheck + build + tests + preview smoke)

**Files:** none (verification only).

**Why:** The "verification-before-completion" skill requires running commands and citing evidence. This task is that evidence.

- [ ] **Step 1: Typecheck**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: success, `dist/` generated, no warnings about missing imports.

- [ ] **Step 3: Server test suite**

Run: `npx vitest run api/`
Expected: all tests pass (Phase 1 chat tests + new prospection tests + rate-limit fix test).

- [ ] **Step 4: E2E smoke (optional but recommended)**

Run: `npx playwright test e2e/phase4.spec.ts` (or whichever E2E file covers the admin shell; see `e2e/` directory)
Expected: no new failures vs Phase 1 baseline.

If the E2E suite doesn't currently exercise the admin shell, skip this step and rely on Step 5 instead.

- [ ] **Step 5: Local dev-server manual smoke (admin shell)**

Run: `npm run dev` (port 8080)
In a browser, navigate to `http://localhost:8080/admin`, log in with a test admin account, and verify:

- Nav shows exactly 8 tabs (Dashboard, Séminaires, Inscriptions, Finance, Tâches, Suivi Formation, Contenus, Agents & Prospection)
- Dashboard renders with 8 KPI tiles including "Budget Charges" and "Marge Prev."
- Contenus tab opens `ContentStudio` with 4 sub-tabs (Brochure/Flyer/Certificats/Invitations)
- Agents tab opens `AgentHub` with 5 sub-tabs (Leads/Commercial/SEO/Prospection/Recherche)
- Finance tab renders per-seminar budget panels (one card per seminar)
- Séminaires tab renders per-seminar pricing panels
- **No ChatWidget floating button appears on the admin shell** (tripwire resolved by removal, not reintroduction)
- **Console is clean** — no errors, no warnings about missing props

Stop the dev server.

- [ ] **Step 6: Push and update PR #3**

Run: `git push origin integrate/upstream-sprint-7`
Expected: Qwen pre-push review PASS. If BLOCKED, fix the finding before pushing — do NOT use `--no-verify`.

After push, update PR #3 body: move the Phase 2 checklist items into the "✅ DONE" section, note the ChatWidget admin-mount decision, note the rate limiter fix, and link the new preview URL once Vercel redeploys.

- [ ] **Step 7: Confirm preview deployment is green**

Wait for Vercel to build (~1-2 min), then run: `vercel ls --scope akemas-projects | head -5` to find the new preview URL for `integrate/upstream-sprint-7`. Visit it and repeat Step 5's manual smoke against the deployed URL.

- [ ] **Step 8: Final status report**

Report Phase 2 complete with:
- Commit range covered (from `33d1b44` to current HEAD)
- Number of commits added
- Typecheck/build/test status
- Preview URL
- Resolved Phase 1 findings (rate limiter #1, ChatWidget #2 — both done; #3 and #4 still tracked in PR #3 Accepted Tradeoffs)

---

## Post-Phase-2 Notes

**Deferred to future sprints:**
- Authed admin chat (new templateId + route + component; not in Phase 3/4)
- Phase 1 Qwen finding #3 (ChatWidget inline styles → Tailwind)
- Phase 1 Qwen finding #4 (ChatWidget error swallowing)
- `AdminAssistant.tsx` port (no caller in Phase 2's final shell)

**Phase 3 starts with:** client portal rewrite + `POST /api/community/post` with service-role insert + ownership enforcement + tightened `community_posts` RLS. Not in scope here.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — the writing-plans skill will now dispatch Gemini + Qwen parallel plan review per CLAUDE.md mandate.
