# Production Readiness Audit — RMK Seminar Manager

**Date:** 2026-04-11
**Branch:** `feat/ai-gateway-migration`
**Stack:** React 19 + Vite 6 SPA, Express.js backend (Vercel serverless), Supabase PostgreSQL, Claude Haiku via Vercel AI Gateway

---

## Scorecard

| Dimension | Critical | High | Medium | Low |
|-----------|----------|------|--------|-----|
| Security & API | 3 | 4 | 5 | 6 |
| Deployment & Infra | 2 | 4 | 7 | 5 |
| **Total** | **5** | **8** | **12** | **11** |

---

## CRITICAL (5) — Deploy Blockers

### 1. Row Level Security Disabled on All Tables

**File:** `supabase_schema.sql:68-73`

All five tables have RLS explicitly disabled. The anon key is public in the browser bundle — without RLS, anyone can read/write all participant data, leads, tasks, and expenses directly via the Supabase REST API.

**Impact:** Full database exposure. Confidential participant data (names, emails, phone numbers, payment status) is unprotected.

**Fix:** Enable RLS and create policies — public read for participant self-lookup (email + nom), admin-only for everything else.

---

### 2. Admin Auth Fallback — Auto-Login Without Credentials

**File:** `src/pages/AdminDashboard.tsx:1765-1769`

If Supabase env vars are missing (misconfiguration, deployment failure), the app auto-authenticates as admin with no password. The entire admin dashboard becomes publicly accessible.

**Fix:** Throw a hard error instead of auto-authenticating.

---

### 3. Dead GEMINI_API_KEY Define in Vite Config

**File:** `vite.config.ts:11`

The app has migrated to Claude Haiku via Vercel AI Gateway. This `define` block is dead code — the key is empty/unused. However, the pattern is dangerous: if the env var is ever set, it leaks into the production JS bundle.

**Fix:** Remove the `define` block entirely.

---

### 4. Missing JWT in Admin API Calls

**File:** `src/pages/AdminDashboard.tsx:46-56`

The `callGemini()` function calls `/api/ai/generate` without an Authorization header. The backend requires `requireAuth` middleware with a Bearer token, so these calls will fail with 401.

**Fix:** Fetch the current user's JWT from Supabase and include it as `Authorization: Bearer <token>`.

---

### 5. TypeScript Strict Mode Disabled

**File:** `tsconfig.json`

No `"strict": true`, `"noImplicitAny"`, or `"strictNullChecks"`. Type errors that would be caught at compile time will silently fail at runtime.

**Fix:** Add `"strict": true` and resolve resulting errors.

---

## HIGH (8)

### 6. Secrets in `.env` File

Service role key, AI Gateway API key, and webhook secret are stored in plaintext. If `.env` was ever committed to git, these keys are permanently exposed.

**Fix:** Use `vercel env pull` exclusively. Verify git history. Rotate keys if previously committed.

### 7. CORS Regex Allows All Vercel Preview Branches

**File:** `api/index.ts:36-48`

Any preview branch deployment is CORS-allowed. If PRs from forks trigger preview builds, CSRF attacks are possible.

**Fix:** Whitelist specific preview URLs or restrict to authenticated previews only.

### 8. Webhook Uses Plain String Comparison (Not HMAC)

**File:** `api/index.ts:118-127`

No `crypto.timingSafeEqual()`, no HMAC-SHA256 body signature verification. Vulnerable to timing side-channel attacks.

**Fix:** Implement HMAC signature verification with `crypto.timingSafeEqual()`.

### 9. Rate Limiter Resets on Serverless Cold Start

**File:** `api/index.ts:68-91`

`express-rate-limit` defaults to in-memory store. Vercel Functions restart frequently — rate limit state is lost on each cold start.

**Fix:** Use a distributed store (Redis via Upstash) or Vercel's platform-level rate limiting.

### 10. No Input Validation Schema on API Endpoints

**File:** `api/index.ts:164-181`

Registration notifications only check for `email` and `seminar` existence. No email format validation, no phone E.164 validation, no field length limits.

**Fix:** Add `zod` schema validation on all API endpoints.

### 11. AI Endpoint Accepts Arbitrary System Prompts

**File:** `api/index.ts:256-285`

`systemPrompt` is completely user-controlled from the client. Could be used for prompt injection.

**Fix:** Define allowed system prompt templates server-side.

### 12. Missing Security Headers

**File:** `vercel.json`

No CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy.

**Fix:** Add security headers to `vercel.json`.

