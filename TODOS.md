# TODOS — RMK Seminar Manager

Living list of known work items, tracked outside of sprint plans. Items get promoted to PRs or issues as they're scheduled.

## P1 — from /ship review on Improvements branch

### A. Early-bird deadline is client-side only (bypassable)

**Why:** `LandingPage.tsx:446` computes `isEarlyBird` in the browser from `new Date()` and the selected atelier's `dates.start`. The computed `amount` is then inserted directly into `participants` via the anon Supabase client (`LandingPage.tsx:514`). A user with dev-tools can modify the payload and pay the early-bird price after the cutoff, or lower the amount entirely. Both Gemini and Qwen flagged this during the /ship review.

**Work:** Compute authoritative pricing server-side when the CinetPay `/api/payments/init` endpoint is built (see `docs/superpowers/plans/2026-04-17-cinetpay-payments.md`). Server reads `SEMINARS` + current date, derives the price, ignores the client-sent amount. Until that endpoint exists, this gap is latent.

**Impact:** Revenue leakage — small, since the discount is only 10% and our buyer pool is trust-verified via follow-up call. But still a real gap.

<!-- B. Timezone-unsafe date parsing — RESOLVED 2026-04-18.
     All four call-sites in `LandingPage.tsx` (countdown, early-bird cutoff,
     `formatDeadline` helper) and `seminars.ts` (`EARLY_BIRD_DEADLINE` fallback)
     now append `Z` to ISO strings, anchoring them to UTC. The Atelier runs in
     Abidjan (UTC+0, no DST), so UTC interpretation matches business intent.
     `formatDeadline` also switched to getUTCDate / setUTCDate / getUTCMonth to
     avoid off-by-one calendar rendering for non-UTC visitors near midnight.
     Regression guarded by `e2e/landing-timezone.spec.ts` (pins Europe/Paris,
     freezes clock, asserts countdown renders the UTC-anchored diff). -->

## P1 — follow-up from PR #3 review

<!-- 1. Authed /api/ai/coaching endpoint + re-enable Coaching tab — SHIPPED.
     Verified 2026-04-18 during TODOS audit: endpoint lives at api/app.ts:817,
     protected by requireAuth + coachingLimiter (5/min) + .eq(status,confirmed)
     participant gate. Template + sanitizeText at api/prompts.ts:235 / api/app.ts:872.
     10 Vitest tests green at api/__tests__/coaching.test.ts. COACHING_ENABLED = true
     at src/pages/ClientPortal.tsx:27. Client path at src/lib/coachingApi.ts.
     No hardcoded mock fallback remains. -->

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

**Also surfaces as test flake (2026-04-18):** `e2e/security-hardening.spec.ts:117` intentionally exhausts the `/api/portal/lookup` limiter (`max=3/60s`), which poisons the in-memory store for ~60s. Three subsequent tests on the same endpoint (`86`, `93`, `100`) then see `429` instead of `400`/`200`. Even with `--workers=1` the tests still flake. Ordering the test file so the rate-limit exhaustion test runs *last* is a band-aid; the real fix is either (a) Redis-backed limiter with a per-test key prefix that tests can flush, or (b) a test-only bypass header on the limiter gated by `NODE_ENV=test`.

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

<!-- 13. Seminar capacity not enforced server-side — RESOLVED 2026-04-18.
     Postgres BEFORE INSERT OR UPDATE trigger on participants joins
     public.seminars for the seat count, serializes concurrent inserts per
     seminar via pg_advisory_xact_lock, and raises SQLSTATE P0013
     'Atelier complet' when full. Migration:
     supabase/migrations/20260418000000_seminar_capacity_trigger.sql.
     Landing page reads public.get_seminar_capacity() (SECURITY DEFINER
     function, not a view, to avoid PG-version-dependent RLS behaviour) on
     mount to disable full options; handles P0013 via the shared
     src/lib/errors.ts utility. Trigger fail-opens for unknown seminar ids
     (pack2/pack4 — see TODOS #14). Error-mapping unit at
     api/__tests__/capacity-error.test.ts (7 passing). Trigger itself
     validated manually against a Supabase preview branch per the plan at
     docs/superpowers/plans/2026-04-18-seminar-capacity-enforcement.md. -->

### 14. Pack registrations (pack2/pack4) have no capacity enforcement

**Why:** The enforce_seminar_capacity trigger fail-opens for any seminar id
not present in `public.seminars` — this is intentional for legacy data but
means pack2/pack4 buyers bypass the 20-seat-per-atelier cap entirely. A
user buying `pack4` occupies a seat in each of S1–S4 conceptually, but the
current schema stores `seminar='pack4'` as a single row with no link to
the four underlying ateliers.

**Options:**
- **A. Explode packs at registration.** Insert 4 rows (one per atelier) when
  someone buys pack4, 2 rows (user-chosen) for pack2. Each row goes through
  the capacity trigger normally. Requires: pack→ateliers mapping in the
  form, plus a `participant_pack_id` FK so refunds/cancellations stay
  atomic. Medium refactor.
- **B. Join table.** New `participant_seminars` join — one participant row,
  N seminar rows. Cleaner long-term but touches portal, dashboard, billing,
  notifications. Large refactor (also TODOS #2 is adjacent).
- **C. Pack-level cap.** Add `pack_seats` on a new `packs` table, count
  active pack registrations against it. Doesn't solve individual-atelier
  oversell if 20 pack4 buyers plus 20 s1 buyers all register — s1 would
  have 40 attendees. Not recommended.

Recommended: A for the near term; promote to B when TODOS #2 is scheduled.

## P3 — nice-to-haves

### 10. Community post date from `created_at`

`api/app.ts:657` stores `date` as `YYYY-MM-DD` from server UTC. If infra ever runs outside UTC+0, the displayed date shifts by a day around midnight. Prefer deriving the display date from `created_at` at read time.

### 11. Drop `post-` prefix on community_posts.id

Cosmetic. The prefix costs the ability to index `community_posts.id` as native UUID and offers no discoverability benefit.

---

_Last updated: 2026-04-18 — Fixed P0 #0 (portal E2E tests rewritten to match 4-step onboarding UX; Playwright now auto-starts the dev server via `webServer` config). Fixed P1-B (TZ-unsafe date parsing — all four call-sites anchored to UTC; regression guarded by `e2e/landing-timezone.spec.ts`). Pruned P1 #1 (coaching endpoint — already shipped; audited + verified). Fixed P2 #13 (server-side seminar capacity enforcement via Postgres trigger + advisory lock + SECURITY DEFINER capacity function). Added #14 (pack capacity follow-up). Surfaced rate-limit test flake into P2 #7._
