# P1: Coaching Endpoint + Email Uniqueness Constraint

**Date:** 2026-04-16
**Status:** Approved
**Branch:** TBD (will be created during implementation)

## Overview

Two P1 follow-ups from Sprint 7:

1. **Authed coaching endpoint** — new `POST /api/ai/coaching` for confirmed participants to get AI coaching specific to their seminar. Replaces the broken `/api/ai/generate` call in PortalCoaching (wrong auth model, wrong request shape, shows mock data).
2. **Email uniqueness constraint** — partial unique index `(lower(email), seminar) WHERE status NOT IN ('cancelled')` on participants table. Authoritative backstop for the check-then-insert registration race.

## 1. Coaching Endpoint

### Endpoint

`POST /api/ai/coaching`

### Auth Chain

```
coachingLimiter (5/min) → requireAuth (Supabase JWT) → handler
```

- **Rate limit:** `coachingLimiter` at 5 requests/min per IP. Higher than community's 3/min because AI responses take longer and users are more likely to retry on timeout. Uses the same `express-rate-limit` in-memory store pattern as all other limiters.
- **Auth:** `requireAuth` middleware verifies Supabase JWT from `Authorization: Bearer <token>` header, extracts `userEmail` into `req.userEmail`.
- **No `requireAdmin`** — this is a participant-facing endpoint, not admin-only.

### Participant Lookup

```typescript
const { data: rows } = await supabaseService
  .from("participants")
  .select("id, nom, prenom, email, seminar, status")
  .eq("email", userEmail)
  .eq("seminar", seminar)
  .eq("status", "confirmed")
  .order("created_at", { ascending: false })
  .limit(1);
```

- Matches by email + seminar + confirmed status.
- `.order().limit(1)` pattern (not `.maybeSingle()`) for multi-row safety, consistent with `/api/community/post`.
- Unified 403 for "no registration" and "not confirmed" — no email/status enumeration.

### Request Validation

Zod schema:

```typescript
const coachingRequestSchema = z.object({
  seminar: z.string().min(1).max(100),
  userPrompt: z.string().min(1).max(1000),
});
```

- `seminar`: identifies which registration to use (participant may be confirmed for multiple seminars).
- `userPrompt`: the participant's coaching question. Sanitized server-side via `sanitizeText()` (strip control chars, re-validate non-empty post-sanitize).

### Prompt Template

New `coaching` entry in `PROMPT_TEMPLATES` (`api/prompts.ts`):

**Template variables:**
- `{{prenom}}` — participant's first name
- `{{nom}}` — participant's last name
- `{{seminar_title}}` — seminar title from `src/data/seminars.ts`
- `{{seminar_description}}` — seminar description
- `{{seminar_objectives}}` — seminar learning objectives (joined as bullet list)
- `{{seminar_program}}` — seminar program/modules
- `{{userPrompt}}` — the participant's question (sanitized)

All variables escaped via existing `safe()` function before injection.

**System prompt direction:** Expert AI coach for the specific seminar. Responds in French. References the seminar content to give targeted, actionable coaching. Does not fabricate information about the seminar beyond what's provided in the context.

**Seminar data source:** Import from `src/data/seminars.ts`, look up by `participant.seminar` field matching `seminar.id`. If no match found, return 400 (invalid seminar).

### Response Shape

```typescript
{ text: string }
```

Same shape as `/api/ai/generate`. The AI-generated coaching response.

### Error Handling

| Condition | Response |
|-----------|----------|
| Missing/invalid bearer token | 401 `{ error: "Unauthorized" }` |
| No confirmed participant for email+seminar | 403 `{ error: "Access denied" }` |
| Invalid request body (Zod) | 400 `{ error: "..." }` |
| Seminar ID not found in catalog | 400 `{ error: "Unknown seminar" }` |
| Gemini API failure | 502 `{ error: "AI service temporarily unavailable" }` |
| Rate limited | 429 `{ error: "Too many requests..." }` |
| Supabase not configured | 503 `{ error: "Service not configured" }` |

### Client Changes