### 13. No Error Tracking / Monitoring

No Sentry or error dashboard. Only `console.error()` in catch blocks.

**Fix:** Add Sentry or use Vercel's built-in log drain.

---

## MEDIUM (12)

| # | Finding | Location |
|---|---------|----------|
| 14 | Portal lookup enables email enumeration (returns empty array vs not-found) | `api/index.ts:232-251` |
| 15 | Twilio WhatsApp recipient phone not validated (E.164 format) | `api/index.ts:213-218` |
| 16 | No pagination on admin data fetches — loads all rows into memory | `src/pages/AdminDashboard.tsx` |
| 17 | No audit logging for admin actions (who changed what, when) | — |
| 18 | No database constraints — seats can be negative, status not enum'd, no FK | `supabase_schema.sql:30-46` |
| 19 | No backup/disaster recovery plan documented | — |
| 20 | Cron job errors are silent — no alerting, no retry logic | `server.ts:334-347` |
| 21 | Dev/prod security parity gap — `server.ts` has weaker CORS than `api/index.ts` | `server.ts:26-31` |
| 22 | Playwright tests hardcoded to wrong port (3000 vs 8080) | `playwright.config.ts:11` |
| 23 | No `npm audit` in CI or pre-commit hooks | — |
| 24 | No response size limits on Express JSON parsing | `api/index.ts`, `server.ts` |
| 25 | Unencrypted `.env` file — keys in plaintext on disk | `.env` |

---

## LOW (11)

| # | Finding | Location |
|---|---------|----------|
| 26 | Console errors could leak stack traces to client | `AdminDashboard.tsx:89` |
| 27 | Unsafe innerHTML pattern for print CSS (currently hardcoded/safe) | `AdminDashboard.tsx:433` |
| 28 | localStorage stores unsanitized AI responses | `AdminDashboard.tsx:219` |
| 29 | No bundle size monitoring or analysis | — |
| 30 | No HTTPS enforcement in dev server | `server.ts:28` |
| 31 | AI message count/length not capped | `api/index.ts:262-273` |
| 32 | Missing meta/og tags for SEO | `index.html` |
| 33 | No React error boundaries | — |
| 34 | No build output analysis tooling | — |
| 35 | Rate limiter IP spoofing possible (missing trust-proxy config) | `api/index.ts:69` |
| 36 | CRON job has no error recovery | `server.ts:334-347` |

---

## Gemini Remnants (Post-Migration Cleanup)

The backend has been fully migrated to Claude Haiku via Vercel AI Gateway. These Gemini references remain as cosmetic artifacts:

| Type | Location | Action |
|------|----------|--------|
| Function named `callGemini()` | `AdminDashboard.tsx:46` | Rename to `callAI()` |
| 3 calls to `callGemini()` | `AdminDashboard.tsx:233, 1543, 1627` | Update with rename |
| `GEMINI_API_KEY` in Vite define | `vite.config.ts:11` | Remove (dead code) |
| Comment "Convert Gemini message format" | `server.ts:250`, `api/index.ts:261` | Update comment |
| "Gemini" in seminar curriculum text | `ClientPortal.tsx:15` | Keep — refers to the AI product as training topic |

---

## Recommended Fix Priority

| Priority | Fix | Effort |
|----------|-----|--------|
| 1 | Enable RLS on all Supabase tables + create policies | ~1h |
| 2 | Remove dead `GEMINI_API_KEY` define from `vite.config.ts` | 5min |
| 3 | Remove admin auth fallback — throw error instead of auto-login | 15min |
| 4 | Add JWT to API calls / rename `callGemini` to `callAI` | 30min |
| 5 | Add security headers to `vercel.json` | 30min |
| 6 | Add input validation with `zod` on all API endpoints | 1h |
| 7 | Enable TypeScript strict mode and fix errors | 1-2h |
| 8 | Add HMAC webhook verification | 30min |

**Estimated total effort for production readiness: 5-6 hours**

---

## Strengths

The app already has solid foundations in several areas:

- Input sanitization (`escapeHtml`, `escapeLike`, `sanitizeText`) on API endpoints
- CORS validation with regex for preview URLs
- Rate limiting on all public-facing endpoints
- `requireAuth` middleware on protected endpoints
- `requireWebhookSecret` on webhook endpoints
- Graceful degradation when optional services (Resend, Twilio) are unconfigured
- Lazy-loaded page components for code splitting
- AI Gateway migration provides provider flexibility and observability
