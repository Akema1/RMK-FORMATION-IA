# Onboarding Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-gemini-plugin:subagent-driven-development (recommended) or superpowers-gemini-plugin:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the participant onboarding flow end-to-end so the public form captures acquisition channel, the post-submit experience surfaces payment instructions immediately (manual rails: Wave + Orange Money + bank transfer, all via +225 07 02 61 15 82), unconfirmed users see a useful pending portal screen, admins confirm payment with a single click, and confirmed participants pass through an optional 5-question first-visit survey that persists answers and unlocks a personalized recommendation.

**Architecture:** Manual payment reconciliation in v1 (Flutterwave webhook drop-in deferred to a Phase 2 plan once the merchant account exists). All transactional emails route through Resend (already configured) — including Supabase Auth magic links, sent server-side via `auth.admin.generateLink()`. Schema is forward-compatible with Flutterwave: `payment_provider` and `payment_reference` columns reserve the integration surface today. Survey answers persist to a dedicated `participant_survey` table; recommendation is computed once at completion and stored, not recomputed each visit. SLA enforcement runs as a daily Vercel cron.

**Tech Stack:** Express 5 + TypeScript on the server, React 19 + Vite + React Router on the client, Supabase Postgres + Supabase Auth, Resend for transactional email, Twilio for WhatsApp (existing), Tailwind v4 + shadcn/ui, vitest + supertest for backend tests, Playwright for e2e.

---

## Decisions locked from spec discussion

These are non-negotiable for this plan. Any deviation requires a spec amendment, not an implementation choice.

| # | Decision |
|---|---|
| D1 | Acquisition channel options: `Recommandation`, `LinkedIn`, `Facebook`, `Instagram`, `Google`, `Email`, `Évènement`, `Autre`. |
| D2 | If channel = `Recommandation` → required text field "Nom de la personne qui vous recommande" with disclosure "Avec son accord, nous pourrons le remercier". |
| D3 | If channel = `Autre` → required text field "Précisez". For all other channels, an optional "Précisez (optionnel)" text field. |
| D4 | CGU/Politique de confidentialité consent checkbox is **required** to submit. Records `consent_at` timestamp. |
| D5 | Payment rails (manual, v1): **Wave** + **Orange Money** + **Virement bancaire**. **MTN MoMo is not offered.** All three rails contact +225 07 02 61 15 82 (also WhatsApp). |
| D6 | Payment reference format: `RMK-2026-XXXX` where XXXX is a 4-character Crockford-base32 code derived deterministically from the participant UUID via FNV-1a hash. Generated server-side at insert time. Stored in `participants.payment_reference` (UNIQUE). Collisions (~5% probability at 10k rows by birthday paradox) are handled by a regenerate-and-retry loop on `INSERT` (max 3 attempts, then fall back to a longer suffix). Spec amended from "first 4 chars of base32 UUID" because that approach has the same collision space without the determinism property. |
| D7 | Reference is displayed prominently (large monospace block, copy button) on post-submit screen, in confirmation email, and on pending portal screen. Always paired with explicit instruction: "Saisissez ce code dans le champ « motif » lors de votre paiement." |
| D8 | Wave and Orange Money brand logos (official SVGs) shown next to their respective rows. PNG fallbacks (@2x retina) for email. Files live in `public/payment-logos/`. |
| D9 | Duplicate registration UX is **state-aware** (see Task 5 dedup matrix). Schema-level uniqueness is unchanged (`participants_email_seminar_active_udx`). |
| D10 | Magic-link emails are sent **via Resend**, not Supabase's built-in SMTP. Token generation uses `supabase.auth.admin.generateLink()`. Built-in Supabase magic-link emails are disabled. |
| D11 | Magic-link endpoint never reveals account existence (always returns 200) — anti-enumeration. |
| D12 | First-visit survey is **5 questions, optional but prominent**: blocking modal on first dashboard visit with "Plus tard" dismiss, persistent banner thereafter until completed. Q3 + Q4 from the original spec are **merged** into one expertise question. |
| D13 | Survey answers persist to a new `participant_survey` table on every answer (not just on completion). `participants.onboarding_completed_at` is set when all 5 are answered. |
| D14 | Recommendation is computed at survey completion, stored in `participant_survey.recommendation`, and a personalized "Voici votre parcours recommandé" follow-up email is sent via Resend. |
| D15 | Admin Inscriptions page gains 3 columns (Canal, Réf. paiement, Paiement) and a one-click "Marquer payé" action that sets `payment='paid'` AND `status='confirmed'` in a single transaction, triggering the welcome email. |
| D16 | SLA reminder cron runs daily 09:00 UTC via Vercel Cron, emails ADMIN_NOTIFY_EMAILS for any `pending`/`pending` row older than 48h. |
| D17 | Pending portal screen shows payment instructions block, brochure download CTA, and payment-state-aware copy ("En attente de paiement" vs "Paiement reçu, en cours de validation"). |
| D18 | Phase 2 (Flutterwave) is **explicitly deferred** to a separate plan. This plan must leave the `payment_provider` enum extensible and keep the manual flow as fallback even after Flutterwave lands. |
| D19 | Public `POST /api/register` is rate-limited: max 5 submissions per IP per 10 minutes (express-rate-limit, in-memory store acceptable for v1 since Express is single-instance). Prevents spam abuse of Resend quotas and admin inboxes. |
| D20 | Schema migration ships with a paired down migration (`*.down.sql`) for safe rollback. Audit fields `confirmed_by_admin_id UUID` and `confirmation_notes TEXT` added to `participants` for tamper-evident manual reconciliation. |

---

## File structure

### Created

| Path | Responsibility |
|---|---|
| `migrations/2026-04-25-onboarding-refresh.sql` | Schema changes (columns + new table + index). Applied via Supabase Management API; mirrored into `supabase_schema.sql`. |
| `api/lib/payment-reference.ts` | Pure function: `generatePaymentReference(uuid: string): string` → `RMK-2026-A4F2`. |
| `api/lib/render-email.ts` | Renders an email template (object → `{ subject, html, text }`) with a shared HTML layout. |
| `api/email-templates/_layout.ts` | Shared HTML envelope (header, footer, brand). Used by all templates. |
| `api/email-templates/registration-confirmation.ts` | Sent to participant on form submit. Payment instructions + reference. |
| `api/email-templates/admin-new-registration.ts` | Sent to ADMIN_NOTIFY_EMAILS on form submit. |
| `api/email-templates/magic-link.ts` | Sent when participant requests portal access. |
| `api/email-templates/welcome-confirmed.ts` | Sent when admin marks participant as paid + confirmed. Includes magic link. |
| `api/email-templates/recommendation-followup.ts` | Sent after survey completion with personalized recommendation. |
| `api/email-templates/admin-sla-reminder.ts` | Sent by daily cron when pending registrations exceed 48h. |
| `api/routes/auth-magic-link.ts` | `POST /api/auth/send-magic-link` — rate-limited, no-leak. |
| `api/routes/admin-mark-paid.ts` | `POST /api/admin/participants/:id/mark-paid` — one-click confirm. |
| `api/routes/sla-reminder.ts` | `POST /api/cron/sla-reminder` — invoked by Vercel Cron, secured by `CRON_SECRET`. |
| `api/__tests__/payment-reference.test.ts` | Unit tests for reference generator. |
| `api/__tests__/render-email.test.ts` | Snapshot tests for template rendering. |
| `api/__tests__/registration-dedup.test.ts` | Dedup matrix coverage. |
| `api/__tests__/auth-magic-link.test.ts` | Rate limit, no-leak, happy path. |
| `api/__tests__/admin-mark-paid.test.ts` | Status transition + welcome email trigger. |
| `api/__tests__/sla-reminder.test.ts` | Cron logic + email send. |
| `src/components/PaymentInstructions.tsx` | Shared block: reference, payment rails, support phone. Used by post-submit, pending portal, /paiement. |
| `src/components/CopyableReference.tsx` | The highlighted reference code with clipboard copy + toast. |
| `src/components/ChannelField.tsx` | Channel select + conditional recommender/other fields. |
| `src/components/ConsentCheckbox.tsx` | CGU/confidentialité consent with links. |
| `src/components/PostSubmitScreen.tsx` | Renders after successful registration. |
| `src/pages/Paiement.tsx` | Public route `/paiement` — single source of truth for payment info. |
| `src/pages/Cgu.tsx` | Placeholder `/cgu` page. |
| `src/pages/Confidentialite.tsx` | Placeholder `/confidentialite` page. |
| `src/pages/portal/FirstVisitSurveyModal.tsx` | Wraps existing PortalSurvey, gates on `onboarding_completed_at IS NULL`. |
| `src/pages/portal/SurveyBanner.tsx` | Persistent dismissible banner shown on dashboard until survey completed. |
| `public/payment-logos/wave.svg` | Wave brand mark (official). |
| `public/payment-logos/wave@2x.png` | Email-safe Wave fallback (96x32 px). |
| `public/payment-logos/orange-money.svg` | Orange Money brand mark (official). |
| `public/payment-logos/orange-money@2x.png` | Email-safe OM fallback (96x32 px). |
| `e2e/onboarding-flow.spec.ts` | End-to-end Playwright happy path + dedup branches. |

### Modified

| Path | Change |
|---|---|
| `supabase_schema.sql` | Append new columns and `participant_survey` table definition. |
| `api/app.ts` | Replace `/api/notify-registration` with new `/api/register` (dedup-aware), wire up new routes, swap email senders to use templated renderer. |
| `api/index.ts` | Mount new routes if not auto-discovered. |
| `src/pages/LandingPage.tsx` | Form fields (channel/recommender/consent), tel default `+225`, post-submit handler reroutes to PostSubmitScreen, surfaces dedup branches. |
| `src/pages/ClientPortal.tsx` | Replace `signInWithOtp` with `fetch('/api/auth/send-magic-link')`. Render `<FirstVisitSurveyModal>` and `<SurveyBanner>` for confirmed users with `onboarding_completed_at IS NULL`. Upgrade pending screen to use `<PaymentInstructions>`. |
| `src/pages/portal/surveyConfig.ts` | Remove old Q3 (`aiUsage`), insert new combined `niveau` question (Débutant/Intermédiaire/Avancé), remove old Q6 (`source`). Update `getRecommendation()` to read `niveau` instead of `aiUsage`. |
| `src/pages/portal/PortalSurvey.tsx` | Persist each answer to `participant_survey` via Supabase upsert. On completion, set `onboarding_completed_at`, send recommendation email. |
| `src/admin/InscriptionsPage.tsx` | Add Canal / Réf. paiement / Paiement columns. Add "Marquer payé" button. |
| `src/admin/types.ts` | Extend `Participant` type with new fields. |
| `src/App.tsx` | Routes for `/paiement`, `/cgu`, `/confidentialite`. |
| `vercel.json` | Add cron entry: `0 9 * * *` → `/api/cron/sla-reminder`. |
| `.env.example` | Document new env vars. |

### Removed (after migration)

| Path | Reason |
|---|---|
| (none) | All changes are additive. The current `/api/notify-registration` becomes a thin wrapper or is renamed to `/api/register`; no file deletions. |

---

## Environment variables (new or repurposed)

Add to `.env.example` and provision in Vercel (Production + Preview + Development) before any UI exposes the values.

```bash
# Payment contact (single phone for Wave, OM, virement, WhatsApp, support)
SUPPORT_PHONE="+225 07 02 61 15 82"

# Brand & site URLs (existing or re-use)
SITE_URL="https://rmkconseils.com"
BRAND_NAME="RMK Conseils"
EMAIL_FROM="RMK Conseils <noreply@rmkconseils.com>"

# Cron security
CRON_SECRET="<32-byte random hex>"   # generate with: openssl rand -hex 32

# Supabase service role (already exists, ensure available server-side)
SUPABASE_SERVICE_ROLE_KEY="<from Supabase dashboard>"
```

Existing env vars (`RESEND_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ADMIN_NOTIFY_EMAILS`, `TWILIO_*`, `GEMINI_API_KEY`) remain unchanged.

---

# Phase 1A — Foundation: schema, payment-reference, email infrastructure

Goal: lay the groundwork that every subsequent phase depends on. After Phase 1A, the database has all required columns, the email rendering pipeline works, and the payment-reference helper is available. No user-visible changes yet.

---

### Task 1: DB schema migration

**Files:**
- Create: `migrations/2026-04-25-onboarding-refresh.sql`
- Modify: `supabase_schema.sql` (append at end)
- Test: applied against the development Supabase branch (manual verification)

- [ ] **Step 1: Write the migration SQL**

Create `migrations/2026-04-25-onboarding-refresh.sql`:

```sql
-- Onboarding refresh — 2026-04-25
-- Adds acquisition tracking, payment reference/provider, consent, onboarding flag,
-- and the participant_survey table.

BEGIN;

-- 1. participants — new columns
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS referral_channel TEXT
    CHECK (referral_channel IS NULL OR referral_channel IN
      ('Recommandation','LinkedIn','Facebook','Instagram','Google','Email','Évènement','Autre')),
  ADD COLUMN IF NOT EXISTS referrer_name TEXT,
  ADD COLUMN IF NOT EXISTS channel_other TEXT,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT
    CHECK (payment_provider IS NULL OR payment_provider IN
      ('wave','orange_money','bank_transfer','cash','flutterwave')),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  -- Snapshot of auth.users.id at confirmation time. No FK by design:
  -- audit rows must survive the admin's removal from the allowlist.
  -- (admin_users is email-keyed, not id-keyed; original plan SQL was
  --  REFERENCES public.admin_users(id) which fails Postgres validation.)
  ADD COLUMN IF NOT EXISTS confirmed_by_admin_id UUID,
  ADD COLUMN IF NOT EXISTS confirmation_notes TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- payment_reference must be unique (case-insensitive) when present
CREATE UNIQUE INDEX IF NOT EXISTS participants_payment_reference_udx
  ON public.participants (upper(payment_reference))
  WHERE payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS participants_referral_channel_idx
  ON public.participants (referral_channel);

CREATE INDEX IF NOT EXISTS participants_status_payment_created_idx
  ON public.participants (status, payment, created_at);

-- Backfill consent_at for existing rows so legacy participants aren't blocked
UPDATE public.participants
   SET consent_at = created_at
 WHERE consent_at IS NULL;

-- 2. participant_survey — new table
CREATE TABLE IF NOT EXISTS public.participant_survey (
  participant_id UUID PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  secteur TEXT,
  collaborateurs TEXT,
  niveau TEXT CHECK (niveau IS NULL OR niveau IN ('Débutant','Intermédiaire','Avancé')),
  defi TEXT,
  attentes TEXT[],
  recommendation TEXT,
  started_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.participant_survey ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participant_survey self upsert" ON public.participant_survey;
CREATE POLICY "participant_survey self upsert"
  ON public.participant_survey
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
       WHERE p.id = participant_survey.participant_id
         AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants p
       WHERE p.id = participant_survey.participant_id
         AND lower(p.email) = lower(auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "participant_survey admin read" ON public.participant_survey;
CREATE POLICY "participant_survey admin read"
  ON public.participant_survey
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE lower(a.email) = lower(auth.jwt() ->> 'email')
    )
  );

COMMIT;
```

