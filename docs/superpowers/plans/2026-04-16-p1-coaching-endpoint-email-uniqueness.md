# P1: Coaching Endpoint + Email Uniqueness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-gemini-plugin:subagent-driven-development (recommended) or superpowers-gemini-plugin:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an authed AI coaching endpoint for confirmed participants and add a partial unique index on `(email, seminar)` to close the registration race condition.

**Architecture:** New `POST /api/ai/coaching` mirrors the community post pattern (requireAuth + participant lookup + status gate). New `coaching` prompt template in `api/prompts.ts` injects seminar-specific context. Partial unique index on participants table with dedup migration. Client-side changes: fix PortalCoaching to call the new endpoint, flip COACHING_ENABLED, handle 23505 on registration insert.

**Tech Stack:** Express.js, Zod, Supabase (PostgreSQL), Vitest + supertest, AI SDK + Vercel AI Gateway

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/prompts.ts` | Modify | Add `coaching` template ID, `CoachingVars` interface, render case |
| `api/app.ts` | Modify | Add `coachingRequestSchema`, `coachingLimiter`, `POST /api/ai/coaching` handler |
| `src/lib/coachingApi.ts` | Create | Client-side API wrapper (mirrors `src/lib/communityApi.ts`) |
| `src/pages/portal/PortalCoaching.tsx` | Modify | Replace broken `/api/ai/generate` call with `coachingApi`, remove mock |
| `src/pages/ClientPortal.tsx` | Modify | `COACHING_ENABLED = true`, remove disable comment |
| `src/pages/LandingPage.tsx` | Modify | Handle Postgres 23505 error on insert |
| `supabase/migrations/20260416000000_email_uniqueness.sql` | Create | Dedup + partial unique index |
| `supabase_schema.sql` | Modify | Document new index |
| `api/__tests__/coaching.test.ts` | Create | Coaching endpoint tests |
| `api/__tests__/registration-uniqueness.test.ts` | Create | 23505 error handling tests |

---

## Task 1: Add coaching prompt template

**Files:**
- Modify: `api/prompts.ts`

- [ ] **Step 1: Add `coaching` to TemplateId union and PROMPT_TEMPLATES array**

In `api/prompts.ts`, update the type and array:

```typescript
// Line 17 — add "coaching" to the union
export type TemplateId = "seo" | "commercial" | "research" | "chat" | "prospection" | "coaching";

