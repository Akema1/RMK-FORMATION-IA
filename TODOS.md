# TODOS — RMK Seminar Manager

Living list of known work items, tracked outside of sprint plans. Items get promoted to PRs or issues as they're scheduled.

## P1 — follow-up from PR #3 review

### 1. Authed `/api/ai/coaching` endpoint + re-enable Coaching tab

**Why:** `PortalCoaching.tsx:92` currently posts to `/api/ai/generate` with a malformed payload and no admin auth. The call always 400/401/403s, so participants see a hardcoded mock "analysis" every time. For PR #3 the Coaching tab is feature-flagged OFF via `COACHING_ENABLED = false` in `src/pages/ClientPortal.tsx`. Shipping it fake is not acceptable.

**Work:**
- New endpoint `POST /api/ai/coaching` — pattern matches `POST /api/community/post`: `requireAuth` + participant lookup + `status === "confirmed"` gate + rate limit.
- New `coaching` templateId in `api/prompts.ts` with `safe()`-escaped vars (defi, entreprise, secteur, role, objectif).
- Vitest coverage mirroring `community.test.ts`: auth 401, not-confirmed 403, happy path 200, rate limit, prompt-injection in user fields.
- Flip `COACHING_ENABLED = true` after end-to-end preview test.
- Delete the hardcoded fallback string in `PortalCoaching.tsx:101-114`.

### 2. Participant email uniqueness — business rule decision

**Why:** `participants.email` has NO unique constraint (`supabase_schema.sql:18` is an index, not a unique index). Sprint 7 Phase 3 supports multi-seminar registration (one email = N participant rows), which is the product's intended behavior. The community post endpoint now uses `.order("created_at",desc).limit(1)` to handle this, but "which seminar feed does the user post into when they're registered for multiple?" is answered implicitly (most recent). That may or may not be what the product wants long-term.

**Open questions:**
- Should the portal show a seminar-picker on the Community tab when the user has multiple confirmed registrations?
- Should the dashboard let a dual-registrant view their S1 vs S2 programme independently (today it's single `seminar` on the participant row; picking "most recent" is ambiguous)?
- Do we want `participant_seminars` as a join table instead of `participants.seminar text`?

**Work (depends on the decision):**
- If join table: migration + code refactor across portal, admin, billing. Large.
- If status quo (most-recent wins): add an explicit UI indicator + a seminar-picker on the Community tab.

## P2 — inherited from upstream Sprint 7 port

### 3. `FinancePage.tsx` / `SeminarsManagement.tsx` settings upsert race

Read-modify-write on a single JSONB `settings` row. Two admins editing different seminars concurrently → last writer wins. Fix: refetch-then-merge before upsert, or split budgets/pricing into per-seminar rows in a dedicated table.
**Blast radius:** 2 active admins — low probability, real data loss when triggered.

### 4. `/api/notify-registration` task idempotency

Every call creates two "tasks" rows (`[Onboarding] Vérifier dossier` + `[Finance] Confirmer paiement`). Client retry or webhook double-delivery = duplicate task rows. Fix: dedup key (e.g. `UNIQUE (seminar, participant_id, task_type)`) on `tasks`, or an idempotency key on the endpoint.
**Blast radius:** low — admin can delete dupes, but pollutes the task list.

### 5. `/api/lead/capture` task-flood DoS

Public endpoint with 5/min per-IP rate limit, but each success creates a high-priority "[Commercial] Rappeler le prospect" task assigned to alexis. Rotating IPs → task list flooded. Fix: captcha on the lead magnet form, or server-side dedup on `(nom, contact)` within a time window.
**Blast radius:** medium — degrades operational workflow, not data loss.

### 6. `schema_reshape_upstream.sql` `DROP TABLE ... CASCADE` verification

`supabase/migrations/20260413120500_schema_reshape_upstream.sql` uses `DROP TABLE tasks CASCADE` and same for expenses. The data-loss guard checks row count but not dependent objects. Before applying to prod, run `SELECT conname, conrelid::regclass FROM pg_constraint WHERE confrelid = 'public.tasks'::regclass;` on prod to confirm no FKs point at these tables. If empty, safe. If non-empty, needs a different migration path.

### 7. Redis-backed rate limiter

`express-rate-limit` uses an in-memory store. On Vercel Fluid Compute this is per-instance, not shared across concurrent instances, so the documented limits (20/min AI, 5/min lead, 3/min community) are really "up to N per instance". Affects all limiters: `aiLimiter`, `leadLimiter`, `notifyLimiter`, `communityLimiter`. Fix: `rate-limit-redis` adapter backed by Upstash (already in the Supabase marketplace stack) or Vercel KV.

### 8. `SeminarsManagement.tsx` schema-drift string parsing

Error recovery relies on `error.message.includes('Could not find')` to detect missing columns and retry the insert with a reduced payload. Fragile to Supabase error-format changes between CLI/SDK versions. Fix: prefer explicit `information_schema.columns` probing, or drop the fallback and rely on migrations being applied consistently.

### 9. `SeminarsManagement.tsx:~179` isValidUUID update-vs-insert

Gemini flagged (unverified in this session): `isValidUUID` check in `attemptSave` may cause an insert-instead-of-update when the seminar id is a legacy human-readable string like "s1" instead of a UUID. Needs verification — if confirmed, fix the upsert logic to match on whatever id format actually exists.

### 12. Twilio WhatsApp channel — documented but unconfigured

**Why:** `api/app.ts:571-586` sends a WhatsApp confirmation via Twilio when a participant registers with a phone number. Verified 2026-04-17: zero `TWILIO_*` env vars are set in any Vercel environment (production, preview, development). The guard short-circuits cleanly, so registrations email-only today. `.env.example` still lists all three vars as if configured. Email from Resend covers the confirmation channel, so nothing is broken for users — but the WhatsApp path is dead code in prod.

**Decision:** deferred past May 2026 launch. WhatsApp Business API provisioning requires Meta Business Manager approval (1-5 business days) plus message-template pre-approval — too much lead time for the current cycle. Email is sufficient for a capped paid seminar with manual follow-up.

**Work when un-deferred:**
- Apply for WhatsApp Business via Meta Business Manager and get a dedicated number.
- Pre-approve the registration confirmation as a message template (outbound to cold users needs templated sends).
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` to Vercel (all three environments).
- Smoke test via a real registration with a reachable phone number; confirm the template renders correctly.

## P3 — nice-to-haves

### 10. Community post date from `created_at`

`api/app.ts:657` stores `date` as `YYYY-MM-DD` from server UTC. If infra ever runs outside UTC+0, the displayed date shifts by a day around midnight. Prefer deriving the display date from `created_at` at read time.

### 11. Drop `post-` prefix on community_posts.id

Cosmetic. The prefix costs the ability to index `community_posts.id` as native UUID and offers no discoverability benefit.

---

_Last updated: 2026-04-17 — Added P2 #12 (Twilio WhatsApp deferral)._