- [ ] **Step 1b: Write the down migration**

Create `migrations/2026-04-25-onboarding-refresh.down.sql` (per D20 — needed for safe rollback):

```sql
-- Rollback for onboarding refresh — 2026-04-25
-- WARNING: drops new columns and the participant_survey table.
-- Data loss is intentional. Coordinate with admin before running.

BEGIN;

DROP TABLE IF EXISTS public.participant_survey;

DROP INDEX IF EXISTS public.participants_payment_reference_udx;
DROP INDEX IF EXISTS public.participants_referral_channel_idx;
DROP INDEX IF EXISTS public.participants_status_payment_created_idx;

ALTER TABLE public.participants
  DROP COLUMN IF EXISTS referral_channel,
  DROP COLUMN IF EXISTS referrer_name,
  DROP COLUMN IF EXISTS channel_other,
  DROP COLUMN IF EXISTS consent_at,
  DROP COLUMN IF EXISTS payment_provider,
  DROP COLUMN IF EXISTS payment_reference,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS confirmed_by_admin_id,
  DROP COLUMN IF EXISTS confirmation_notes,
  DROP COLUMN IF EXISTS onboarding_completed_at;

COMMIT;
```

- [ ] **Step 2: Append to canonical schema file**

Open `supabase_schema.sql` and append the up-migration statements at the end (without the `BEGIN`/`COMMIT` wrapper — keep the file idempotent). Add a comment block: `-- Onboarding refresh (2026-04-25)`.

- [ ] **Step 3: Apply against the dev Supabase branch**

Use the Supabase Management API token (already in env per memory `1919`):

```bash
PROJECT_REF="<dev branch project ref>"
ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN"

curl -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -Rs '{query: .}' < migrations/2026-04-25-onboarding-refresh.sql)"
```

Expected: `{"result": [...]}` with no error.

- [ ] **Step 4: Verify schema**

```bash
curl -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='\''participants'\'' ORDER BY ordinal_position;"}'
```

Expected: response includes `referral_channel`, `referrer_name`, `channel_other`, `consent_at`, `payment_provider`, `payment_reference`, `confirmed_at`, `onboarding_completed_at`.

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-04-25-onboarding-refresh.sql supabase_schema.sql
git commit -m "feat(db): onboarding refresh schema — channel, payment ref, survey table"
```

---

### Task 2: Payment reference generator

**Files:**
- Create: `api/lib/payment-reference.ts`
- Test: `api/__tests__/payment-reference.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/__tests__/payment-reference.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generatePaymentReference } from "../lib/payment-reference.js";