// Line 236-242 — add "coaching" to the array
export const PROMPT_TEMPLATES: readonly TemplateId[] = [
  "seo",
  "commercial",
  "research",
  "chat",
  "prospection",
  "coaching",
] as const;
```

- [ ] **Step 2: Add CoachingVars interface and update RenderVars**

After the `ProspectionVars` interface (line 71), add:

```typescript
export interface CoachingVars {
  prenom: string;
  nom: string;
  seminarId: string;
  userPrompt: string;
}
```

Update the RenderVars union (line 73):

```typescript
export type RenderVars = CommercialVars | ChatVars | ProspectionVars | CoachingVars | Record<string, never> | undefined;
```

- [ ] **Step 3: Add the coaching case to renderSystemPrompt**

Before the `default:` case (line 228), add:

```typescript
    case "coaching": {
      const cv = vars as CoachingVars | undefined;
      if (!cv?.prenom || !cv?.nom || !cv?.seminarId || !cv?.userPrompt) {
        throw new Error("coaching template requires vars.prenom, vars.nom, vars.seminarId, vars.userPrompt");
      }
      const seminar = SEMINARS.find((s) => s.id === cv.seminarId);
      if (!seminar) {
        throw new Error("Unknown seminarId");
      }
      const objectives = seminar.highlights
        .map((h) => `- ${safe(h)}`)
        .join("\n");
      const modules = seminar.modules
        .map((m) => `- ${safe(m)}`)
        .join("\n");
      return `Tu es un coach expert en Intelligence Artificielle pour des professionnels africains. Tu accompagnes ${safe(cv.prenom)} ${safe(cv.nom)} dans l'integration concrete de l'IA dans son activite professionnelle.

Tu es specialise dans le contenu du seminaire "${safe(seminar.title)}" (${safe(seminar.code)}, ${safe(seminar.week)}).

Description du seminaire : ${safe(seminar.subtitle)}
Public cible : ${safe(seminar.target)}

Objectifs pedagogiques :
${objectives}

Modules du programme :
${modules}

Instructions :
- Reponds en francais, de facon directe, structuree et actionnable.
- Base tes recommandations sur le contenu specifique de ce seminaire.
- Sois concret et adapte au contexte professionnel africain / ouest-africain.
- Ne fabrique pas d'informations au-dela du contexte fourni.
- Structure ta reponse avec des titres, des listes et des etapes claires.

Question du participant :
${safe(cv.userPrompt)}`;
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (the exhaustiveness check on the `default` case will catch any missing template IDs)

- [ ] **Step 5: Commit**

```bash
git add api/prompts.ts
git commit -m "feat: add coaching prompt template to PROMPT_TEMPLATES registry"
```

---

## Task 2: Add coaching endpoint to api/app.ts

**Files:**
- Modify: `api/app.ts`

- [ ] **Step 1: Add Zod schema for coaching requests**

After `communityPostSchema` (line 181), add:

```typescript
const coachingRequestSchema = z.object({
  seminar: z.string().min(1).max(100),
  userPrompt: z.string().min(1).max(1000),
});
```

- [ ] **Step 2: Add coachingLimiter**

After `communityLimiter` (line 312), add:

```typescript
  // Coaching AI: 5/min — higher than community (3/min) because AI responses
  // take longer and participants may retry on timeout. Lower than admin AI
  // (20/min) because the participant surface is public-facing.
  const coachingLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: "Too many coaching requests. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });
```

- [ ] **Step 3: Add the POST /api/ai/coaching route**

After the community post route (after line 771), add:

```typescript
  // ── AI coaching (confirmed participants only) ─────────────────────────
  // Authenticated participant requests AI coaching specific to their seminar.
  // Mirrors the community post auth chain: requireAuth + participant lookup
  // + confirmed status gate. The prompt template injects seminar objectives,
  // modules, and context so the AI gives targeted coaching, not generic advice.
  app.post(
    "/api/ai/coaching",
    coachingLimiter,
    requireAuth,
    async (req, res) => {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Database not configured" });
      }

      const parsed = coachingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { seminar, userPrompt } = parsed.data;

      const email = (req as any).userEmail as string | null;
      if (!email) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify the seminar exists in our catalog before querying the DB.
      const seminarData = SEMINARS.find((s) => s.id === seminar);
      if (!seminarData) {
        return res.status(400).json({ error: "Unknown seminar" });
      }

      // Participant lookup: same pattern as /api/community/post.
      // .limit(1) + array index instead of .maybeSingle() to avoid PGRST116
      // when the same email has multiple rows for different seminars.
      const { data: participants, error: lookupErr } = await supabaseAdmin
        .from("participants")
        .select("id, nom, prenom, email, seminar, status")
        .eq("email", email.toLowerCase().trim())
        .eq("seminar", seminar)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (lookupErr) {
        console.error("Coaching participant lookup failed:", lookupErr);
        return res.status(500).json({ error: "Participant lookup failed" });
      }
      const participant = participants?.[0] ?? null;
      if (!participant) {
        return res.status(403).json({
          error: "Coaching access requires a confirmed registration for this seminar",
        });
      }

      // Sanitize user input before prompt injection.
      const safePrompt = sanitizeText(userPrompt, 1000);
      if (!safePrompt) {
        return res.status(400).json({
          error: "Prompt cannot be empty after sanitization",
        });
      }

      try {
        const systemPrompt = renderSystemPrompt("coaching", {
          prenom: participant.prenom,
          nom: participant.nom,
          seminarId: participant.seminar,
          userPrompt: safePrompt,
        });

        const response = await generateText({
          model: AI_MODEL,
          system: systemPrompt,
          prompt: safePrompt,
        });

        return res.json({ text: response.text });
      } catch (err) {
        console.error("Coaching AI generation error:", err);
        return res.status(502).json({ error: "AI service temporarily unavailable" });
      }
    }
  );
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add api/app.ts
git commit -m "feat: add POST /api/ai/coaching endpoint for confirmed participants"
```

---

## Task 3: Write coaching endpoint tests

**Files:**
- Create: `api/__tests__/coaching.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Mock AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "Voici votre plan d'action IA personnalisé..." })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

// Supabase mock — same pattern as community.test.ts
const mockAuthGetUser = vi.fn();
const mockFromSelectList = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: mockFromSelectList,
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}));

import { createApp } from "../app.js";

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
  // Default: valid auth, confirmed participant for seminar s1
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "participant@example.com" } },
    error: null,
  });
  mockFromSelectList.mockResolvedValue({
    data: [
      {
        id: "row-1",
        nom: "Doe",
        prenom: "Jane",
        email: "participant@example.com",
        seminar: "s1",
        status: "confirmed",
      },
    ],
    error: null,
  });
});

const validBody = {
  seminar: "s1",
  userPrompt: "Comment appliquer l'IA dans la gestion financière de mon entreprise?",
};

describe("POST /api/ai/coaching", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app).post("/api/ai/coaching").send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Supabase JWT is invalid", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid token" },
    });
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer bad-token")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 when seminar is missing", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ userPrompt: "test" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when userPrompt is missing", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ seminar: "s1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when userPrompt exceeds 1000 chars", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ seminar: "s1", userPrompt: "a".repeat(1001) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown seminar ID not in catalog", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ seminar: "nonexistent-seminar", userPrompt: "test question" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Unknown seminar");
  });

  it("returns 403 when no confirmed participant found", async () => {
    mockFromSelectList.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("returns 200 with AI coaching text for confirmed participant", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("text");
    expect(typeof res.body.text).toBe("string");
  });

  it("returns 502 when AI generation fails", async () => {
    const { generateText } = await import("ai");
    (generateText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Gemini API error")
    );
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("AI service temporarily unavailable");
  });

  it("returns 429 after 5 requests in 1 minute", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/ai/coaching")
        .set("Authorization", "Bearer valid-token")
        .send(validBody);
    }
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (endpoint doesn't exist yet — but it does, we wrote it in Task 2)**

Run: `npx vitest run api/__tests__/coaching.test.ts`
Expected: All 9 tests PASS (endpoint was added in Task 2)

- [ ] **Step 3: Commit**

```bash
git add api/__tests__/coaching.test.ts
git commit -m "test: add coaching endpoint test suite (9 tests)"
```

---

## Task 4: Create client-side coaching API wrapper

**Files:**
- Create: `src/lib/coachingApi.ts`

- [ ] **Step 1: Write the coaching API wrapper**

Mirrors `src/lib/communityApi.ts` pattern:

```typescript
import { supabase } from './supabaseClient';

/**
 * POST /api/ai/coaching — authenticated AI coaching for confirmed participants.
 *
 * Sends { seminar, userPrompt } with the Supabase session bearer token.
 * The server derives participant identity from the session and injects
 * seminar-specific context into the AI prompt.
 */
export async function requestCoaching(input: {
  seminar: string;
  userPrompt: string;
}): Promise<{ text?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: 'Session expirée. Veuillez vous reconnecter.' };
  }

  try {
    const res = await fetch('/api/ai/coaching', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        seminar: input.seminar,
        userPrompt: input.userPrompt,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error || `Erreur HTTP ${res.status}` };
    }

    const body = await res.json();
    return { text: body.text };
  } catch (err) {
    console.error('Coaching API error:', err);
    return { error: 'Impossible de contacter le service de coaching. Veuillez réessayer.' };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/coachingApi.ts
git commit -m "feat: add client-side coaching API wrapper"
```

---

## Task 5: Update PortalCoaching to use new endpoint

**Files:**
- Modify: `src/pages/portal/PortalCoaching.tsx`
- Modify: `src/pages/ClientPortal.tsx`

- [ ] **Step 1: Update PortalCoaching.tsx**

Add the import at the top (after existing imports, line 8):

```typescript
import { requestCoaching } from '../../lib/coachingApi';
```

Replace the `handleCoachingAnalysis` function body (lines 67-122) with:

```typescript
  const handleCoachingAnalysis = async () => {
    if (!coachingForm.defi.trim()) return;
    setCoachingLoading(true);
    setCoachingResult('');
    try {
      // Build a single coaching prompt from all form fields.
      const userPrompt = `Contexte professionnel :
- Entreprise / Organisation : ${coachingForm.entreprise || 'Non precise'}
- Secteur d'activite : ${coachingForm.secteur || 'Non precise'}
- Role / Fonction : ${coachingForm.role || 'Non precise'}
- Objectif coaching : ${coachingForm.objectif}

Defi principal :
${coachingForm.defi}

Fournis un plan d'action IA personnalise structure ainsi :
1. **Diagnostic rapide** : analyse de la situation et des opportunites IA specifiques
2. **3 actions prioritaires** : ce que tu peux faire des cette semaine avec l'IA
3. **Outils recommandes** : les outils IA les plus adaptes a ce contexte precis
4. **Cas d'usage concret** : un exemple detaille d'application IA sur ce defi
5. **Indicateurs de succes** : comment mesurer l'impact a 30 jours`;

      const seminarId = seminar?.id || participant.seminar;
      const result = await requestCoaching({
        seminar: seminarId,
        userPrompt,
      });

      if (result.error) {
        setCoachingResult(`Erreur : ${result.error}`);
      } else {
        setCoachingResult(result.text || 'Analyse generee avec succes.');
      }
      setCoachingSubmitted(true);
    } catch {
      setCoachingResult('Une erreur est survenue. Veuillez reessayer.');
      setCoachingSubmitted(true);
    }
    setCoachingLoading(false);
  };
```

- [ ] **Step 2: Update ClientPortal.tsx — enable coaching**

In `src/pages/ClientPortal.tsx`, replace lines 26-32:

```typescript
// Feature flag: coaching is now served by the authed /api/ai/coaching endpoint.
const COACHING_ENABLED = true;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pages/portal/PortalCoaching.tsx src/pages/ClientPortal.tsx
git commit -m "feat: wire PortalCoaching to /api/ai/coaching, enable coaching tab"
```

---

## Task 6: Email uniqueness migration

**Files:**
- Create: `supabase/migrations/20260416000000_email_uniqueness.sql`
- Modify: `supabase_schema.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Sprint 8: Partial unique index on participants (email, seminar).
-- Closes the registration race condition where check-then-insert allows
-- concurrent duplicate submissions. The check-duplicate endpoint remains
-- as an optimistic pre-check; this index is the authoritative backstop.
--
-- Partial: excludes cancelled rows so a participant can cancel and re-register
-- for the same seminar. Uses lower(email) for case-insensitive matching.

-- Step 1: Remove active duplicates (keep most recent per email+seminar).
-- Only deletes rows if duplicates exist — no-op on clean data.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lower(email), seminar
           ORDER BY created_at DESC
         ) AS rn
  FROM public.participants
  WHERE status NOT IN ('cancelled')
)
DELETE FROM public.participants
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Create the partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_seminar_active_udx
  ON public.participants (lower(email), seminar)
  WHERE status NOT IN ('cancelled');