**`src/pages/portal/PortalCoaching.tsx`:**
- Replace `/api/ai/generate` call with `POST /api/ai/coaching`
- Send `{ seminar, userPrompt }` with Supabase session bearer token from auth context
- Remove hardcoded system prompt (now server-side in template)
- Remove fallback mock response — show real error state on failure
- Seminar value comes from the participant's registration data already loaded in ClientPortal

**`src/pages/ClientPortal.tsx`:**
- Set `COACHING_ENABLED = true`
- Remove the comment explaining why it was disabled

## 2. Email Uniqueness Constraint

### Migration

```sql
-- Step 1: Deduplicate active rows (keep most recent per email+seminar)
-- Only runs if duplicates exist
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

-- Step 2: Create partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS participants_email_seminar_active_udx
  ON public.participants (lower(email), seminar)
  WHERE status NOT IN ('cancelled');
```

### Constraint Semantics

- **Case-insensitive:** Uses `lower(email)` so `Alice@Example.com` and `alice@example.com` are treated as the same email.
- **Per-seminar:** Same email can register for different seminars (different key values).
- **Partial:** Only applies to non-cancelled rows (`WHERE status NOT IN ('cancelled')`). A cancelled registration does not block re-registration for the same seminar.
- **Named `_udx`:** Signals partial unique index (not a full table constraint).

### Allowed Scenarios

| Scenario | Allowed? |
|----------|----------|
| `alice@ex.com` registers for seminar-ia | Yes |
| `alice@ex.com` registers for seminar-data | Yes (different seminar) |
| `alice@ex.com` registers for seminar-ia again (first is pending) | No (duplicate blocked) |
| `alice@ex.com` cancels seminar-ia, then re-registers | Yes (cancelled row excluded from index) |

### Insert Error Handling

**`src/pages/LandingPage.tsx` (registration form):**
- Catch Postgres error code `23505` (unique_violation) on the Supabase insert
- Display user-friendly message: "Vous etes deja inscrit(e) a ce seminaire" (with proper accents in actual implementation)
- The existing `check-duplicate` endpoint remains as the optimistic pre-check (disables submit button before the user even tries). The DB constraint is the authoritative backstop for race conditions.

### Migration Strategy

Applied via Supabase Management API (same method used for Sprint 7 Phase 1 and Phase 3 migrations), not Supabase CLI. This avoids migration-history drift between local and remote.

## Testing

### Coaching Endpoint Tests

- Auth: 401 without token, 401 with expired token
- Access: 403 for non-existent participant, 403 for unconfirmed participant
- Validation: 400 for missing seminar, 400 for empty userPrompt, 400 for userPrompt > 1000 chars
- Happy path: 200 with `{ text }` response for confirmed participant (mock Gemini response in test)
- Rate limit: 429 after 5 requests in 1 minute
- Seminar lookup: 400 for invalid seminar ID not in catalog

### Email Uniqueness Tests

- Insert duplicate (email, seminar) with status=pending: expect 23505 error
- Insert same email, different seminar: expect success
- Insert same email+seminar after cancelling first: expect success
- Case insensitivity: `Alice@Ex.com` + `alice@ex.com` same seminar: expect 23505

### Client Tests

- PortalCoaching: renders coaching form, submits to correct endpoint with bearer token
- LandingPage: shows French duplicate message on 23505 error

## Files Modified

| File | Change |
|------|--------|
| `api/app.ts` | New `coachingLimiter`, new `POST /api/ai/coaching` handler |
| `api/prompts.ts` | New `coaching` template in `PROMPT_TEMPLATES` |
| `src/pages/portal/PortalCoaching.tsx` | Replace API call, remove mock, add bearer token |
| `src/pages/ClientPortal.tsx` | `COACHING_ENABLED = true`, remove disable comment |
| `src/pages/LandingPage.tsx` | Handle 23505 error with French duplicate message |
| `supabase/migrations/20260416000000_email_uniqueness.sql` | Dedup + partial unique index |
| `supabase_schema.sql` | Document the new index |
| `api/__tests__/` | New coaching endpoint tests + email uniqueness tests |