describe("generatePaymentReference", () => {
  it("formats as RMK-<year>-<4-char>", () => {
    const ref = generatePaymentReference("9c2b7e1a-4f8d-4b3a-9d12-3e4f5a6b7c8d");
    expect(ref).toMatch(/^RMK-\d{4}-[A-Z0-9]{4}$/);
  });

  it("uses current year", () => {
    const ref = generatePaymentReference("9c2b7e1a-4f8d-4b3a-9d12-3e4f5a6b7c8d");
    const year = new Date().getUTCFullYear();
    expect(ref.startsWith(`RMK-${year}-`)).toBe(true);
  });

  it("is deterministic for the same UUID", () => {
    const id = "9c2b7e1a-4f8d-4b3a-9d12-3e4f5a6b7c8d";
    expect(generatePaymentReference(id)).toBe(generatePaymentReference(id));
  });

  it("differs across UUIDs", () => {
    const a = generatePaymentReference("11111111-1111-1111-1111-111111111111");
    const b = generatePaymentReference("22222222-2222-2222-2222-222222222222");
    expect(a).not.toBe(b);
  });

  it("excludes ambiguous characters (0/O, 1/I)", () => {
    // Run on 100 random UUIDs and ensure no 0/O/1/I confusion
    for (let i = 0; i < 100; i++) {
      const uuid = crypto.randomUUID();
      const ref = generatePaymentReference(uuid);
      expect(ref).not.toMatch(/[01OI]/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- payment-reference`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `api/lib/payment-reference.ts`:

```ts
// Crockford base32 alphabet (excludes 0/O, 1/I, U) — unambiguous when typed
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function hashUuid(uuid: string): number {
  // FNV-1a over the UUID hex (deterministic, no crypto needed)
  const hex = uuid.replace(/-/g, "");
  let hash = 0x811c9dc5;
  for (let i = 0; i < hex.length; i++) {
    hash ^= hex.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function generatePaymentReference(uuid: string): string {
  const year = new Date().getUTCFullYear();
  let n = hashUuid(uuid);
  let code = "";
  for (let i = 0; i < 4; i++) {
    code = ALPHABET[n % ALPHABET.length] + code;
    n = Math.floor(n / ALPHABET.length);
  }
  return `RMK-${year}-${code}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- payment-reference`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add api/lib/payment-reference.ts api/__tests__/payment-reference.test.ts
git commit -m "feat(api): payment reference generator (RMK-YYYY-XXXX, Crockford base32)"
```

---

### Task 3: Email layout + render helper

**Files:**
- Create: `api/email-templates/_layout.ts`
- Create: `api/lib/render-email.ts`
- Test: `api/__tests__/render-email.test.ts`

- [ ] **Step 1: Define the template contract**

Create `api/lib/render-email.ts`:

```ts
import { layout } from "../email-templates/_layout.js";

export interface EmailTemplate<TProps> {
  subject: (props: TProps) => string;
  html: (props: TProps) => string;
  text: (props: TProps) => string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail<TProps>(
  template: EmailTemplate<TProps>,
  props: TProps,
): RenderedEmail {
  return {
    subject: template.subject(props),
    html: layout({
      title: template.subject(props),
      bodyHtml: template.html(props),
    }),
    text: template.text(props),
  };
}
```

- [ ] **Step 2: Write the layout**

Create `api/email-templates/_layout.ts`:

```ts
const NAVY = "#1B2A4A";
const GOLD = "#C9A84C";
const SURFACE = "#F7F4ED";
const TEXT = "#2A2A2A";

export function layout(opts: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};font-family:Helvetica,Arial,sans-serif;color:${TEXT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e3d6;">
        <tr><td style="background:${NAVY};padding:24px 32px;color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px;">
          R M K &nbsp; C O N S E I L S
        </td></tr>
        <tr><td style="padding:32px;line-height:1.6;font-size:15px;">
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="background:${NAVY};padding:20px 32px;color:#cbd0dc;font-size:12px;">
          RMK Conseils — Abidjan, Côte d'Ivoire<br>
          Contact : +225 07 02 61 15 82 (Appel/WhatsApp) — 
          <a href="https://rmkconseils.com" style="color:${GOLD};text-decoration:none;">rmkconseils.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 3: Write tests**

Create `api/__tests__/render-email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderEmail, type EmailTemplate } from "../lib/render-email.js";

const sample: EmailTemplate<{ name: string }> = {
  subject: (p) => `Hello ${p.name}`,
  html: (p) => `<p>Hi ${p.name}</p>`,
  text: (p) => `Hi ${p.name}`,
};

describe("renderEmail", () => {
  it("renders subject from props", () => {
    expect(renderEmail(sample, { name: "Alice" }).subject).toBe("Hello Alice");
  });
  it("wraps body html in layout", () => {
    const out = renderEmail(sample, { name: "Alice" });
    expect(out.html).toContain("<!doctype html>");
    expect(out.html).toContain("<p>Hi Alice</p>");
    expect(out.html).toContain("R M K");
  });
  it("returns plain text body unchanged", () => {
    expect(renderEmail(sample, { name: "Alice" }).text).toBe("Hi Alice");
  });
  it("escapes html in subject when used in title", () => {
    const out = renderEmail(sample, { name: "<script>" });
    expect(out.html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm test -- render-email`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add api/email-templates/_layout.ts api/lib/render-email.ts api/__tests__/render-email.test.ts
git commit -m "feat(api): shared email layout + template renderer"
```

---

### Task 4: Resend send helper

**Files:**
- Create: `api/lib/send-email.ts`
- Test: `api/__tests__/send-email.test.ts`

- [ ] **Step 1: Write tests**

Create `api/__tests__/send-email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { sendEmail } from "../lib/send-email.js";

beforeEach(() => sendMock.mockReset());

describe("sendEmail", () => {
  it("forwards subject/html/text to Resend with EMAIL_FROM", async () => {
    sendMock.mockResolvedValue({ data: { id: "x" }, error: null });
    await sendEmail({
      to: "a@b.com",
      subject: "S", html: "<p>H</p>", text: "T",
    }, { resendApiKey: "key", from: "RMK <a@b.com>" });
    expect(sendMock).toHaveBeenCalledWith({
      from: "RMK <a@b.com>",
      to: "a@b.com",
      subject: "S",
      html: "<p>H</p>",
      text: "T",
    });
  });

  it("throws when Resend returns error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "bad" } });
    await expect(
      sendEmail({ to: "a@b.com", subject: "S", html: "h", text: "t" },
        { resendApiKey: "k", from: "f" }),
    ).rejects.toThrow("bad");
  });

  it("no-ops when resendApiKey is empty (graceful degradation)", async () => {
    await sendEmail({ to: "a@b.com", subject: "S", html: "h", text: "t" },
      { resendApiKey: "", from: "f" });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- send-email`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `api/lib/send-email.ts`:

```ts
import { Resend } from "resend";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailConfig {
  resendApiKey: string;
  from: string;
}

export async function sendEmail(input: SendEmailInput, cfg: SendEmailConfig): Promise<void> {
  if (!cfg.resendApiKey) {
    console.warn("[sendEmail] RESEND_API_KEY missing — skipping send to", input.to);
    return;
  }
  const resend = new Resend(cfg.resendApiKey);
  const { error } = await resend.emails.send({
    from: cfg.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(error.message ?? "Resend send failed");
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- send-email`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add api/lib/send-email.ts api/__tests__/send-email.test.ts
git commit -m "feat(api): resend send helper with graceful degradation"
```

---

# Phase 1B — Email templates

Goal: write all six templates as pure functions of their props. No backend wiring yet.

---

### Task 5: Registration confirmation template

**Files:**
- Create: `api/email-templates/registration-confirmation.ts`
- Test: `api/__tests__/templates/registration-confirmation.test.ts`

- [ ] **Step 1: Define props + write the template**

Create `api/email-templates/registration-confirmation.ts`:

```ts
import type { EmailTemplate } from "../lib/render-email.js";

export interface RegistrationConfirmationProps {
  prenom: string;
  civilite?: string | null;
  seminarTitle: string;
  seminarDates: string;
  amountFcfa: number;
  paymentReference: string;
  supportPhone: string;
  siteUrl: string;
}

const fmtAmount = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export const registrationConfirmation: EmailTemplate<RegistrationConfirmationProps> = {
  subject: () => "Confirmation de votre demande d'inscription — RMK Conseils",

  text: (p) =>
    `Bonjour ${p.civilite ?? ""} ${p.prenom},

Nous avons bien reçu votre demande d'inscription pour:
  ${p.seminarTitle}
  ${p.seminarDates}

═════════════════════════════════════════
  IMPORTANT — À INDIQUER DANS LE MOTIF
═════════════════════════════════════════

         ${p.paymentReference}

Lors de votre paiement, saisissez ce code dans le champ
« motif » ou « raison du transfert ». Sans cette référence,
la confirmation peut être retardée de plusieurs jours.

═════════════════════════════════════════

Montant : ${fmtAmount(p.amountFcfa)}

Modalités de paiement :
  • Wave           : ${p.supportPhone}
  • Orange Money   : ${p.supportPhone}
  • Virement       : contactez-nous

Pour toute question ou pour le virement bancaire,
appelez ou écrivez sur WhatsApp : ${p.supportPhone}

Dès réception de votre paiement, votre espace participant
sera activé sous 24h ouvrées.

Coordonnées de paiement à jour : ${p.siteUrl}/paiement

Cordialement,
L'équipe RMK Conseils`,

  html: (p) => `
<p style="font-size:16px;">Bonjour <strong>${esc(p.civilite ?? "")} ${esc(p.prenom)}</strong>,</p>

<p>Nous avons bien reçu votre demande d'inscription pour&nbsp;:</p>
<p style="font-size:17px;font-weight:600;color:#1B2A4A;margin:8px 0 4px;">${esc(p.seminarTitle)}</p>
<p style="color:#666;margin:0 0 24px;">${esc(p.seminarDates)}</p>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="background:#FFF8E1;border:2px solid #C9A84C;border-radius:8px;padding:20px;text-align:center;">
    <div style="font-size:11px;font-weight:bold;color:#C9A84C;letter-spacing:1.5px;margin-bottom:8px;">
      ⚠ IMPORTANT — À INDIQUER DANS LE MOTIF
    </div>
    <div style="font-family:Menlo,Consolas,monospace;font-size:26px;font-weight:bold;color:#1B2A4A;letter-spacing:2px;margin:8px 0;">
      ${esc(p.paymentReference)}
    </div>
    <div style="font-size:13px;color:#5a4a1a;line-height:1.5;">
      Lors de votre paiement, saisissez ce code dans le champ<br>
      «&nbsp;motif&nbsp;» ou «&nbsp;raison du transfert&nbsp;».
    </div>
  </td></tr>
</table>

<p style="font-size:15px;"><strong>Montant&nbsp;:</strong> ${fmtAmount(p.amountFcfa)}</p>

<h3 style="color:#1B2A4A;margin-top:28px;border-bottom:1px solid #e7e3d6;padding-bottom:6px;">Modalités de paiement</h3>
<table cellpadding="8" cellspacing="0" border="0" width="100%" style="margin:8px 0;">
  <tr>
    <td width="32"><img src="${p.siteUrl}/payment-logos/wave@2x.png" alt="Wave" width="32" height="32" style="display:block;"></td>
    <td><strong>Wave</strong></td>
    <td align="right" style="font-family:Menlo,monospace;">${esc(p.supportPhone)}</td>
  </tr>
  <tr>
    <td><img src="${p.siteUrl}/payment-logos/orange-money@2x.png" alt="Orange Money" width="32" height="32" style="display:block;"></td>
    <td><strong>Orange Money</strong></td>
    <td align="right" style="font-family:Menlo,monospace;">${esc(p.supportPhone)}</td>
  </tr>
  <tr>
    <td>🏦</td>
    <td><strong>Virement bancaire</strong></td>
    <td align="right" style="color:#666;">contactez-nous</td>
  </tr>
</table>

<p style="background:#F5F1E4;padding:12px 16px;border-radius:6px;margin:24px 0;">
  📞 <strong>Question ou virement&nbsp;:</strong> ${esc(p.supportPhone)} (Appel ou WhatsApp)
</p>

<p>Dès réception de votre paiement, votre espace participant sera activé sous 24h ouvrées.</p>

<p style="color:#999;font-size:12px;margin-top:24px;">
  Coordonnées de paiement à jour&nbsp;: <a href="${p.siteUrl}/paiement" style="color:#C9A84C;">${p.siteUrl}/paiement</a>
</p>
`,
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: Write tests**

Create `api/__tests__/templates/registration-confirmation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { registrationConfirmation } from "../../email-templates/registration-confirmation.js";

const props = {
  prenom: "Marie",
  civilite: "Mme",
  seminarTitle: "S1 — IA Stratégique pour Dirigeants",
  seminarDates: "26-30 mai 2026",
  amountFcfa: 700000,
  paymentReference: "RMK-2026-A4F2",
  supportPhone: "+225 07 02 61 15 82",
  siteUrl: "https://rmkconseils.com",
};

describe("registrationConfirmation", () => {
  it("includes participant name", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("Marie");
    expect(out.text).toContain("Marie");
  });
  it("highlights the payment reference", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("RMK-2026-A4F2");
    expect(out.text).toContain("RMK-2026-A4F2");
  });
  it("instructs to use the reference as motif", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("motif");
    expect(out.text).toContain("motif");
  });
  it("formats amount with French thousand separator", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.text).toContain("700 000 FCFA");
  });
  it("does NOT mention MTN MoMo", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).not.toMatch(/MoMo|MTN/i);
    expect(out.text).not.toMatch(/MoMo|MTN/i);
  });
  it("includes Wave and Orange Money", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("Wave");
    expect(out.html).toContain("Orange Money");
  });
  it("escapes hostile input in seminarTitle", () => {
    const out = renderEmail(registrationConfirmation, { ...props, seminarTitle: "<script>" });
    expect(out.html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 3: Run**

Run: `npm test -- registration-confirmation`
Expected: PASS — 7 tests.

- [ ] **Step 4: Commit**

```bash
git add api/email-templates/registration-confirmation.ts api/__tests__/templates/registration-confirmation.test.ts
git commit -m "feat(email): registration-confirmation template with payment reference"
```

---

### Task 6: Admin new-registration template

**Files:**
- Create: `api/email-templates/admin-new-registration.ts`
- Test: `api/__tests__/templates/admin-new-registration.test.ts`

- [ ] **Step 1: Implement template**

Create `api/email-templates/admin-new-registration.ts`:

```ts
import type { EmailTemplate } from "../lib/render-email.js";

export interface AdminNewRegistrationProps {
  prenom: string;
  nom: string;
  civilite?: string | null;
  email: string;
  tel?: string | null;
  societe?: string | null;
  fonction: string;
  seminarTitle: string;
  amountFcfa: number;
  referralChannel?: string | null;
  referrerName?: string | null;
  channelOther?: string | null;
  paymentReference: string;
  participantId: string;
  adminUrl: string;
}

const fmtAmount = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export const adminNewRegistration: EmailTemplate<AdminNewRegistrationProps> = {
  subject: (p) => `[Inscription] ${p.civilite ?? ""} ${p.prenom} ${p.nom} — ${p.seminarTitle}`,

  text: (p) => `Nouvelle inscription:

  Référence : ${p.paymentReference}
  Nom       : ${p.civilite ?? ""} ${p.prenom} ${p.nom}
  Email     : ${p.email}
  Tel       : ${p.tel ?? "—"}
  Société   : ${p.societe ?? "—"}
  Fonction  : ${p.fonction}
  Atelier   : ${p.seminarTitle}
  Montant   : ${fmtAmount(p.amountFcfa)}

  Canal     : ${p.referralChannel ?? "—"}
  ${p.referrerName ? `Recommandé par : ${p.referrerName}\n  ` : ""}${p.channelOther ? `Précision : ${p.channelOther}\n  ` : ""}

Voir dans l'admin : ${p.adminUrl}/admin?focus=${p.participantId}`,

  html: (p) => `
<p>Nouvelle inscription reçue&nbsp;:</p>
<table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;">
  <tr><td style="color:#666;">Référence</td><td><strong>${p.paymentReference}</strong></td></tr>
  <tr><td style="color:#666;">Nom</td><td>${esc(p.civilite ?? "")} ${esc(p.prenom)} ${esc(p.nom)}</td></tr>
  <tr><td style="color:#666;">Email</td><td><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></td></tr>
  <tr><td style="color:#666;">Téléphone</td><td>${esc(p.tel ?? "—")}</td></tr>
  <tr><td style="color:#666;">Société</td><td>${esc(p.societe ?? "—")}</td></tr>
  <tr><td style="color:#666;">Fonction</td><td>${esc(p.fonction)}</td></tr>
  <tr><td style="color:#666;">Atelier</td><td>${esc(p.seminarTitle)}</td></tr>
  <tr><td style="color:#666;">Montant</td><td>${fmtAmount(p.amountFcfa)}</td></tr>
  <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:12px;"></td></tr>
  <tr><td style="color:#666;">Canal</td><td><strong>${esc(p.referralChannel ?? "—")}</strong></td></tr>
  ${p.referrerName ? `<tr><td style="color:#666;">Recommandé par</td><td>${esc(p.referrerName)}</td></tr>` : ""}
  ${p.channelOther ? `<tr><td style="color:#666;">Précision</td><td>${esc(p.channelOther)}</td></tr>` : ""}
</table>

<p style="margin-top:24px;">
  <a href="${p.adminUrl}/admin?focus=${p.participantId}"
     style="display:inline-block;background:#1B2A4A;color:#fff;text-decoration:none;
            padding:10px 20px;border-radius:6px;font-weight:600;">
    Ouvrir dans l'admin →
  </a>
</p>
`,
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: Write tests**

Create `api/__tests__/templates/admin-new-registration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { adminNewRegistration } from "../../email-templates/admin-new-registration.js";

const base = {
  prenom: "Marie", nom: "Koffi", civilite: "Mme",
  email: "marie@example.com", tel: "+22507000000",
  societe: "Acme", fonction: "DG",
  seminarTitle: "S1", amountFcfa: 700000,
  paymentReference: "RMK-2026-A4F2",
  participantId: "abc-123",
  adminUrl: "https://rmkconseils.com",
};

describe("adminNewRegistration", () => {
  it("includes channel when present", () => {
    const out = renderEmail(adminNewRegistration, {
      ...base, referralChannel: "LinkedIn",
    });
    expect(out.html).toContain("LinkedIn");
  });
  it("includes recommender name when channel is Recommandation", () => {
    const out = renderEmail(adminNewRegistration, {
      ...base, referralChannel: "Recommandation", referrerName: "Jean Diallo",
    });
    expect(out.html).toContain("Jean Diallo");
    expect(out.html).toContain("Recommandé par");
  });
  it("includes channel detail when Autre", () => {
    const out = renderEmail(adminNewRegistration, {
      ...base, referralChannel: "Autre", channelOther: "Conférence CIO",
    });
    expect(out.html).toContain("Conférence CIO");
  });
  it("links to admin focused on the participant", () => {
    const out = renderEmail(adminNewRegistration, base);
    expect(out.html).toContain("/admin?focus=abc-123");
  });
  it("subject includes participant name and seminar", () => {
    expect(renderEmail(adminNewRegistration, base).subject).toContain("Marie Koffi");
    expect(renderEmail(adminNewRegistration, base).subject).toContain("S1");
  });
});
```

- [ ] **Step 3: Run**

Run: `npm test -- admin-new-registration`
Expected: PASS — 5 tests.

- [ ] **Step 4: Commit**

```bash
git add api/email-templates/admin-new-registration.ts api/__tests__/templates/admin-new-registration.test.ts
git commit -m "feat(email): admin-new-registration template with channel attribution"
```

---

### Task 7: Magic-link template

**Files:**
- Create: `api/email-templates/magic-link.ts`
- Test: `api/__tests__/templates/magic-link.test.ts`

- [ ] **Step 1: Implement**

Create `api/email-templates/magic-link.ts`:

```ts
import type { EmailTemplate } from "../lib/render-email.js";

export interface MagicLinkProps {
  prenom: string;
  seminarTitle: string;
  magicLinkUrl: string;
  supportPhone: string;
}

export const magicLink: EmailTemplate<MagicLinkProps> = {
  subject: () => "Votre lien d'accès à l'espace participant — RMK Conseils",

  text: (p) => `Bonjour ${p.prenom},

Voici votre lien d'accès sécurisé à votre espace participant
pour la formation :

  ${p.seminarTitle}
  Abidjan — Mai 2026

Accédez à votre espace :
${p.magicLinkUrl}

Ce lien expire dans 1 heure et ne peut être utilisé qu'une fois.

Dans votre espace, vous trouverez :
  • Le programme détaillé
  • Votre attestation (après la formation)
  • Le coaching IA personnalisé (formation S1)
  • La communauté des participants
  • Les ressources Découverte IA

Vous n'avez pas demandé cet email ? Ignorez-le simplement,
aucune action ne sera prise sur votre compte.

Question ? ${p.supportPhone} (Appel/WhatsApp)

— L'équipe RMK Conseils`,

  html: (p) => `
<p>Bonjour <strong>${esc(p.prenom)}</strong>,</p>

<p>Voici votre lien d'accès sécurisé à votre espace participant pour la formation&nbsp;:</p>

<div style="background:#F5F1E4;border-left:3px solid #C9A84C;padding:12px 16px;margin:16px 0;">
  <strong style="color:#1B2A4A;">${esc(p.seminarTitle)}</strong><br>
  <span style="color:#666;">Abidjan — Mai 2026</span>
</div>

<p style="text-align:center;margin:32px 0;">
  <a href="${p.magicLinkUrl}"
     style="display:inline-block;background:#C9A84C;color:#1B2A4A;text-decoration:none;
            padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">
    👉 Accéder à mon espace
  </a>
</p>

<p style="color:#666;font-size:13px;text-align:center;margin-top:-16px;">
  Ce lien expire dans 1 heure et ne peut être utilisé qu'une fois.
</p>

<h4 style="color:#1B2A4A;margin-top:28px;">Dans votre espace, vous trouverez&nbsp;:</h4>
<ul style="color:#444;line-height:1.8;">
  <li>Le programme détaillé de votre formation</li>
  <li>Votre attestation (disponible après la formation)</li>
  <li>L'accès au coaching IA personnalisé (formation S1)</li>
  <li>La communauté des participants</li>
  <li>Les ressources Découverte IA</li>
</ul>

<p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
  Vous n'avez pas demandé cet email&nbsp;? Ignorez-le simplement, aucune action
  ne sera prise sur votre compte.<br><br>
  Question&nbsp;? <a href="https://wa.me/${p.supportPhone.replace(/\D/g, "")}" style="color:#C9A84C;">${esc(p.supportPhone)}</a> (Appel/WhatsApp)
</p>
`,
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: Tests**

Create `api/__tests__/templates/magic-link.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { magicLink } from "../../email-templates/magic-link.js";

const props = {
  prenom: "Jean",
  seminarTitle: "S2 — IA Finance",
  magicLinkUrl: "https://rmkconseils.com/portal#access_token=xyz",
  supportPhone: "+225 07 02 61 15 82",
};

describe("magicLink", () => {
  it("renders the link as a button", () => {
    expect(renderEmail(magicLink, props).html).toContain(props.magicLinkUrl);
  });
  it("text version includes the URL on its own line", () => {
    expect(renderEmail(magicLink, props).text).toContain(props.magicLinkUrl);
  });
  it("mentions expiration", () => {
    const out = renderEmail(magicLink, props);
    expect(out.html).toMatch(/expire dans 1 heure/);
    expect(out.text).toMatch(/expire dans 1 heure/);
  });
  it("mentions security note (didn't request)", () => {
    expect(renderEmail(magicLink, props).text).toMatch(/n'avez pas demandé/);
  });
  it("includes seminar title for context", () => {
    expect(renderEmail(magicLink, props).html).toContain("S2 — IA Finance");
  });
});
```

- [ ] **Step 3: Run + commit**

Run: `npm test -- magic-link`
Expected: PASS — 5 tests.

```bash
git add api/email-templates/magic-link.ts api/__tests__/templates/magic-link.test.ts
git commit -m "feat(email): magic-link template with seminar context"
```

---

### Task 8: Welcome (confirmed) template

**Files:**
- Create: `api/email-templates/welcome-confirmed.ts`
- Test: `api/__tests__/templates/welcome-confirmed.test.ts`

- [ ] **Step 1: Implement**

Create `api/email-templates/welcome-confirmed.ts`:

```ts
import type { EmailTemplate } from "../lib/render-email.js";

export interface WelcomeConfirmedProps {
  prenom: string;
  seminarTitle: string;
  seminarDates: string;
  magicLinkUrl: string;
  portalUrl: string;
  supportPhone: string;
}

export const welcomeConfirmed: EmailTemplate<WelcomeConfirmedProps> = {
  subject: () => "🎉 Votre inscription est confirmée — Bienvenue !",

  text: (p) => `Bonjour ${p.prenom},

Excellente nouvelle : votre paiement est confirmé et votre place
pour ${p.seminarTitle} (${p.seminarDates}) est définitivement réservée.

Voici votre accès à l'espace participant :
${p.magicLinkUrl}

(Lien valide 1 heure. Pour toute connexion future, rendez-vous sur
${p.portalUrl} avec votre email.)

À très bientôt,
L'équipe RMK Conseils

Question ? ${p.supportPhone} (Appel/WhatsApp)`,

  html: (p) => `
<h2 style="color:#1B2A4A;">🎉 Bienvenue, ${esc(p.prenom)} !</h2>

<p>Excellente nouvelle&nbsp;: votre paiement est confirmé et votre place pour
<strong>${esc(p.seminarTitle)}</strong> (${esc(p.seminarDates)})
est définitivement réservée.</p>

<p style="text-align:center;margin:32px 0;">
  <a href="${p.magicLinkUrl}"
     style="display:inline-block;background:#C9A84C;color:#1B2A4A;text-decoration:none;
            padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">
    Accéder à mon espace participant
  </a>
</p>

<p style="color:#666;font-size:13px;text-align:center;margin-top:-16px;">
  Lien valide 1 heure. Pour toute connexion future, rendez-vous sur
  <a href="${p.portalUrl}" style="color:#C9A84C;">${p.portalUrl}</a>.
</p>

<h4 style="color:#1B2A4A;margin-top:28px;">Prochaines étapes&nbsp;:</h4>
<ol style="color:#444;line-height:1.8;">
  <li>Connectez-vous avec votre email</li>
  <li>Personnalisez votre profil (2 minutes)</li>
  <li>Découvrez le programme et les ressources</li>
</ol>

<p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
  Question&nbsp;? <a href="https://wa.me/${p.supportPhone.replace(/\D/g, "")}" style="color:#C9A84C;">${esc(p.supportPhone)}</a> (Appel/WhatsApp)
</p>
`,
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: Tests + commit**

Tests follow the same pattern as Task 7: assert subject contains "confirmée", html includes magicLinkUrl + seminarTitle, text version includes both.

```bash
npm test -- welcome-confirmed
git add api/email-templates/welcome-confirmed.ts api/__tests__/templates/welcome-confirmed.test.ts
git commit -m "feat(email): welcome-confirmed template with magic link"
```

---

### Task 9: Recommendation follow-up template

**Files:**
- Create: `api/email-templates/recommendation-followup.ts`
- Test: `api/__tests__/templates/recommendation-followup.test.ts`

- [ ] **Step 1: Implement**

```ts
import type { EmailTemplate } from "../lib/render-email.js";

export interface RecommendationFollowupProps {
  prenom: string;
  recommendation: string;       // already-formatted recommendation string
  portalUrl: string;
}

export const recommendationFollowup: EmailTemplate<RecommendationFollowupProps> = {
  subject: () => "Votre parcours personnalisé RMK — Recommandation",

  text: (p) => `Bonjour ${p.prenom},

Merci d'avoir partagé vos objectifs avec nous. Voici notre
recommandation personnalisée pour tirer le meilleur parti de
votre formation :

${p.recommendation}

Retrouvez cette recommandation et toutes les ressources sur
votre espace : ${p.portalUrl}

— L'équipe RMK Conseils`,

  html: (p) => `
<p>Bonjour <strong>${esc(p.prenom)}</strong>,</p>
<p>Merci d'avoir partagé vos objectifs. Voici notre recommandation personnalisée&nbsp;:</p>
<div style="background:#F5F1E4;border-left:3px solid #C9A84C;padding:16px 20px;margin:20px 0;font-style:italic;color:#1B2A4A;">
  ${esc(p.recommendation)}
</div>
<p style="text-align:center;margin:24px 0;">
  <a href="${p.portalUrl}" style="display:inline-block;background:#1B2A4A;color:#fff;
     text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
    Retour à mon espace
  </a>
</p>
`,
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: Tests + commit**

Same test pattern. Commit message: `feat(email): recommendation-followup template`.

---

### Task 10: Admin SLA reminder template

**Files:**
- Create: `api/email-templates/admin-sla-reminder.ts`
- Test: `api/__tests__/templates/admin-sla-reminder.test.ts`

- [ ] **Step 1: Implement**

```ts
import type { EmailTemplate } from "../lib/render-email.js";

export interface SlaReminderRow {
  prenom: string;
  nom: string;
  email: string;
  seminarTitle: string;
  paymentReference: string;
  hoursWaiting: number;
}

export interface AdminSlaReminderProps {
  rows: SlaReminderRow[];
  adminUrl: string;
}

export const adminSlaReminder: EmailTemplate<AdminSlaReminderProps> = {
  subject: (p) => `[SLA] ${p.rows.length} inscription(s) en attente > 48h`,

  text: (p) =>
    `${p.rows.length} inscription(s) sont en attente de paiement depuis plus de 48h:\n\n` +
    p.rows.map(r =>
      `  ${r.paymentReference} — ${r.prenom} ${r.nom} (${r.email}) — ${r.seminarTitle} — ${r.hoursWaiting}h`
    ).join("\n") +
    `\n\nVoir l'admin: ${p.adminUrl}/admin`,

  html: (p) => `
<p><strong>${p.rows.length}</strong> inscription(s) en attente de paiement depuis plus de 48h&nbsp;:</p>
<table cellpadding="6" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:13px;">
  <tr style="background:#F5F1E4;color:#1B2A4A;">
    <th align="left" style="padding:8px;">Réf</th>
    <th align="left">Nom</th>
    <th align="left">Atelier</th>
    <th align="right">Attente</th>
  </tr>
  ${p.rows.map(r => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="font-family:Menlo,monospace;">${esc(r.paymentReference)}</td>
      <td>${esc(r.prenom)} ${esc(r.nom)}<br><span style="color:#888;font-size:11px;">${esc(r.email)}</span></td>
      <td>${esc(r.seminarTitle)}</td>
      <td align="right" style="color:#c44;"><strong>${r.hoursWaiting}h</strong></td>
    </tr>`).join("")}
</table>
<p><a href="${p.adminUrl}/admin" style="color:#C9A84C;">Ouvrir l'admin →</a></p>
`,
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
```

- [ ] **Step 2: Tests + commit**

```bash
npm test -- admin-sla-reminder
git commit -am "feat(email): admin-sla-reminder template"
```

---

# Phase 1C — Backend wiring: register endpoint, magic link, mark-paid, cron

Goal: replace `/api/notify-registration` with the new `/api/register` (dedup-aware, channel-aware), add the magic-link and mark-paid endpoints, add the SLA cron.

---

### Task 11: POST /api/register — replaces notify-registration

**Depends on:** Task 12 (`generateMagicLinkUrl` is imported by the dedup `confirmed` branch). Either implement Task 12 first, or skip the magic-link send in Task 11 and add it as a follow-up step after Task 12 lands.

**Files:**
- Modify: `api/app.ts` (replace existing notify-registration endpoint)
- Create: `api/lib/registration.ts` (extracted business logic)
- Test: `api/__tests__/registration-dedup.test.ts`

- [ ] **Step 1: Write dedup matrix tests first**

Create `api/__tests__/registration-dedup.test.ts` covering all branches from D9:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import type { Express } from "express";

// Mock supabase + resend identically to existing tests
// ... (see registration-uniqueness.test.ts for the pattern)

describe("POST /api/register — dedup matrix", () => {
  let app: Express;
  beforeEach(() => { /* setup app */ });

  it("new email → 201, inserts row, sends 2 emails", async () => {
    // mock no existing row, INSERT succeeds
    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.payment_reference).toMatch(/^RMK-\d{4}-[A-Z0-9]{4}$/);
    // assert 2 sendEmail calls
  });

  it("existing pending+pending → 409 with state=pending_unpaid, resends confirmation", async () => {
    // mock existing row {status:'pending', payment:'pending'}
    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("pending_unpaid");
    expect(res.body.action_taken).toBe("resent_confirmation");
    expect(res.body.payment_reference).toBeDefined();
  });

  it("existing pending+paid → 409 with state=pending_paid, no email resent", async () => {
    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("pending_paid");
    expect(res.body.action_taken).toBe("none");
  });

  it("existing confirmed → 409 with state=confirmed, sends magic link", async () => {
    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("confirmed");
    expect(res.body.action_taken).toBe("sent_magic_link");
  });

  it("existing cancelled → 201 (allowed re-registration)", async () => {
    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(201);
  });

  it("rejects without consent_at", async () => {
    const res = await request(app).post("/api/register").send({ ...validBody(), consent: false });
    expect(res.status).toBe(400);
  });

  it("rejects when channel=Recommandation but referrer_name missing", async () => {
    const res = await request(app).post("/api/register").send({
      ...validBody(), referral_channel: "Recommandation", referrer_name: "",
    });
    expect(res.status).toBe(400);
  });

  it("rejects when channel=Autre but channel_other missing", async () => {
    const res = await request(app).post("/api/register").send({
      ...validBody(), referral_channel: "Autre", channel_other: "",
    });
    expect(res.status).toBe(400);
  });

  it("rejects unknown channel value", async () => {
    const res = await request(app).post("/api/register").send({
      ...validBody(), referral_channel: "TikTok",
    });
    expect(res.status).toBe(400);
  });

  it("rate-limits 6th submission from same IP within 10 minutes", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/register").send({
        ...validBody(), email: `user${i}@example.com`,
      });
    }
    const res = await request(app).post("/api/register").send({
      ...validBody(), email: "user6@example.com",
    });
    expect(res.status).toBe(429);
  });

  it("on payment_reference collision, retries and eventually inserts", async () => {
    // Mock: first INSERT returns 23505 with payment_reference detail, second succeeds
    // Assert: participant_reference in response differs from the colliding one
  });

  it("on (email,seminar) race (23505 after passing SELECT), returns 409 dedup", async () => {
    // Mock: SELECT returns null, INSERT throws 23505 with email+seminar detail,
    // re-SELECT returns existing pending+pending row
    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("pending_unpaid");
  });
});

function validBody() {
  return {
    civilite: "Mme", nom: "Koffi", prenom: "Marie",
    email: "marie@example.com", tel: "+22507000000",
    societe: "Acme", fonction: "DG", seminar: "s1",
    referral_channel: "LinkedIn",
    consent: true,
  };
}
```

- [ ] **Step 2: Extract registration logic into `api/lib/registration.ts`**

Skeleton (full implementation):

```ts
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePaymentReference } from "./payment-reference.js";

export const RegisterBodySchema = z.object({
  civilite: z.enum(["M.", "Mme"]).optional(),
  nom: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  tel: z.string().trim().max(40).optional(),
  societe: z.string().trim().max(200).optional(),
  fonction: z.string().trim().min(1).max(200),
  seminar: z.string().trim().min(1),
  referral_channel: z.enum([
    "Recommandation","LinkedIn","Facebook","Instagram",
    "Google","Email","Évènement","Autre",
  ]),
  referrer_name: z.string().trim().max(200).optional(),
  channel_other: z.string().trim().max(500).optional(),
  consent: z.literal(true),
}).superRefine((v, ctx) => {
  if (v.referral_channel === "Recommandation" && !v.referrer_name) {
    ctx.addIssue({ code: "custom", path: ["referrer_name"], message: "required" });
  }
  if (v.referral_channel === "Autre" && !v.channel_other) {
    ctx.addIssue({ code: "custom", path: ["channel_other"], message: "required" });
  }
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export type DedupState = "pending_unpaid" | "pending_paid" | "confirmed";

export interface RegisterResult {
  status: "created" | "duplicate";
  participantId?: string;
  paymentReference?: string;
  state?: DedupState;
  actionTaken?: "resent_confirmation" | "sent_magic_link" | "none";
}

export async function registerOrDedup(
  body: RegisterBody,
  supabase: SupabaseClient,
): Promise<RegisterResult> {
  // 1. Look up existing non-cancelled row
  const { data: existing } = await supabase
    .from("participants")
    .select("id,status,payment,payment_reference")
    .eq("email", body.email)
    .eq("seminar", body.seminar)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === "confirmed") {
      return { status: "duplicate", state: "confirmed",
               actionTaken: "sent_magic_link",
               participantId: existing.id,
               paymentReference: existing.payment_reference };
    }
    if (existing.status === "pending" && existing.payment === "paid") {
      return { status: "duplicate", state: "pending_paid",
               actionTaken: "none",
               participantId: existing.id,
               paymentReference: existing.payment_reference };
    }
    // pending + pending
    return { status: "duplicate", state: "pending_unpaid",
             actionTaken: "resent_confirmation",
             participantId: existing.id,
             paymentReference: existing.payment_reference };
  }

  // 2. Insert new row. Catch unique-violation (23505) for both:
  //    - active (email, seminar) collision (TOCTOU race against the SELECT above)
  //    - payment_reference collision (~5% birthday-paradox risk; retry with new ref)
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const provisionalId = crypto.randomUUID();
    const ref = generatePaymentReference(provisionalId);
    const { data: inserted, error } = await supabase
      .from("participants")
      .insert({
        id: provisionalId,
        civilite: body.civilite ?? null,
        nom: body.nom, prenom: body.prenom, email: body.email,
        tel: body.tel ?? null, societe: body.societe ?? null,
        fonction: body.fonction, seminar: body.seminar,
        amount: 0, // resolved by caller using seminars data
        status: "pending", payment: "pending",
        referral_channel: body.referral_channel,
        referrer_name: body.referrer_name ?? null,
        channel_other: body.channel_other ?? null,
        consent_at: new Date().toISOString(),
        payment_reference: ref,
      })
      .select("id")
      .single();

    if (!error && inserted) {
      return {
        status: "created",
        participantId: inserted.id,
        paymentReference: ref,
      };
    }
    lastError = error;

    // Postgres 23505 = unique_violation
    if ((error as any)?.code !== "23505") throw error;

    // Distinguish which constraint failed
    const detail = String((error as any)?.message ?? "") + String((error as any)?.details ?? "");
    if (detail.includes("payment_reference")) {
      continue; // retry with new generated reference
    }
    if (detail.includes("email") && detail.includes("seminar")) {
      // Race: another request inserted the same (email, seminar) between our SELECT and INSERT.
      // Re-run the dedup lookup — the row now exists.
      const { data: existing } = await supabase
        .from("participants")
        .select("id,status,payment,payment_reference")
        .eq("email", body.email)
        .eq("seminar", body.seminar)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle();
      if (!existing) throw error; // shouldn't happen; rethrow
      if (existing.status === "confirmed") {
        return { status: "duplicate", state: "confirmed",
                 actionTaken: "sent_magic_link",
                 participantId: existing.id, paymentReference: existing.payment_reference };
      }
      if (existing.status === "pending" && existing.payment === "paid") {
        return { status: "duplicate", state: "pending_paid",
                 actionTaken: "none",
                 participantId: existing.id, paymentReference: existing.payment_reference };
      }
      return { status: "duplicate", state: "pending_unpaid",
               actionTaken: "resent_confirmation",
               participantId: existing.id, paymentReference: existing.payment_reference };
    }
    throw error; // other unique constraint we don't know how to handle
  }
  throw lastError ?? new Error("registration: 3 collision retries exhausted");
}
```

- [ ] **Step 3: Wire into app.ts**

In `api/app.ts`, replace the existing `/api/notify-registration` POST handler with:

```ts
import { RegisterBodySchema, registerOrDedup } from "./lib/registration.js";
import { renderEmail } from "./lib/render-email.js";
import { sendEmail } from "./lib/send-email.js";
import { registrationConfirmation } from "./email-templates/registration-confirmation.js";
import { adminNewRegistration } from "./email-templates/admin-new-registration.js";
import { magicLink } from "./email-templates/magic-link.js";
import { generateMagicLinkUrl } from "./lib/magic-link.js"; // see Task 12

// D19: rate-limit /api/register to prevent Resend quota / inbox abuse
const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/register", registerLimiter, async (req, res) => {
  const parsed = RegisterBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "validation", issues: parsed.error.issues });
  }
  const body = parsed.data;

  // Resolve seminar metadata (title, dates, amount) from seminars table
  const { data: seminar } = await supabase
    .from("seminars").select("id,title,dates,amount,code")
    .eq("id", body.seminar).maybeSingle();
  if (!seminar) return res.status(400).json({ error: "unknown_seminar" });

  let result;
  try {
    result = await registerOrDedup(body, supabase);
  } catch (e) {
    console.error("[register] insert failed", e);
    return res.status(500).json({ error: "internal" });
  }

  const supportPhone = process.env.SUPPORT_PHONE ?? "+225 07 02 61 15 82";
  const siteUrl = process.env.SITE_URL ?? "https://rmkconseils.com";
  const fromEmail = process.env.EMAIL_FROM ?? "RMK Conseils <noreply@rmkconseils.com>";
  const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);

  if (result.status === "created") {
    // Email failures must not block the 201 — DB row is the source of truth.
    // Use Promise.allSettled and log failures rather than throwing.
    const sends: Promise<void>[] = [
      sendEmail(
        renderEmail(registrationConfirmation, {
          prenom: body.prenom, civilite: body.civilite,
          seminarTitle: seminar.title, seminarDates: seminar.dates,
          amountFcfa: seminar.amount, paymentReference: result.paymentReference!,
          supportPhone, siteUrl,
        }),
        { to: body.email, ...emailCfg() },
      ),
    ];
    if (adminEmails.length) {
      sends.push(sendEmail(
        renderEmail(adminNewRegistration, {
          prenom: body.prenom, nom: body.nom, civilite: body.civilite,
          email: body.email, tel: body.tel, societe: body.societe,
          fonction: body.fonction, seminarTitle: seminar.title,
          amountFcfa: seminar.amount,
          referralChannel: body.referral_channel,
          referrerName: body.referrer_name,
          channelOther: body.channel_other,
          paymentReference: result.paymentReference!,
          participantId: result.participantId!,
          adminUrl: siteUrl,
        }),
        { to: adminEmails, ...emailCfg() },
      ));
    }
    const results = await Promise.allSettled(sends);
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[register] email ${i} failed for ${body.email}:`, r.reason);
      }
    });
    return res.status(201).json({
      participant_id: result.participantId,
      payment_reference: result.paymentReference,
    });
  }

  // Duplicate branches
  if (result.state === "pending_unpaid") {
    // resend confirmation
    await sendEmail(
      renderEmail(registrationConfirmation, {
        prenom: body.prenom, civilite: body.civilite,
        seminarTitle: seminar.title, seminarDates: seminar.dates,
        amountFcfa: seminar.amount, paymentReference: result.paymentReference!,
        supportPhone, siteUrl,
      }),
      { to: body.email, ...emailCfg() },
    );
  } else if (result.state === "confirmed") {
    // send magic link (uses helper from Task 12)
    const url = await generateMagicLinkUrl(body.email, supabase);
    if (url) {
      await sendEmail(
        renderEmail(magicLink, {
          prenom: body.prenom, seminarTitle: seminar.title,
          magicLinkUrl: url, supportPhone,
        }),
        { to: body.email, ...emailCfg() },
      );
    }
  }

  return res.status(409).json({
    error: "duplicate_registration",
    state: result.state,
    payment_reference: result.paymentReference,
    action_taken: result.actionTaken,
  });
});

function emailCfg() {
  return {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "RMK Conseils <noreply@rmkconseils.com>",
  };
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS — all new + existing tests.

- [ ] **Step 5: Commit**

```bash
git add api/lib/registration.ts api/app.ts api/__tests__/registration-dedup.test.ts
git commit -m "feat(api): /api/register endpoint with dedup matrix and channel capture"
```

---

### Task 12: Magic-link generation helper + endpoint

**Files:**
- Create: `api/lib/magic-link.ts`
- Create: `api/routes/auth-magic-link.ts` (or add to app.ts)
- Test: `api/__tests__/auth-magic-link.test.ts`

- [ ] **Step 1: Tests**

Create `api/__tests__/auth-magic-link.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

// Mocks for supabase admin + resend
// ...

describe("POST /api/auth/send-magic-link", () => {
  beforeEach(() => { /* fresh app */ });

  it("returns 200 with no body when email matches confirmed participant", async () => {
    // mock lookup returns {prenom:'Marie', seminar:'s1'}
    // mock generateLink returns {properties:{action_link:'https://...'}}
    const res = await request(app).post("/api/auth/send-magic-link")
      .send({ email: "marie@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // assert sendEmail called
  });

  it("returns 200 with same shape when email NOT in DB (no leak)", async () => {
    const res = await request(app).post("/api/auth/send-magic-link")
      .send({ email: "stranger@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    // assert sendEmail NOT called
  });

  it("returns 200 when email is pending (no leak — same response)", async () => {
    // lookup returns participant with status='pending'
    const res = await request(app).post("/api/auth/send-magic-link")
      .send({ email: "marie@example.com" });
    expect(res.status).toBe(200);
    // sendEmail NOT called
  });

  it("rate-limits 4th request within 5 minutes", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/auth/send-magic-link").send({ email: "a@b.com" });
    }
    const res = await request(app).post("/api/auth/send-magic-link").send({ email: "a@b.com" });
    expect(res.status).toBe(429);
  });

  it("rejects malformed email with 400", async () => {
    const res = await request(app).post("/api/auth/send-magic-link").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement helper**

Create `api/lib/magic-link.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateMagicLinkUrl(
  email: string,
  supabaseAdmin: SupabaseClient,
  redirectTo: string = `${process.env.SITE_URL ?? "https://rmkconseils.com"}/portal`,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error || !data.properties?.action_link) return null;
  return data.properties.action_link;
}
```

- [ ] **Step 3: Wire endpoint**

In `api/app.ts`:

```ts
import rateLimit from "express-rate-limit";

const magicLinkLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email ?? "").toLowerCase()}`,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/auth/send-magic-link", magicLinkLimiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  // Anti-enumeration: always 200, regardless of outcome
  const respond = () => res.json({ ok: true });

  const { data: participant } = await supabase
    .from("participants")
    .select("prenom, seminar")
    .eq("email", email)
    .eq("status", "confirmed")
    .maybeSingle();

  if (!participant) return respond();

  const { data: seminar } = await supabase
    .from("seminars").select("title").eq("id", participant.seminar).maybeSingle();

  const url = await generateMagicLinkUrl(email, supabaseAdmin);
  if (!url) return respond();

  await sendEmail(
    renderEmail(magicLink, {
      prenom: participant.prenom,
      seminarTitle: seminar?.title ?? "votre formation",
      magicLinkUrl: url,
      supportPhone: process.env.SUPPORT_PHONE ?? "+225 07 02 61 15 82",
    }),
    { to: email, resendApiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.EMAIL_FROM ?? "RMK Conseils <noreply@rmkconseils.com>" },
  );

  respond();
});
```

(Note: `supabaseAdmin` is a separate client created at app init using `SUPABASE_SERVICE_ROLE_KEY` — see existing app.ts pattern, the service-role client likely already exists.)

- [ ] **Step 4: Run tests + commit**

```bash
npm test -- auth-magic-link
git add api/lib/magic-link.ts api/app.ts api/__tests__/auth-magic-link.test.ts
git commit -m "feat(api): magic-link endpoint with rate limit and anti-enumeration"
```

---

### Task 13: POST /api/admin/participants/:id/mark-paid

**Depends on:** Task 12 (`generateMagicLinkUrl`), Task 8 (`welcomeConfirmed` template).

**Files:**
- Modify: `api/app.ts` (new endpoint)
- Test: `api/__tests__/admin-mark-paid.test.ts`

- [ ] **Step 1: Tests**

```ts
describe("POST /api/admin/participants/:id/mark-paid", () => {
  it("requires admin auth", async () => {
    const res = await request(app).post("/api/admin/participants/abc/mark-paid");
    expect(res.status).toBe(401);
  });

  it("flips status=confirmed AND payment=paid in one call", async () => {
    // mock auth as admin, mock current row {status:'pending', payment:'pending'}
    const res = await request(app)
      .post("/api/admin/participants/abc/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({ payment_provider: "wave" });
    expect(res.status).toBe(200);
    // assert update payload {status:'confirmed', payment:'paid', confirmed_at:..., payment_provider:'wave'}
  });

  it("triggers welcome email with magic link", async () => {
    // mock the same setup
    // assert sendEmail called with welcomeConfirmed template
  });

  it("idempotent — already-confirmed returns 200 without re-sending email", async () => {
    // mock current row {status:'confirmed', payment:'paid'}
    const res = await request(app)
      .post("/api/admin/participants/abc/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({});
    expect(res.status).toBe(200);
    // assert sendEmail NOT called
  });

  it("rejects unknown payment_provider value", async () => {
    const res = await request(app)
      .post("/api/admin/participants/abc/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({ payment_provider: "bitcoin" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { z } from "zod";
import { welcomeConfirmed } from "./email-templates/welcome-confirmed.js";

const MarkPaidBody = z.object({
  payment_provider: z.enum(["wave","orange_money","bank_transfer","cash"]).optional(),
  confirmation_notes: z.string().trim().max(2000).optional(),
});

app.post("/api/admin/participants/:id/mark-paid", requireAdmin, async (req, res) => {
  const parsed = MarkPaidBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "validation" });

  const { data: current } = await supabase
    .from("participants").select("*").eq("id", req.params.id).maybeSingle();
  if (!current) return res.status(404).json({ error: "not_found" });

  // Idempotency via conditional UPDATE: only flip when not already confirmed.
  // Returning 'id' lets us count rows affected — if 0, this was a no-op (concurrent dup),
  // so we do NOT send the welcome email.
  const { data: updated, error } = await supabase
    .from("participants")
    .update({
      status: "confirmed",
      payment: "paid",
      confirmed_at: new Date().toISOString(),
      confirmed_by_admin_id: req.adminId,            // set by requireAdmin middleware
      confirmation_notes: parsed.data.confirmation_notes ?? null,
      payment_provider: parsed.data.payment_provider ?? current.payment_provider,
    })
    .eq("id", req.params.id)
    .neq("status", "confirmed")        // only flip if not already confirmed
    .select("id");

  if (error) return res.status(500).json({ error: "update_failed" });
  const wasAlreadyConfirmed = !updated || updated.length === 0;

  if (!wasAlreadyConfirmed) {
    const { data: seminar } = await supabase
      .from("seminars").select("title,dates").eq("id", current.seminar).maybeSingle();
    const url = await generateMagicLinkUrl(current.email, supabaseAdmin);
    if (url) {
      await sendEmail(
        renderEmail(welcomeConfirmed, {
          prenom: current.prenom,
          seminarTitle: seminar?.title ?? "votre formation",
          seminarDates: seminar?.dates ?? "",
          magicLinkUrl: url,
          portalUrl: `${process.env.SITE_URL}/portal`,
          supportPhone: process.env.SUPPORT_PHONE ?? "+225 07 02 61 15 82",
        }),
        { to: current.email, resendApiKey: process.env.RESEND_API_KEY ?? "",
          from: process.env.EMAIL_FROM ?? "" },
      );
    }
  }

  res.json({ ok: true, was_already_confirmed: wasAlreadyConfirmed });
});
```

`requireAdmin` middleware reuses the existing pattern from the app (checks bearer token against admin_users via Supabase).

- [ ] **Step 3: Run tests + commit**

```bash
npm test -- admin-mark-paid
git commit -am "feat(api): admin mark-paid endpoint with welcome email trigger"
```

---

### Task 14: SLA reminder cron endpoint

**Files:**
- Modify: `api/app.ts` (new endpoint)
- Modify: `vercel.json`
- Test: `api/__tests__/sla-reminder.test.ts`

- [ ] **Step 1: Tests**

```ts
describe("POST /api/cron/sla-reminder", () => {
  it("rejects without CRON_SECRET", async () => {
    const res = await request(app).post("/api/cron/sla-reminder");
    expect(res.status).toBe(401);
  });

  it("returns count=0 when no stale rows", async () => {
    // mock select returns []
    const res = await request(app)
      .post("/api/cron/sla-reminder")
      .set("Authorization", `Bearer ${process.env.CRON_SECRET}`);
    expect(res.body.count).toBe(0);
    // assert NO email sent
  });

  it("emails admins when stale rows exist", async () => {
    // mock select returns 2 rows older than 48h
    const res = await request(app)
      .post("/api/cron/sla-reminder")
      .set("Authorization", `Bearer ${process.env.CRON_SECRET}`);
    expect(res.body.count).toBe(2);
    // assert sendEmail called once with adminSlaReminder template, 2 rows
  });

  it("ignores rows where payment=paid (just status=pending)", async () => {
    // mock returns 1 row with payment='paid' — should be excluded
    // ...
  });
});
```

- [ ] **Step 2: Implement**

```ts
import { adminSlaReminder } from "./email-templates/admin-sla-reminder.js";

app.post("/api/cron/sla-reminder", async (req, res) => {
  const auth = req.header("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return res.sendStatus(401);

  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("participants")
    .select("id,prenom,nom,email,seminar,payment_reference,created_at")
    .eq("status", "pending")
    .eq("payment", "pending")
    .lt("created_at", cutoff);

  if (!stale || stale.length === 0) {
    return res.json({ count: 0 });
  }

  // Resolve seminar titles
  const ids = [...new Set(stale.map(r => r.seminar))];
  const { data: seminars } = await supabase
    .from("seminars").select("id,title").in("id", ids);
  const titleById = new Map((seminars ?? []).map(s => [s.id, s.title]));

  const rows = stale.map(r => ({
    prenom: r.prenom, nom: r.nom, email: r.email,
    seminarTitle: titleById.get(r.seminar) ?? r.seminar,
    paymentReference: r.payment_reference ?? "—",
    hoursWaiting: Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3600_000),
  }));

  const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);
  if (adminEmails.length) {
    await sendEmail(
      renderEmail(adminSlaReminder, {
        rows,
        adminUrl: process.env.SITE_URL ?? "https://rmkconseils.com",
      }),
      { to: adminEmails, resendApiKey: process.env.RESEND_API_KEY ?? "",
        from: process.env.EMAIL_FROM ?? "" },
    );
  }

  res.json({ count: rows.length });
});
```

- [ ] **Step 3: Wire Vercel Cron**

Modify `vercel.json` (create if absent):

```json
{
  "crons": [
    {
      "path": "/api/cron/sla-reminder",
      "schedule": "0 9 * * *"
    }
  ]
}
```

(Vercel automatically injects `Authorization: Bearer $CRON_SECRET` if `CRON_SECRET` is set as an env var. If using a custom value, ensure it matches.)

- [ ] **Step 4: Tests + commit**

```bash
npm test -- sla-reminder
git add api/app.ts vercel.json api/__tests__/sla-reminder.test.ts
git commit -m "feat(cron): daily SLA reminder for stale pending registrations"
```

---

# Phase 1D — Frontend: form, post-submit, public pages

Goal: rebuild the inscription form with channel + consent, route to a new post-submit screen, expose a `/paiement` public page.

---

### Task 15: Brand logo assets

**Files:**
- Create: `public/payment-logos/wave.svg`
- Create: `public/payment-logos/wave@2x.png`
- Create: `public/payment-logos/orange-money.svg`
- Create: `public/payment-logos/orange-money@2x.png`

- [ ] **Step 1: Source official assets**

Download from:
- Wave: brand kit at https://wave.com/legal/brand-guidelines (or request via press@wave.com)
- Orange Money: Orange brand portal (or use the Orange wordmark + "Money" lockup if Money-specific assets aren't public)

Save the SVGs at the paths above. Generate PNG fallbacks at exactly **96×32 px @2x** (for retina) using ImageMagick or similar:

```bash
# from a 192×64 source SVG
magick wave.svg -resize 192x64 wave@2x.png
magick orange-money.svg -resize 192x64 orange-money@2x.png
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`, open `http://localhost:8080/payment-logos/wave.svg` and `/wave@2x.png`. Both must render.

- [ ] **Step 3: Commit**

```bash
git add public/payment-logos/
git commit -m "chore(assets): add Wave and Orange Money official brand logos"
```

---

### Task 16: `<CopyableReference>` component

**Files:**
- Create: `src/components/CopyableReference.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";

interface Props {
  reference: string;
}

export function CopyableReference({ reference }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {/* no-op on insecure context */}
  };

  return (
    <div style={{
      background: "#FFF8E1",
      border: "2px solid #C9A84C",
      borderRadius: 8,
      padding: 20,
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#C9A84C",
        letterSpacing: 1.5, marginBottom: 8,
      }}>
        ⚠ IMPORTANT — À INDIQUER DANS LE MOTIF
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <code style={{
          fontFamily: "Menlo, Consolas, monospace",
          fontSize: 28, fontWeight: 700, color: "#1B2A4A",
          letterSpacing: 2,
        }}>{reference}</code>
        <button onClick={copy} aria-label="Copier la référence" style={{
          background: "#1B2A4A", color: "#fff", border: 0,
          borderRadius: 6, padding: "8px 12px", cursor: "pointer",
          fontSize: 13,
        }}>
          {copied ? "✓ Copié" : "📋 Copier"}
        </button>
      </div>
      <div style={{ fontSize: 13, color: "#5a4a1a", marginTop: 12, lineHeight: 1.5 }}>
        Saisissez ce code dans le champ «&nbsp;motif&nbsp;» ou «&nbsp;raison du transfert&nbsp;»
        lors de votre paiement Wave / Orange Money / virement.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CopyableReference.tsx
git commit -m "feat(ui): CopyableReference component with clipboard copy"
```

---

### Task 17: `<PaymentInstructions>` component

**Files:**
- Create: `src/components/PaymentInstructions.tsx`

- [ ] **Step 1: Implement**

```tsx
import { CopyableReference } from "./CopyableReference";

interface Props {
  reference?: string;       // optional — generic /paiement page omits it
  amountFcfa?: number;
  supportPhone: string;
}

const fmtAmount = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export function PaymentInstructions({ reference, amountFcfa, supportPhone }: Props) {
  const waNumber = supportPhone.replace(/\D/g, "");

  return (
    <section aria-labelledby="payment-heading">
      <h2 id="payment-heading" style={{ color: "#1B2A4A", marginTop: 0 }}>
        Modalités de paiement
      </h2>

      {reference && <CopyableReference reference={reference} />}
      {amountFcfa != null && (
        <p style={{ fontSize: 16, marginTop: 16 }}>
          <strong>Montant&nbsp;:</strong> {fmtAmount(amountFcfa)}
        </p>
      )}

      <ul style={{
        listStyle: "none", padding: 0, marginTop: 20,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <PaymentRow logo="/payment-logos/wave.svg" alt="Wave"
                    label="Wave" value={supportPhone} />
        <PaymentRow logo="/payment-logos/orange-money.svg" alt="Orange Money"
                    label="Orange Money" value={supportPhone} />
        <PaymentRow logo={null} alt="" label="Virement bancaire"
                    value={`Contactez-nous : ${supportPhone}`} />
      </ul>

      <div style={{
        background: "#F5F1E4", padding: "12px 16px", borderRadius: 6,
        marginTop: 20, fontSize: 14,
      }}>
        📞 <strong>Question ou virement&nbsp;:</strong>{" "}
        <a href={`https://wa.me/${waNumber}`} style={{ color: "#1B2A4A" }}>
          {supportPhone}
        </a>{" "}
        (Appel/WhatsApp)
      </div>
    </section>
  );
}

function PaymentRow({ logo, alt, label, value }: {
  logo: string | null; alt: string; label: string; value: string;
}) {
  return (
    <li style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: 12, background: "#fff", border: "1px solid #e7e3d6",
      borderRadius: 8,
    }}>
      <div style={{ width: 40, display: "flex", justifyContent: "center" }}>
        {logo ? <img src={logo} alt={alt} height={32} /> : <span style={{ fontSize: 24 }}>🏦</span>}
      </div>
      <div style={{ flex: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "Menlo, monospace", color: "#1B2A4A" }}>{value}</div>
    </li>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PaymentInstructions.tsx
git commit -m "feat(ui): PaymentInstructions component (Wave + OM + virement)"
```

---

### Task 18: `<ChannelField>` component

**Files:**
- Create: `src/components/ChannelField.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";

const CHANNELS = [
  "Recommandation","LinkedIn","Facebook","Instagram",
  "Google","Email","Évènement","Autre",
] as const;
export type Channel = typeof CHANNELS[number];

interface Props {
  value: Channel | "";
  onChange: (v: Channel | "") => void;
  referrerName: string;
  onReferrerNameChange: (v: string) => void;
  channelOther: string;
  onChannelOtherChange: (v: string) => void;
  required?: boolean;
}

export function ChannelField(props: Props) {
  return (
    <div>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
        Comment nous avez-vous connu&nbsp;? {props.required && <span style={{ color: "#c44" }}>*</span>}
      </label>
      <select
        value={props.value}
        onChange={e => props.onChange(e.target.value as Channel | "")}
        required={props.required}
        style={selectStyle}
      >
        <option value="">— Sélectionner —</option>
        {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {props.value === "Recommandation" && (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Nom de la personne qui vous recommande <span style={{ color: "#c44" }}>*</span>
          </label>
          <input type="text" required value={props.referrerName}
                 onChange={e => props.onReferrerNameChange(e.target.value)}
                 style={inputStyle} />
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Avec son accord, nous pourrons le remercier.
          </div>
        </div>
      )}

      {props.value === "Autre" && (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Précisez <span style={{ color: "#c44" }}>*</span>
          </label>
          <input type="text" required value={props.channelOther}
                 onChange={e => props.onChannelOtherChange(e.target.value)}
                 style={inputStyle} />
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.15)", fontSize: 15,
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ChannelField.tsx
git commit -m "feat(ui): ChannelField with conditional recommender/other inputs"
```

---

### Task 19: `<ConsentCheckbox>` component

**Files:**
- Create: `src/components/ConsentCheckbox.tsx`

- [ ] **Step 1: Implement**

```tsx
interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function ConsentCheckbox({ checked, onChange }: Props) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, lineHeight: 1.5 }}>
      <input
        type="checkbox" required checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 3 }}
      />
      <span>
        J'accepte les{" "}
        <a href="/cgu" target="_blank" rel="noopener" style={{ color: "#C9A84C" }}>conditions générales</a>{" "}
        et la{" "}
        <a href="/confidentialite" target="_blank" rel="noopener" style={{ color: "#C9A84C" }}>politique de confidentialité</a>{" "}
        de RMK Conseils. <span style={{ color: "#c44" }}>*</span>
      </span>
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ConsentCheckbox.tsx
git commit -m "feat(ui): ConsentCheckbox with CGU/confidentialité links"
```

---

### Task 20: Wire new fields into LandingPage form

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1: Add state**

In the existing form state hook, add:

```ts
const [referralChannel, setReferralChannel] = useState<Channel | "">("");
const [referrerName, setReferrerName] = useState("");
const [channelOther, setChannelOther] = useState("");
const [consent, setConsent] = useState(false);
```

- [ ] **Step 2: Render fields**

In the form JSX (after the existing fields, before the submit button), render:

```tsx
<ChannelField
  value={referralChannel}
  onChange={setReferralChannel}
  referrerName={referrerName}
  onReferrerNameChange={setReferrerName}
  channelOther={channelOther}
  onChannelOtherChange={setChannelOther}
  required
/>

<ConsentCheckbox checked={consent} onChange={setConsent} />
```

- [ ] **Step 3: Default tel to +225**

Change the `tel` input's `defaultValue` (or initial state) to `"+225 "` and update placeholder to `"+225 07 00 00 00 00"`.

- [ ] **Step 4: Update submit handler**

Replace the `fetch('/api/notify-registration', ...)` call with:

```ts
const res = await fetch("/api/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    civilite, nom, prenom, email, tel, societe, fonction, seminar: selectedSeminarId,
    referral_channel: referralChannel,
    referrer_name: referrerName || undefined,
    channel_other: channelOther || undefined,
    consent: true,
  }),
});

const json = await res.json();

if (res.status === 201) {
  navigate("/inscription/confirmee", {
    state: { paymentReference: json.payment_reference, prenom, seminar: selectedSeminarId },
  });
  return;
}

if (res.status === 409) {
  if (json.state === "confirmed") {
    setError("Vous êtes déjà inscrit·e à cet atelier. Nous venons de vous envoyer un lien d'accès par email.");
  } else if (json.state === "pending_paid") {
    setError("Votre paiement est en cours de validation. Vous recevrez votre accès dès confirmation.");
  } else {
    // pending_unpaid: route to post-submit screen with the existing reference
    navigate("/inscription/confirmee", {
      state: { paymentReference: json.payment_reference, prenom, seminar: selectedSeminarId, isReminder: true },
    });
  }
  return;
}

setError("Une erreur est survenue. Veuillez réessayer.");
```

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
# Open http://localhost:8080
# Submit a new email → should redirect to /inscription/confirmee with payment reference
# Submit the same email again → should redirect with isReminder=true
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "feat(landing): channel field, consent, post-submit redirect"
```

---

### Task 21: `<PostSubmitScreen>` component + route

**Files:**
- Create: `src/components/PostSubmitScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useLocation, Link } from "react-router";
import { PaymentInstructions } from "./PaymentInstructions";

interface State {
  paymentReference: string;
  prenom: string;
  seminar: string;
  isReminder?: boolean;
}

export function PostSubmitScreen() {
  const { state } = useLocation() as { state: State | null };
  if (!state) return <Navigate to="/" />;

  const supportPhone = "+225 07 02 61 15 82";

  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 24 }}>
      <div style={{
        background: "#fff", border: "1px solid #e7e3d6",
        borderRadius: 16, padding: 32,
      }}>
        <h1 style={{ color: "#1B2A4A", marginTop: 0 }}>
          {state.isReminder ? "Votre demande est déjà enregistrée" : "Votre demande a été enregistrée"}
        </h1>

        <p style={{ fontSize: 16 }}>
          Bonjour <strong>{state.prenom}</strong>, merci pour votre inscription.
          {state.isReminder
            ? " Voici un rappel des modalités de paiement — nous venons de vous renvoyer cet email."
            : " Vous recevrez bientôt un email de confirmation avec ces mêmes informations."}
        </p>

        <PaymentInstructions
          reference={state.paymentReference}
          // amount resolved client-side from seminar id (or returned in API response)
          supportPhone={supportPhone}
        />

        <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/brochure.pdf" download style={btnPrimary}>
            📄 Télécharger la brochure
          </a>
          <Link to="/" style={btnSecondary}>← Retour à l'accueil</Link>
        </div>

        <p style={{ marginTop: 24, color: "#666", fontSize: 14 }}>
          Dès réception de votre paiement, votre espace participant sera activé sous 24h ouvrées.
        </p>
      </div>
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "#C9A84C", color: "#1B2A4A", padding: "12px 24px",
  borderRadius: 8, textDecoration: "none", fontWeight: 700,
};
const btnSecondary: React.CSSProperties = {
  background: "transparent", color: "#1B2A4A", padding: "12px 24px",
  borderRadius: 8, textDecoration: "none", border: "1px solid #1B2A4A",
};
```

(Brochure URL: serve a static PDF at `public/brochure.pdf` or expose an endpoint that calls `brochurePdf.ts`.)

- [ ] **Step 2: Add route**

In `src/App.tsx`, add:

```tsx
import { PostSubmitScreen } from "./components/PostSubmitScreen";
// ...
<Route path="/inscription/confirmee" element={<PostSubmitScreen />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PostSubmitScreen.tsx src/App.tsx
git commit -m "feat(landing): PostSubmitScreen route with payment instructions"
```

---

### Task 21b: Brochure download endpoint

**Why:** Tasks 21 and 24 link to `/brochure.pdf` but no task provisions the file. The existing `src/admin/brochurePdf.ts` generates the PDF in-memory; we expose it as a server endpoint that streams a freshly-generated PDF on demand. This avoids checking a binary into git and keeps the brochure in sync with `seminars.ts` automatically.

**Files:**
- Create: `api/routes/brochure.ts` (or add to `api/app.ts`)
- Test: `api/__tests__/brochure-route.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("GET /brochure.pdf", () => {
  it("returns a PDF (application/pdf, %PDF magic bytes)", async () => {
    const app = createApp({ /* ... */ });
    const res = await request(app).get("/brochure.pdf");
    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toMatch(/application\/pdf/);
    expect(res.body.slice(0, 4).toString()).toBe("%PDF");
  });
  it("sets Content-Disposition for download", async () => {
    const res = await request(app).get("/brochure.pdf");
    expect(res.header["content-disposition"]).toMatch(/attachment.*brochure/i);
  });
  it("caches for 24h (responses stable for the day)", async () => {
    const res = await request(app).get("/brochure.pdf");
    expect(res.header["cache-control"]).toMatch(/max-age=86400/);
  });
});
```

- [ ] **Step 2: Implement**

In `api/app.ts`:

```ts
import { generateBrochurePdf } from "../src/admin/brochurePdf.js";  // existing module

app.get("/brochure.pdf", async (_req, res) => {
  try {
    const pdfBuffer = await generateBrochurePdf();   // returns Buffer or Uint8Array
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="rmk-brochure.pdf"');
    res.setHeader("Cache-Control", "public, max-age=86400");  // 24h
    res.send(pdfBuffer);
  } catch (e) {
    console.error("[brochure] generation failed", e);
    res.status(500).send("PDF generation failed");
  }
});
```

If `brochurePdf.ts` currently triggers a download via jsPDF's `save()`, refactor to expose a pure function that returns the binary (`doc.output("arraybuffer")` → `Buffer.from(...)`). The existing in-browser code path stays as a thin wrapper around the same generator.

- [ ] **Step 3: Smoke test**

```bash
npm run dev
open http://localhost:8080/brochure.pdf
# Should download or render a multi-page PDF
```

- [ ] **Step 4: Commit**

```bash
git add api/app.ts api/__tests__/brochure-route.test.ts
git commit -m "feat(api): /brochure.pdf endpoint streams generated PDF on demand"
```

---

### Task 22: `/paiement` public page + `/cgu` + `/confidentialite` placeholders

**Files:**
- Create: `src/pages/Paiement.tsx`
- Create: `src/pages/Cgu.tsx`
- Create: `src/pages/Confidentialite.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement /paiement**

```tsx
import { PaymentInstructions } from "../components/PaymentInstructions";

export function Paiement() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 24 }}>
      <h1 style={{ color: "#1B2A4A" }}>Modalités de paiement — RMK Conseils</h1>
      <p>
        Vous trouverez ci-dessous les coordonnées pour régler votre inscription
        à nos formations. Pour rappel, indiquez <strong>votre référence personnelle</strong>
        (reçue par email lors de votre inscription) dans le champ
        «&nbsp;motif&nbsp;» de votre paiement.
      </p>
      <PaymentInstructions supportPhone="+225 07 02 61 15 82" />
    </main>
  );
}
```

- [ ] **Step 2: Placeholder legal pages**

```tsx
// src/pages/Cgu.tsx
export function Cgu() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 24 }}>
      <h1>Conditions générales d'utilisation</h1>
      <p style={{ color: "#666" }}>Document en cours de finalisation. Pour toute question : +225 07 02 61 15 82.</p>
    </main>
  );
}
```

(`Confidentialite.tsx` is identical structure with appropriate heading.)

- [ ] **Step 3: Routes**

```tsx
import { Paiement } from "./pages/Paiement";
import { Cgu } from "./pages/Cgu";
import { Confidentialite } from "./pages/Confidentialite";
// ...
<Route path="/paiement" element={<Paiement />} />
<Route path="/cgu" element={<Cgu />} />
<Route path="/confidentialite" element={<Confidentialite />} />
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Paiement.tsx src/pages/Cgu.tsx src/pages/Confidentialite.tsx src/App.tsx
git commit -m "feat(routes): add /paiement, /cgu, /confidentialite public pages"
```

---

# Phase 1E — Frontend: portal magic-link swap, pending screen upgrade

Goal: route the portal's magic-link request through the new server endpoint, upgrade the pending screen with payment instructions.

---

### Task 23: ClientPortal magic-link flow swap

**Files:**
- Modify: `src/pages/ClientPortal.tsx` (lines 159-178 area)

- [ ] **Step 1: Replace `signInWithOtp` call**

Replace the body of `sendMagicLink`:

```ts
const sendMagicLink = useCallback(async (targetEmail?: string) => {
  const trimmedEmail = (targetEmail ?? email).trim().toLowerCase();
  if (!trimmedEmail) return;
  setLoading(true);
  setError("");
  try {
    const res = await fetch("/api/auth/send-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail }),
    });
    if (res.status === 429) {
      setError("Trop de demandes. Veuillez patienter quelques minutes.");
    } else if (res.ok) {
      setAuthStep("sent");
    } else {
      setError("Impossible d'envoyer le lien. Vérifiez votre email et réessayez.");
    }
  } catch {
    setError("Erreur réseau. Veuillez réessayer.");
  }
  setLoading(false);
}, [email]);
```

(Note: anti-enumeration means we always show "lien envoyé" even when no participant exists — copy already says "if your email matches a confirmed registration, you'll receive…" which is honest and safe.)

- [ ] **Step 2: Smoke test**

```bash
npm run dev
# Visit /portal, submit a confirmed-participant email → should reach 'sent' step
# Submit a stranger email → should ALSO reach 'sent' step (no leak)
# Submit 4 times in 5 min → 4th call shows "Trop de demandes"
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ClientPortal.tsx
git commit -m "feat(portal): magic-link via /api/auth/send-magic-link (Resend pipeline)"
```

---

### Task 24: Upgrade pending portal screen

**Files:**
- Modify: `src/pages/ClientPortal.tsx` (the pending gate added in commit c7d969c, around line 800)

- [ ] **Step 1: Replace the pending block**

Replace the existing pending-status return block with:

```tsx
if (participant.status !== "confirmed") {
  const isWaitingValidation = participant.payment === "paid";
  const statusLabel = isWaitingValidation
    ? "Paiement reçu — en cours de validation"
    : "En attente de paiement";

  return (
    <div style={{
      minHeight: "100vh", background: SURFACE, color: NAVY,
      fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      <main style={{ maxWidth: 720, margin: "48px auto" }}>
        <div style={{
          background: WHITE, padding: 32, borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.05)",
        }}>
          <h1 style={{ marginTop: 0, color: NAVY }}>Bonjour {participant.prenom},</h1>

          <div style={{
            display: "inline-block", padding: "6px 14px", borderRadius: 999,
            background: isWaitingValidation ? "rgba(34,139,34,0.1)" : "rgba(201,168,76,0.12)",
            color: isWaitingValidation ? "#228B22" : "#C9A84C",
            fontSize: 13, fontWeight: 600, marginBottom: 20,
          }}>
            {statusLabel}
          </div>

          {isWaitingValidation ? (
            <p>
              Votre paiement est bien arrivé. Notre équipe le valide et vous
              recevrez votre accès participant sous 24h ouvrées.
            </p>
          ) : (
            <>
              <p>
                Votre inscription est enregistrée. Pour finaliser votre place,
                effectuez votre paiement avec les instructions ci-dessous —
                votre espace sera activé dès réception.
              </p>
              <PaymentInstructions
                reference={participant.payment_reference!}
                amountFcfa={participant.amount}
                supportPhone="+225 07 02 61 15 82"
              />
            </>
          )}

          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/brochure.pdf" download style={btnPrimary}>📄 Télécharger la brochure</a>
            <button onClick={signOut} style={btnSecondary}>Se déconnecter</button>
          </div>
        </div>
      </main>
    </div>
  );
}
```

(Add `import { PaymentInstructions } from "@/components/PaymentInstructions"` at top.)

- [ ] **Step 2: Update Participant type if needed**

In `src/admin/types.ts`, extend:

```ts
export interface Participant {
  // ... existing fields
  referral_channel?: string | null;
  referrer_name?: string | null;
  channel_other?: string | null;
  payment_reference?: string | null;
  payment_provider?: string | null;
  consent_at?: string | null;
  confirmed_at?: string | null;
  onboarding_completed_at?: string | null;
}
```

- [ ] **Step 3: Type-check + smoke test**

```bash
npm run lint
npm run dev
# Confirm pending screen shows the reference and payment options
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClientPortal.tsx src/admin/types.ts
git commit -m "feat(portal): upgrade pending screen with payment instructions and brochure"
```

---

# Phase 1F — Admin dashboard: columns, mark-paid button

---

### Task 25: Admin Inscriptions columns + Marquer payé button

**Files:**
- Modify: `src/admin/InscriptionsPage.tsx`

- [ ] **Step 1: Add columns to the table header**

In the `<thead>` block, add 3 columns after the existing "Statut" column:

```tsx
<th>Canal</th>
<th>Réf. paiement</th>
<th>Paiement</th>
<th>Action</th>
```

- [ ] **Step 2: Render new cells per row**

In the `<tbody>` row template:

```tsx
<td>{p.referral_channel ?? "—"}</td>
<td style={{ fontFamily: "Menlo, monospace", fontSize: 12 }}>
  {p.payment_reference ?? "—"}
</td>
<td>
  <span style={{
    padding: "3px 8px", borderRadius: 999, fontSize: 12,
    background: p.payment === "paid" ? "rgba(34,139,34,0.12)" : "rgba(180,180,180,0.12)",
    color: p.payment === "paid" ? "#228B22" : "#666",
  }}>
    {p.payment === "paid" ? "Payé" : "—"}
  </span>
</td>
<td>
  {!(p.status === "confirmed" && p.payment === "paid") && (
    <button onClick={() => markPaid(p.id)} style={{
      background: "#C9A84C", color: "#1B2A4A", border: 0,
      padding: "6px 12px", borderRadius: 6, fontSize: 12,
      fontWeight: 600, cursor: "pointer",
    }}>
      Marquer payé
    </button>
  )}
</td>
```

- [ ] **Step 3: Implement markPaid handler**

Add to component:

```ts
const markPaid = async (id: string) => {
  // Optional: prompt for payment_provider
  const provider = window.prompt(
    "Méthode de paiement (wave / orange_money / bank_transfer / cash) — Annuler pour omettre",
    "wave",
  );

  const res = await fetch(`/api/admin/participants/${id}/mark-paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify(provider ? { payment_provider: provider } : {}),
  });
  if (res.ok) {
    refreshParticipants();
  } else {
    alert("Erreur lors de la confirmation. Réessayez.");
  }
};
```

(Where `session` comes from the existing Supabase auth context in the admin layout.)

- [ ] **Step 4: Type-check + smoke test**

```bash
npm run lint
# Open admin, mark a pending participant as paid, verify the welcome email arrives
```

- [ ] **Step 5: Commit**

```bash
git add src/admin/InscriptionsPage.tsx
git commit -m "feat(admin): canal/ref/paiement columns and Marquer payé button"
```

---

# Phase 1G — Survey refactor + first-visit modal + recommendation persistence

---

### Task 26: Survey config refactor (combine Q3+Q4, remove Q6)

**Files:**
- Modify: `src/pages/portal/surveyConfig.ts`
- Modify: `src/pages/portal/tokens.ts` (if SurveyAnswer type lives there)

- [ ] **Step 1: Update SurveyAnswer type**

In `src/pages/portal/tokens.ts`, change the `SurveyAnswer` shape:

```ts
export interface SurveyAnswer {
  secteur?: string;
  collaborateurs?: string;
  niveau?: "Débutant" | "Intermédiaire" | "Avancé";
  defi?: string;
  attentes?: string[];
}
```

(Remove `aiUsage` and `source` fields if present.)

- [ ] **Step 2: Replace SURVEY_QUESTIONS**

```ts
export const SURVEY_QUESTIONS = [
  {
    id: "secteur" as const,
    label: "Quel est votre secteur d'activité ?",
    type: "select" as const,
    options: ["Banque","Assurance","Immobilier","Juridique","RH","Technologie","Autre"],
    encouragement: "Excellent choix !",
  },
  {
    id: "collaborateurs" as const,
    label: "Combien de collaborateurs avez-vous ?",
    type: "select" as const,
    options: ["1-10","10-50","50-200","200+"],
    encouragement: "Merci !",
  },
  {
    id: "niveau" as const,
    label: "Quel est votre niveau d'expertise en IA ?",
    type: "select" as const,
    options: [
      "Débutant — je découvre, peu ou pas d'utilisation",
      "Intermédiaire — j'utilise occasionnellement quelques outils",
      "Avancé — j'utilise régulièrement et maîtrise plusieurs outils",
    ],
    encouragement: "C'est très bien !",
  },
  {
    id: "defi" as const,
    label: "Quel est votre principal défi quotidien ?",
    type: "text" as const,
    options: [] as string[],
    encouragement: "Merci pour cette précision !",
  },
  {
    id: "attentes" as const,
    label: "Qu'espérez-vous de cette formation ?",
    type: "multi" as const,
    options: ["Gagner du temps","Mieux décider","Former mon équipe","Explorer l'IA","Autre"],
    encouragement: "Parfait, nous avons bien noté !",
  },
];
```

- [ ] **Step 3: Update getRecommendation**

```ts
export function getRecommendation(answers: SurveyAnswer): string {
  const { secteur, niveau, attentes } = answers;
  const isBeginner = niveau?.startsWith("Débutant");

  if (secteur === "Banque" || secteur === "Assurance") {
    return "S2 — IA appliquée à la Finance : parfait pour analyser les bilans, gérer les risques et automatiser vos processus financiers.";
  }
  if (secteur === "Juridique") {
    return "S3 — IA pour les Notaires : idéal pour moderniser votre pratique juridique avec l'IA.";
  }
  if (secteur === "RH") {
    return "S4 — IA pour les Ressources Humaines : transformez votre fonction RH avec des outils IA performants.";
  }
  if (isBeginner || (attentes ?? []).includes("Explorer l'IA")) {
    return "S1 — IA Stratégique pour Dirigeants : la formation idéale pour découvrir l'IA et construire votre vision stratégique.";
  }
  if ((attentes ?? []).includes("Former mon équipe")) {
    return "S1 — IA Stratégique pour Dirigeants + un Coaching Personnalisé pour accompagner votre équipe.";
  }
  return "S1 — IA Stratégique pour Dirigeants : le point de départ idéal pour intégrer l'IA dans votre organisation.";
}
```

- [ ] **Step 4: Type-check + commit**

```bash
npm run lint
git add src/pages/portal/surveyConfig.ts src/pages/portal/tokens.ts
git commit -m "feat(survey): combine Q3+Q4 into 'niveau', remove Q6 (channel moves to form)"
```

---

### Task 27: Survey persistence (per-answer + completion)

**Files:**
- Modify: `src/pages/portal/PortalSurvey.tsx`

- [ ] **Step 1: Persist on each answer**

Add a useEffect (or call inline on each setAnswer):

```ts
const persistAnswer = useCallback(async (partial: Partial<SurveyAnswer>) => {
  if (!participantId) return;
  await supabase.from("participant_survey").upsert({
    participant_id: participantId,
    ...partial,
    updated_at: new Date().toISOString(),
  }, { onConflict: "participant_id" });
}, [participantId]);
```

Wire it into the existing answer setters: after each `setAnswers(prev => ({ ...prev, [id]: value }))`, call `persistAnswer({ [id]: value })`.

- [ ] **Step 2: On completion, save recommendation + flip onboarding flag + send email**

When the user completes question 5:

```ts
const finishSurvey = async () => {
  const recommendation = getRecommendation(answers);
  await supabase.from("participant_survey").upsert({
    participant_id: participantId,
    ...answers,
    recommendation,
    completed_at: new Date().toISOString(),
  }, { onConflict: "participant_id" });

  await supabase
    .from("participants")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", participantId);

  await fetch("/api/portal/send-recommendation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ recommendation }),
  });

  onComplete?.(); // notify parent so banner / modal closes
};
```

- [ ] **Step 3: Add the recommendation-send endpoint to api/app.ts**

```ts
import { recommendationFollowup } from "./email-templates/recommendation-followup.js";

app.post("/api/portal/send-recommendation", async (req, res) => {
  const { recommendation } = req.body ?? {};
  if (!recommendation || typeof recommendation !== "string") {
    return res.status(400).json({ error: "missing_recommendation" });
  }
  // Auth: require a valid Supabase user session
  const auth = req.header("authorization") ?? "";
  const token = auth.replace(/^Bearer /, "");
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user?.email) return res.status(401).json({ error: "unauth" });

  const { data: participant } = await supabase
    .from("participants").select("prenom").eq("email", user.email).maybeSingle();
  if (!participant) return res.status(404).json({ error: "no_participant" });

  await sendEmail(
    renderEmail(recommendationFollowup, {
      prenom: participant.prenom,
      recommendation,
      portalUrl: `${process.env.SITE_URL}/portal`,
    }),
    { to: user.email, resendApiKey: process.env.RESEND_API_KEY ?? "",
      from: process.env.EMAIL_FROM ?? "" },
  );

  res.json({ ok: true });
});
```

- [ ] **Step 4: Tests + commit**

Add a quick test for the endpoint (auth check + send call). Then:

```bash
npm test
git commit -am "feat(survey): persist answers per-step + send recommendation email"
```

---

### Task 28: First-visit modal + persistent banner

**Files:**
- Create: `src/pages/portal/FirstVisitSurveyModal.tsx`
- Create: `src/pages/portal/SurveyBanner.tsx`
- Modify: `src/pages/ClientPortal.tsx`

- [ ] **Step 1: Modal**

```tsx
import { useState } from "react";
import { PortalSurvey } from "./PortalSurvey";

interface Props {
  participantId: string;
  onComplete: () => void;
  onDismiss: () => void;
}

export function FirstVisitSurveyModal({ participantId, onComplete, onDismiss }: Props) {
  return (
    <div role="dialog" aria-modal="true" style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%",
        padding: 32, maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ marginTop: 0, color: "#1B2A4A" }}>Personnalisez votre formation</h2>
        <p style={{ color: "#666" }}>5 questions, 2 minutes. Vos réponses nous aident à adapter la formation à vos besoins.</p>
        <PortalSurvey participantId={participantId} onComplete={onComplete} />
        <button onClick={onDismiss} style={{
          marginTop: 16, background: "transparent", border: 0,
          color: "#888", cursor: "pointer", fontSize: 14,
        }}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Banner**

```tsx
interface Props { onOpen: () => void }

export function SurveyBanner({ onOpen }: Props) {
  return (
    <div style={{
      background: "#FFF8E1", border: "1px solid #C9A84C", borderRadius: 8,
      padding: "12px 20px", marginBottom: 20,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    }}>
      <span style={{ color: "#1B2A4A", fontSize: 14 }}>
        💡 Personnalisez votre formation en 2 minutes
      </span>
      <button onClick={onOpen} style={{
        background: "#1B2A4A", color: "#fff", border: 0, padding: "8px 16px",
        borderRadius: 6, fontWeight: 600, cursor: "pointer",
      }}>
        Commencer
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Wire into ClientPortal**

Add state + render logic in the dashboard branch of `ClientPortal.tsx`:

```tsx
const [showSurveyModal, setShowSurveyModal] = useState(
  participant.onboarding_completed_at == null,
);
const [surveyDismissed, setSurveyDismissed] = useState(false);

// In render:
{!participant.onboarding_completed_at && surveyDismissed && (
  <SurveyBanner onOpen={() => setShowSurveyModal(true)} />
)}
{showSurveyModal && (
  <FirstVisitSurveyModal
    participantId={participant.id}
    onComplete={() => {
      setShowSurveyModal(false);
      // Refresh participant to update onboarding_completed_at
      refreshParticipant();
    }}
    onDismiss={() => {
      setShowSurveyModal(false);
      setSurveyDismissed(true);
    }}
  />
)}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
# Login as a confirmed participant with onboarding_completed_at IS NULL
# Modal should appear
# Click 'Plus tard' → modal closes, banner appears at top
# Click 'Commencer' on banner → modal reopens
# Complete survey → both modal and banner disappear, recommendation email sent
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/portal/FirstVisitSurveyModal.tsx src/pages/portal/SurveyBanner.tsx src/pages/ClientPortal.tsx
git commit -m "feat(portal): first-visit survey modal + persistent banner"
```

---

# Phase 1H — End-to-end test

---

### Task 29: Playwright e2e for the full flow

**Files:**
- Create: `e2e/onboarding-flow.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-${Date.now()}@rmk-test.local`;

test.describe("Onboarding flow", () => {
  test("happy path: register → post-submit screen shows reference and payment options", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Prénom/i).fill("E2E");
    await page.getByLabel(/Nom/i).fill("Tester");
    await page.getByLabel(/Email/i).fill(TEST_EMAIL);
    await page.getByLabel(/Téléphone/i).fill("+225 07 00 00 00 01");
    await page.getByLabel(/Fonction/i).fill("QA");
    await page.getByLabel(/Comment nous avez-vous connu/i).selectOption("LinkedIn");
    await page.getByRole("checkbox", { name: /conditions générales/i }).check();
    await page.getByRole("button", { name: /S'inscrire|Valider/i }).click();

    await expect(page).toHaveURL(/\/inscription\/confirmee/);
    await expect(page.getByText(/RMK-\d{4}-[A-Z0-9]{4}/)).toBeVisible();
    await expect(page.getByText("Wave")).toBeVisible();
    await expect(page.getByText("Orange Money")).toBeVisible();
    await expect(page.getByText("+225 07 02 61 15 82")).toBeVisible();
  });

  test("Recommandation reveals recommender field", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Comment nous avez-vous connu/i).selectOption("Recommandation");
    await expect(page.getByLabel(/Nom de la personne qui vous recommande/i)).toBeVisible();
  });

  test("Autre reveals précisez field", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/Comment nous avez-vous connu/i).selectOption("Autre");
    await expect(page.getByLabel(/Précisez/i)).toBeVisible();
  });

  test("dedup: second submit with same email shows reminder screen", async ({ page }) => {
    // After the first test, this email is in DB
    await page.goto("/");
    await page.getByLabel(/Prénom/i).fill("E2E");
    await page.getByLabel(/Nom/i).fill("Tester");
    await page.getByLabel(/Email/i).fill(TEST_EMAIL);
    await page.getByLabel(/Téléphone/i).fill("+225 07 00 00 00 01");
    await page.getByLabel(/Fonction/i).fill("QA");
    await page.getByLabel(/Comment nous avez-vous connu/i).selectOption("LinkedIn");
    await page.getByRole("checkbox", { name: /conditions générales/i }).check();
    await page.getByRole("button", { name: /S'inscrire|Valider/i }).click();

    await expect(page.getByText(/déjà enregistrée/i)).toBeVisible();
  });

  test("/paiement page renders payment options without reference", async ({ page }) => {
    await page.goto("/paiement");
    await expect(page.getByText("Wave")).toBeVisible();
    await expect(page.getByText("Orange Money")).toBeVisible();
    await expect(page.getByText("+225 07 02 61 15 82")).toBeVisible();
  });

  test("portal: pending screen shows payment instructions", async ({ page }) => {
    // Requires a known pending participant in dev DB; use a fixture or seed
    // Skipped if no fixture available
    test.skip(!process.env.E2E_PENDING_EMAIL, "no fixture");
    await page.goto("/portal");
    await page.getByLabel(/Email/i).fill(process.env.E2E_PENDING_EMAIL!);
    await page.getByRole("button", { name: /Recevoir/i }).click();
    // ... follow the magic link flow with a test mailbox
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run test:e2e -- onboarding-flow
```

Expected: 5 of 6 pass (last one skipped without fixture).

- [ ] **Step 3: Commit**

```bash
git add e2e/onboarding-flow.spec.ts
git commit -m "test(e2e): onboarding flow happy path + dedup + conditional fields"
```

---

# Phase 1I — Documentation + rollout

---

### Task 30: Update docs, .env.example, deployment checklist

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md` (add deploy notes)
- Create: `docs/onboarding-flow.md` (operator-facing)

- [ ] **Step 1: .env.example**

Append:

```bash
# Onboarding refresh (2026-04-25)
SUPPORT_PHONE="+225 07 02 61 15 82"
SITE_URL="https://rmkconseils.com"
EMAIL_FROM="RMK Conseils <noreply@rmkconseils.com>"
CRON_SECRET=""  # generate with: openssl rand -hex 32
```

- [ ] **Step 2: Operator docs**

Create `docs/onboarding-flow.md` with:
- Diagram of states (pending/pending → pending/paid → confirmed/paid)
- Admin runbook: how to mark paid, how to read SLA reminders
- Reference code format explanation
- How to update payment numbers (env vars in Vercel)

- [ ] **Step 3: Vercel env provisioning**

```bash
vercel env add SUPPORT_PHONE production
vercel env add SUPPORT_PHONE preview
vercel env add SUPPORT_PHONE development
# ...repeat for SITE_URL, EMAIL_FROM, CRON_SECRET
```

- [ ] **Step 4: Disable Supabase built-in magic-link emails**

In the Supabase Dashboard (production AND development branches):
- Authentication → Email Templates → Magic Link → toggle OFF "Enable email"
- (Token generation via admin API still works.)

- [ ] **Step 5: Commit + push**

```bash
git add .env.example docs/onboarding-flow.md
git commit -m "docs(onboarding): operator runbook + env vars + Supabase config notes"
git push
```

---

## Self-review checklist

Before handing off for execution, verify against the locked decisions D1–D18:

| Decision | Where covered |
|---|---|
| D1 channel options | Task 18 (component), Task 11 (Zod enum) |
| D2 recommender field | Task 18, Task 11 |
| D3 channel_other field | Task 18, Task 11 |
| D4 consent required | Task 19, Task 11, Task 1 (column) |
| D5 Wave + OM + virement only, no MoMo | Task 5 (template assertion), Task 17, Task 22 |
| D6 reference format | Task 2 |
| D7 reference prominence | Task 16 (CopyableReference), Task 5 (email) |
| D8 logos | Task 15, Task 17 |
| D9 dedup matrix | Task 11 |
| D10 magic-link via Resend | Tasks 7, 12 |
| D11 anti-enumeration | Task 12 |
| D12 first-visit modal optional + banner | Task 28 |
| D13 survey persistence + onboarding flag | Tasks 1, 27 |
| D14 recommendation persisted + email | Tasks 9, 27 |
| D15 admin columns + Marquer payé | Task 25 |
| D16 SLA cron | Task 14 |
| D17 pending screen upgrade | Task 24 |
| D18 Flutterwave-ready columns, manual fallback | Task 1 (`payment_provider` enum includes `flutterwave`), Task 25 (manual button stays) |
| D19 rate-limit /api/register | Task 11 (`registerLimiter`, 5/IP/10min) |
| D20 down migration + audit fields | Task 1 (Step 1b down migration; `confirmed_by_admin_id` + `confirmation_notes` columns), Task 13 (admin id + notes recorded on mark-paid) |

## Risks register

| Risk | Mitigation |
|---|---|
| Supabase RLS blocks `participant_survey` upsert from authenticated user | Policy in Task 1 explicitly allows it via JWT email match. Test in dev branch before prod. |
| `auth.admin.generateLink()` requires service role key in browser-bundled code | Endpoint is server-side only; client never sees it. Verify `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `VITE_`. |
| Existing participant rows have `consent_at IS NULL` | Migration backfills with `created_at`. Form requires it for new submissions only. |
| Resend rate limits during cron burst | SLA cron sends one email containing all rows, not one per row. |
| Wave/OM logos: trademark concerns | Use official assets, don't restyle. Comply with takedown if requested. |
| Existing `/api/notify-registration` callers break | New endpoint is `/api/register`. Old route can stay as a thin alias for one release, or be removed if no external consumers. Check git for callers before deleting. |
| Backfilled `consent_at` on legacy rows is technically not real consent | Acceptable: rows existed before this requirement. Audit log not required for v1. |
| Admin clicks "Marquer payé" twice (double email) | Idempotency check in Task 13 prevents double email by checking `wasAlreadyConfirmed`. |
| Vercel cron secret mismatch | Document in `.env.example` and operator docs. Test in preview before prod. |

## Out of scope (deferred to Phase 2 plan)

- Flutterwave embedded checkout
- `POST /api/webhooks/flutterwave` handler with HMAC verification
- Auto status flip on payment-received webhook
- PostHog or other funnel analytics
- WhatsApp opt-in checkbox (currently always sent if Twilio configured)
- "Source by channel" pivot in admin dashboard

## Explicitly considered and deferred (raised in plan-review, intentional)

These were flagged by Gemini/Qwen plan review on 2026-04-25 and consciously deferred:

- **Service-layer refactor of `api/app.ts`** — current pattern concentrates routes in one file; refactoring is a separate plan, not a blocker.
- **DB-backed email job queue** — for v1 volume, `Promise.allSettled` + structured failure logging on the synchronous send path is sufficient. Revisit if Resend reliability becomes a measured pain point.
- **RLS via `auth.uid()` instead of email JWT match** — the entire codebase uses email-based RLS (`admin_users` and others). Migrating one policy creates inconsistency; needs a full audit follow-up.
- **Real-DB integration tests for RLS** — current tests mock Supabase. Adding a Supabase test branch + integration suite is its own project.