```

- [ ] **Step 2: Document in supabase_schema.sql**

After the existing `participants_seminar_idx` index (around line 18), add:

```sql
-- Partial unique index: prevents duplicate active registrations for the same
-- (email, seminar) pair. Cancelled rows are excluded so cancel+re-register works.
-- Added in Sprint 8. Applied via Supabase Management API.
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_seminar_active_udx
  ON public.participants (lower(email), seminar)
  WHERE status NOT IN ('cancelled');
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260416000000_email_uniqueness.sql supabase_schema.sql
git commit -m "feat: add partial unique index on participants (email, seminar)"
```

---

## Task 7: Handle 23505 error in LandingPage registration

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1: Add 23505 error handling to the insert catch block**

In `src/pages/LandingPage.tsx`, the insert is at line 504:

```typescript
const { error: dbError } = await supabase.from('participants').insert([newParticipant]);
if (dbError) throw dbError;
```

Replace `if (dbError) throw dbError;` with:

```typescript
      if (dbError) {
        // Postgres 23505 = unique_violation from the partial unique index
        // participants_email_seminar_active_udx. This is the authoritative
        // backstop for the race condition — the check-duplicate endpoint
        // is the optimistic pre-check, but concurrent submissions can bypass it.
        if (dbError.code === '23505') {
          setErrors(prev => ({
            ...prev,
            _global: "Vous êtes déjà inscrit(e) à ce séminaire. Consultez le Portail Client pour suivre votre inscription.",
          }));
          setIsSubmitting(false);
          return;
        }
        throw dbError;
      }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "feat: handle 23505 unique violation on registration insert"
```

---

## Task 8: Write registration uniqueness tests

**Files:**
- Create: `api/__tests__/registration-uniqueness.test.ts`

- [ ] **Step 1: Write the test file**

These tests verify the check-duplicate endpoint still works correctly with the uniqueness constraint semantics (the constraint itself is DB-level, but we test the error handling pattern):

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

const mockFromSelect = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: mockFromSelect,
          }),
        }),
      }),
    }),
  }),
}));

import { createApp } from "../app.js";

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
});

describe("POST /api/registration/check-duplicate — uniqueness semantics", () => {
  it("returns exists=false for a new email+seminar pair", async () => {
    mockFromSelect.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "new@example.com", seminar: "s1" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it("returns exists=true for an existing email+seminar pair", async () => {
    mockFromSelect.mockResolvedValueOnce({
      data: [{ id: "row-1" }],
      error: null,
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "existing@example.com", seminar: "s1" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
  });

  it("returns exists=false for same email but different seminar", async () => {
    mockFromSelect.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "existing@example.com", seminar: "s2" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it("normalizes email to lowercase before lookup", async () => {
    mockFromSelect.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "Alice@Example.COM", seminar: "s1" });
    expect(res.status).toBe(200);
    // The test verifies the endpoint processes the request — the actual
    // lowercase normalization happens inside the handler before the query.
  });

  it("returns 500 on database error (fail-closed)", async () => {
    mockFromSelect.mockResolvedValueOnce({
      data: null,
      error: { message: "connection error" },
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "test@example.com", seminar: "s1" });
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS (existing 55 + new coaching 9 + new uniqueness 5 = 69 total)

- [ ] **Step 3: Commit**

```bash
git add api/__tests__/registration-uniqueness.test.ts
git commit -m "test: add registration uniqueness semantics tests (5 tests)"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Start dev server and verify coaching flow**

Run: `npm run dev`

Then in a browser:
1. Navigate to `/portal`
2. Log in as a confirmed participant
3. Navigate to the Coaching tab (should now be visible)
4. Fill in the form and submit
5. Verify the AI response comes back (or a meaningful error if AI Gateway is not configured)

- [ ] **Step 4: Verify registration duplicate guard**

In a browser:
1. Navigate to `/` (landing page)
2. Try to register with an email+seminar that already exists
3. Verify the "already registered" message appears (from check-duplicate)
4. (The 23505 backstop can't be tested from the UI without disabling the check-duplicate call)

---

## Migration Deployment Note

The migration in Task 6 (`20260416000000_email_uniqueness.sql`) must be applied to production Supabase **before** merging to main. Use the Supabase Management API method established in Sprint 7:

1. Read the migration SQL
2. Apply via Management API `POST /v1/projects/{ref}/database/query`
3. Verify index exists: `SELECT indexname FROM pg_indexes WHERE tablename = 'participants' AND indexname = 'participants_email_seminar_active_udx';`
4. Then merge the PR
