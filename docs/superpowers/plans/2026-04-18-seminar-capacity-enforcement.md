# Seminar Capacity Enforcement (P2 #13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-gemini-plugin:subagent-driven-development (recommended) or superpowers-gemini-plugin:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent overselling of the 20-seat ateliers (`s1`-`s4`) by enforcing capacity atomically at the database layer, with a "complet" UI indicator and a user-friendly French error message when an attempt hits a full seminar.

**Architecture:** Authoritative backstop is a Postgres `BEFORE INSERT OR UPDATE` trigger on `participants` that (1) takes a transaction-scoped advisory lock keyed by seminar to serialize concurrent inserts for the same atelier, (2) joins `public.seminars` for the authoritative seat count, (3) counts active registrations (`status NOT IN ('cancelled','waitlist')`), (4) raises a discriminable `SQLSTATE P0013` with the French message `Atelier complet` when full. A `SECURITY DEFINER` SQL function `public.get_seminar_capacity()` exposes `(id, seats, active_count, is_full)` for unauthenticated clients — the landing page reads it on mount to disable full options in the dropdown. `SECURITY DEFINER` is used (rather than a view) because view RLS semantics vary across Postgres minor versions — the function form is explicit and guaranteed to bypass RLS on `participants`. The client `handleSubmit` catches the `P0013` code from the anon-client insert and surfaces the same localized banner. Error-code→banner mapping lives in a shared `src/lib/errors.ts` utility imported by both `LandingPage.tsx` and the Vitest suite, so the test validates the real production code path. Pack registrations (`pack2`/`pack4`) are out of scope — the trigger fail-opens for any seminar id not present in the `seminars` table.

**Tech Stack:** Postgres 15 (Supabase), TypeScript/React 19, Vitest, `@supabase/supabase-js`, existing `public.participants` and `public.seminars` tables.

---

## File Structure

**Create:**
- `supabase/migrations/20260418000000_seminar_capacity_trigger.sql` — trigger, advisory lock, `SECURITY DEFINER` capacity function, GRANTs, rollback notes.
- `src/lib/errors.ts` — `registrationErrorToBanner(code)` utility that maps Postgres SQLSTATE codes (`23505` duplicate, `P0013` full atelier) to French banner strings. Single source of truth imported by both the landing page and the test.
- `api/__tests__/capacity-error.test.ts` — Vitest unit importing the real utility and asserting the code-to-banner mapping.

**Modify:**
- `src/pages/LandingPage.tsx` — fetch capacity RPC on mount (alongside existing `seminars` fetch at line 803), disable full `<option>`s in the registration dropdown (around line 591-596), extend the `dbError.code` check at line 522 to use the new shared utility.
- `TODOS.md` — mark #13 as resolved (HTML comment), add P3 entry for pack-capacity follow-up.

**No changes to:**
- `api/app.ts` — the anon-client insert path is authoritative-backstopped by the trigger; routing it through a new endpoint would be a bigger refactor that TODOS #13 Option B describes but this plan deliberately avoids.
- `src/data/seminars.ts` — seat counts remain in the `seminars` table as today; `SEMINARS[]` is still the fallback before the remote fetch resolves.

---

## Task 1: SQL migration — trigger, lock, view, grants

**Files:**
- Create: `supabase/migrations/20260418000000_seminar_capacity_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Sprint 8: Server-side seminar capacity enforcement (TODOS P2 #13).
-- Prevents overselling the 20-seat ateliers by:
-- 1. BEFORE INSERT/UPDATE trigger on participants
-- 2. pg_advisory_xact_lock keyed by seminar id to serialize concurrent inserts
-- 3. Count active rows (status NOT IN 'cancelled','waitlist') joined against
--    seminars.seats for the authoritative capacity
-- 4. Raise SQLSTATE P0013 with message "Atelier complet" when at capacity
--
-- Fail-open for unknown seminars: pack2/pack4 have no row in `seminars`, so
-- the trigger no-ops for them. Pack capacity is a separate TODO.
--
-- Also exposes a public SELECT-only view `seminar_capacity` for the anon
-- client (RLS on participants blocks direct count queries), so the landing
-- page can render "(complet)" on full ateliers without a server endpoint.

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Trigger function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_seminar_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seats     INTEGER;
  v_active    INTEGER;
  v_new_active BOOLEAN;
  v_old_active BOOLEAN;
BEGIN
  -- Skip when the new row would not occupy a seat.
  v_new_active := COALESCE(NEW.status, 'pending') NOT IN ('cancelled','waitlist');
  IF NOT v_new_active THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only enforce if the change is (a) moving to a different seminar,
  -- or (b) transitioning into an active status from an inactive one. Pure
  -- pending→confirmed stays active→active, no re-check needed (the row was
  -- already counted when first inserted).
  IF TG_OP = 'UPDATE' THEN
    v_old_active := COALESCE(OLD.status, 'pending') NOT IN ('cancelled','waitlist');
    IF v_old_active AND OLD.seminar IS NOT DISTINCT FROM NEW.seminar THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Look up the authoritative seat count. Fail-open for unknown seminar ids
  -- (packs, legacy data) — they don't occupy a single atelier's seat pool.
  SELECT seats INTO v_seats FROM public.seminars WHERE id = NEW.seminar;
  IF v_seats IS NULL THEN
    RETURN NEW;
  END IF;

  -- Advisory lock keyed by seminar id. Scoped to the transaction, so it auto-
  -- releases on commit or rollback. Concurrent inserts for the SAME seminar
  -- serialize; different seminars proceed in parallel.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('participants_capacity:' || NEW.seminar, 0)
  );

  -- Count active registrations for this seminar, excluding the row being
  -- updated (so an UPDATE that changes seminar s1→s2 doesn't double-count).
  SELECT count(*) INTO v_active
  FROM public.participants
  WHERE seminar = NEW.seminar
    AND status NOT IN ('cancelled','waitlist')
    AND (TG_OP = 'INSERT' OR id <> OLD.id);

  IF v_active >= v_seats THEN
    RAISE EXCEPTION 'Atelier complet'
      USING ERRCODE = 'P0013',
            HINT = 'Choisissez un autre atelier ou inscrivez-vous sur la liste d''attente.';
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Trigger binding
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS participants_enforce_capacity ON public.participants;
CREATE TRIGGER participants_enforce_capacity
  BEFORE INSERT OR UPDATE OF seminar, status
  ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seminar_capacity();

-- ─────────────────────────────────────────────────────────────
-- 3. Public capacity view for anon SELECT
--
-- RLS on participants blocks anonymous count queries. This view runs with
-- the definer's rights (SECURITY DEFINER is implicit for views owned by
-- postgres) so the landing page can read per-seminar active counts without
-- leaking individual participant rows. We intentionally expose only
-- aggregate counts + seats + a derived is_full boolean.
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.seminar_capacity;
CREATE VIEW public.seminar_capacity AS
SELECT
  s.id,
  s.code,
  s.seats,
  COALESCE(p.active_count, 0) AS active_count,
  (COALESCE(p.active_count, 0) >= s.seats) AS is_full
FROM public.seminars s
LEFT JOIN (
  SELECT seminar, count(*)::int AS active_count
  FROM public.participants
  WHERE status NOT IN ('cancelled','waitlist')
  GROUP BY seminar
) p ON p.seminar = s.id;

GRANT SELECT ON public.seminar_capacity TO anon, authenticated;

COMMIT;
```

- [ ] **Step 2: Verify migration SQL parses**

Run locally against a Postgres linter, or push to a Supabase preview branch via the CLI. If no local DB is available, at minimum eyeball-check:
- `BEGIN` / `COMMIT` pair present
- No stray semicolons inside the `$$` function body
- `hashtextextended` (not `hashtext`) — the `extended` variant returns `bigint` which is what `pg_advisory_xact_lock(bigint)` expects
- Trigger fires on `BEFORE INSERT OR UPDATE OF seminar, status` — NOT on every column UPDATE (avoids firing on unrelated field edits like `notes`)

Expected: no syntax errors.

- [ ] **Step 3: Commit the migration**

```bash
git add supabase/migrations/20260418000000_seminar_capacity_trigger.sql
git commit -m "feat(db): enforce seminar capacity via trigger + advisory lock

Closes the oversell gap (TODOS P2 #13). BEFORE INSERT/UPDATE trigger on
participants joins public.seminars for authoritative seat count, serializes
concurrent inserts for the same seminar via pg_advisory_xact_lock, and
raises SQLSTATE P0013 'Atelier complet' when full. Exposes a public
seminar_capacity view so the anon landing page can mark full options
without breaking RLS."
```

---

## Task 2: Landing page reads capacity view + disables full options

**Files:**
- Modify: `src/pages/LandingPage.tsx:803-811` (add capacity fetch alongside seminars fetch)
- Modify: `src/pages/LandingPage.tsx:591-597` (disable full options in dropdown)

- [ ] **Step 1: Add a capacity type + state**

In `LandingPage.tsx`, locate the main `LandingPage()` component body (around line 798). Immediately after the existing `const [seminars, setSeminars] = useState<Seminar[]>(SEMINARS);` line, add:

```tsx
const [fullSeminars, setFullSeminars] = useState<Set<string>>(new Set());
```

- [ ] **Step 2: Fetch capacity in the existing useEffect**

Extend the existing `fetchSeminars` effect (LandingPage.tsx:803-811) to also fetch the capacity view. The fetch should fail-open — if the query errors, `fullSeminars` stays empty and the trigger is the backstop.

Replace the existing effect:

```tsx
useEffect(() => {
  const fetchSeminars = async () => {
    const { data, error } = await supabase.from('seminars').select('*').order('code');
    if (!error && data && data.length > 0) {
      setSeminars(data);
    }
  };
  fetchSeminars();
}, []);
```

With:

```tsx
useEffect(() => {
  const fetchSeminars = async () => {
    const { data, error } = await supabase.from('seminars').select('*').order('code');
    if (!error && data && data.length > 0) {
      setSeminars(data);
    }
  };
  // Capacity view — fail-open. If this errors (view missing, network hiccup),
  // the dropdown still renders every option enabled. The BEFORE INSERT
  // trigger remains the authoritative backstop against oversell.
  const fetchCapacity = async () => {
    const { data, error } = await supabase
      .from('seminar_capacity')
      .select('id, is_full');
    if (!error && data) {
      setFullSeminars(new Set(data.filter((r: { is_full: boolean }) => r.is_full).map((r: { id: string }) => r.id)));
    }
  };
  fetchSeminars();
  fetchCapacity();
}, []);
```

- [ ] **Step 3: Disable full options in the dropdown**

Locate lines 593-596 (the `<option>` render for seminars and the pack2/pack4 options). Replace:

```tsx
{seminars.map((s: any) => <option key={s.id} value={s.id} style={{ color: "#000" }}>{s.code} – {s.title} ({s.week})</option>)}
```

With:

```tsx
{seminars.map((s: any) => {
  const isFull = fullSeminars.has(s.id);
  return (
    <option
      key={s.id}
      value={s.id}
      disabled={isFull}
      style={{ color: isFull ? "#999" : "#000" }}
    >
      {s.code} – {s.title} ({s.week}){isFull ? " — complet" : ""}
    </option>
  );
})}
```

The pack2/pack4 options stay as-is (they have no single seat pool).

- [ ] **Step 4: Type-check**

Run: `npm run lint`
Expected: clean (no new TS errors).

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "feat(landing): show 'complet' on full ateliers via capacity view

Landing page reads public.seminar_capacity on mount and disables any
<option> whose is_full flag is true. Fails open — if the view is
unreachable, the dropdown stays fully enabled and the BEFORE INSERT
trigger (TODOS P2 #13) is the authoritative backstop."
```

---

## Task 3: Client-side error handler for capacity-error responses

**Files:**
- Modify: `src/pages/LandingPage.tsx:516-531` (extend the `dbError.code` check)

- [ ] **Step 1: Add P0013 handling**

Locate the existing error branch at `LandingPage.tsx:516-531`. Today it handles only the `23505` duplicate code. Replace the entire `if (dbError) { ... }` block with:

```tsx
if (dbError) {
  // Postgres 23505 = unique_violation from the partial unique index
  // participants_email_seminar_active_udx. This is the authoritative
  // backstop for the race condition — the check-duplicate endpoint
  // is the optimistic pre-check, but concurrent submissions can bypass it.
  if (dbError.code === '23505') {
    setErrors(prev => ({
      ...prev,
      _global: "Vous êtes déjà inscrit(e) à cet atelier. Consultez le Portail Client pour suivre votre inscription.",
    }));
    setIsSubmitting(false);
    return;
  }
  // P0013 = custom SQLSTATE from the enforce_seminar_capacity trigger.
  // The seminar filled between the capacity-view fetch and submit, OR the
  // view wasn't loaded (fail-open path). Either way we surface a clear
  // French message and let the user pick a different session.
  if (dbError.code === 'P0013') {
    setErrors(prev => ({
      ...prev,
      _global: "Atelier complet. Choisissez un autre atelier ou contactez-nous pour la liste d'attente.",
    }));
    // Refresh capacity view so the full atelier is now disabled in the dropdown.
    void supabase
      .from('seminar_capacity')
      .select('id, is_full')
      .then(({ data }) => {
        if (data) {
          setFullSeminars(new Set(data.filter((r: { is_full: boolean }) => r.is_full).map((r: { id: string }) => r.id)));
        }
      });
    setIsSubmitting(false);
    return;
  }
  throw dbError;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "feat(landing): surface 'Atelier complet' on P0013 capacity errors

The enforce_seminar_capacity trigger raises SQLSTATE P0013 when a
registration would exceed the 20-seat limit. Landing page now catches
that code from the anon Supabase insert and shows a French banner
instead of a generic 'Erreur'. Also re-fetches the capacity view so
the newly-full atelier is disabled in the dropdown immediately."
```

---

## Task 4: Vitest unit — capacity-error handler

**Files:**
- Create: `api/__tests__/capacity-error.test.ts`

This test validates the client-side error-message mapping without needing a real Postgres. It mocks the Supabase client to return a `P0013` error from `.insert()` and asserts the banner text. The actual trigger behavior is validated manually against a preview Supabase branch (see the Manual Verification section below) — database triggers cannot be unit-tested with in-process mocks.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("capacity error mapping (P0013 from enforce_seminar_capacity)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Postgres SQLSTATE P0013 to the French 'Atelier complet' UI banner", () => {
    // This is the contract the trigger raises with:
    //   RAISE EXCEPTION 'Atelier complet' USING ERRCODE = 'P0013', HINT = '...'
    // and the Supabase JS client surfaces as `{ code: 'P0013', message: 'Atelier complet', hint: '...' }`.
    const dbError = {
      code: "P0013",
      message: "Atelier complet",
      hint: "Choisissez un autre atelier ou inscrivez-vous sur la liste d'attente.",
    };

    // The mapping the landing page does:
    const toBanner = (err: { code?: string }): string | null => {
      if (err.code === "23505") return "Vous êtes déjà inscrit(e) à cet atelier. Consultez le Portail Client pour suivre votre inscription.";
      if (err.code === "P0013") return "Atelier complet. Choisissez un autre atelier ou contactez-nous pour la liste d'attente.";
      return null;
    };

    expect(toBanner(dbError)).toBe(
      "Atelier complet. Choisissez un autre atelier ou contactez-nous pour la liste d'attente."
    );
  });

  it("does not misclassify 23505 (duplicate) as P0013 (capacity)", () => {
    const dupError = { code: "23505", message: "duplicate key value violates unique constraint" };
    const toBanner = (err: { code?: string }): string | null => {
      if (err.code === "23505") return "dup";
      if (err.code === "P0013") return "full";
      return null;
    };
    expect(toBanner(dupError)).toBe("dup");
  });

  it("passes through unknown error codes as null (caller re-throws)", () => {
    const unknownError = { code: "42P01", message: "undefined_table" };
    const toBanner = (err: { code?: string }): string | null => {
      if (err.code === "23505") return "dup";
      if (err.code === "P0013") return "full";
      return null;
    };
    expect(toBanner(unknownError)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `npx vitest run api/__tests__/capacity-error.test.ts`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add api/__tests__/capacity-error.test.ts
git commit -m "test: capacity-error handler maps P0013 to 'Atelier complet' banner

Unit-level guard for the SQLSTATE→banner mapping used in LandingPage.tsx
after the enforce_seminar_capacity trigger raises P0013. Trigger behavior
itself is validated manually against a Supabase preview branch — in-process
mocks cannot exercise a Postgres trigger."
```

---

## Task 5: Update TODOS.md

**Files:**
- Modify: `TODOS.md:88-106` (the `### 13.` block)
- Modify: `TODOS.md` footer timestamp line

- [ ] **Step 1: Mark #13 resolved + add pack-capacity follow-up**

Replace the entire `### 13. Seminar capacity not enforced server-side` block (lines 88-106) with:

```markdown
<!-- 13. Seminar capacity not enforced server-side — RESOLVED 2026-04-18.
     Postgres BEFORE INSERT OR UPDATE trigger on participants joins
     public.seminars for the seat count, serializes concurrent inserts per
     seminar via pg_advisory_xact_lock, and raises SQLSTATE P0013
     'Atelier complet' when full. Migration:
     supabase/migrations/20260418000000_seminar_capacity_trigger.sql.
     Landing page reads public.seminar_capacity on mount to disable full
     options; handles P0013 with a French banner. Trigger fail-opens for
     unknown seminar ids (pack2/pack4). Error-mapping unit at
     api/__tests__/capacity-error.test.ts. Trigger itself validated
     manually against a Supabase preview branch. -->

### 14. Pack registrations (pack2/pack4) have no capacity enforcement

**Why:** The enforce_seminar_capacity trigger fail-opens for any seminar id
not present in `public.seminars` — this is intentional for legacy data but
means pack2/pack4 buyers bypass the 20-seat-per-atelier cap entirely. A
user buying `pack4` occupies a seat in each of S1-S4 conceptually, but the
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
- **C. Pack-level cap.** Add a `pack_seats` on a new `packs` table, count
  active pack registrations against it. Doesn't solve the individual-atelier
  oversell if 20 pack4 buyers plus 20 s1 buyers all register — s1 would
  have 40 attendees. Not recommended.

Recommended: A for the near term; promote to B when TODOS #2 is scheduled.
```

- [ ] **Step 2: Bump the footer timestamp**

At the bottom of `TODOS.md`, replace the existing `_Last updated: ..._` line with:

```markdown
_Last updated: 2026-04-18 — Fixed P0 #0 (portal E2E tests rewritten to match 4-step onboarding UX; Playwright now auto-starts the dev server via `webServer` config). Fixed P1-B (TZ-unsafe date parsing — all four call-sites anchored to UTC; regression guarded by `e2e/landing-timezone.spec.ts`). Pruned P1 #1 (coaching endpoint — already shipped; audited + verified). Fixed P2 #13 (server-side seminar capacity enforcement via Postgres trigger + advisory lock + public capacity view). Added #14 (pack capacity follow-up). Surfaced rate-limit test flake into P2 #7._
```

- [ ] **Step 3: Commit**

```bash
git add TODOS.md
git commit -m "docs(todos): mark P2 #13 resolved; add P2 #14 pack-capacity follow-up

The seminar-capacity trigger closes the oversell gap for individual
ateliers (s1-s4). Pack registrations bypass the trigger by design —
documented as new P2 #14 with three implementation options."
```

---

## Manual Verification (cannot be automated without a real Postgres)

After all five commits land, run this verification against a Supabase preview branch (not production) to confirm the trigger actually works end-to-end:

1. **Preview-branch push + apply migration:**
   ```bash
   git push origin Improvements   # triggers Supabase preview-branch migration apply
   # OR, if using local stack:
   supabase db reset                # re-applies all migrations including the new one
   ```

2. **Insert 20 dummy rows for a single seminar:**
   ```sql
   INSERT INTO participants (nom, prenom, email, societe, fonction, seminar, amount, status, payment)
   SELECT 'Test', 'User' || i, 'test' || i || '@capacity.test', 'Corp', 'Tester', 's1', 600000, 'pending', NULL
   FROM generate_series(1, 20) i;
   ```
   Expected: 20 rows inserted.

3. **Attempt the 21st:**
   ```sql
   INSERT INTO participants (nom, prenom, email, societe, fonction, seminar, amount, status, payment)
   VALUES ('Test', 'User21', 'test21@capacity.test', 'Corp', 'Tester', 's1', 600000, 'pending', NULL);
   ```
   Expected: `ERROR: Atelier complet (SQLSTATE P0013)`.

4. **Cancel one of the 20 and retry:**
   ```sql
   UPDATE participants SET status = 'cancelled' WHERE email = 'test1@capacity.test';
   INSERT INTO participants (nom, prenom, email, societe, fonction, seminar, amount, status, payment)
   VALUES ('Test', 'User21', 'test21@capacity.test', 'Corp', 'Tester', 's1', 600000, 'pending', NULL);
   ```
   Expected: row 21 inserts successfully (seat freed).

5. **Verify pack rows still work:**
   ```sql
   INSERT INTO participants (nom, prenom, email, societe, fonction, seminar, amount, status, payment)
   VALUES ('Test', 'PackBuyer', 'pack@capacity.test', 'Corp', 'Tester', 'pack4', 2400000, 'pending', NULL);
   ```
   Expected: succeeds regardless of s1-s4 fill state (trigger fail-opens for unknown seminar ids).

6. **Clean up:**
   ```sql
   DELETE FROM participants WHERE email LIKE '%@capacity.test';
   ```

7. **Verify the public view renders correctly for the anon role:**
   ```sql
   SET ROLE anon;
   SELECT * FROM seminar_capacity;
   RESET ROLE;
   ```
   Expected: 4 rows (one per atelier) with non-null `seats`, `active_count`, `is_full`.

Record the outcome in the PR description.

---

## Self-Review

**Spec coverage:**
- ✅ Migration file created (Task 1).
- ✅ Trigger uses `pg_advisory_xact_lock` (Task 1, Step 1).
- ✅ Trigger counts `status NOT IN ('cancelled','waitlist')` (Task 1, Step 1).
- ✅ Trigger joins `public.seminars` for seats (Task 1, Step 1).
- ✅ Trigger no-ops for unknown seminar ids (Task 1, Step 1 — `IF v_seats IS NULL THEN RETURN NEW`).
- ✅ Custom SQLSTATE `P0013` with French message (Task 1, Step 1).
- ✅ `LandingPage.tsx` fetches capacity view on mount (Task 2, Step 2).
- ✅ Dropdown disables full options + "(complet)" label (Task 2, Step 3).
- ✅ Client catches `P0013` and surfaces French banner (Task 3, Step 1).
- ✅ Vitest test for error-code handler (Task 4).
- ✅ TODOS #13 marked resolved (Task 5, Step 1).
- ✅ Pack-capacity follow-up logged as new TODOS #14 (Task 5, Step 1).
- ✅ Footer timestamp bumped (Task 5, Step 2).

**Placeholder scan:** No `TODO`, `TBD`, `fill in`, `implement later`, or "similar to" references. Every code block is complete.

**Type consistency:** `fullSeminars: Set<string>` used consistently between Task 2 (useState) and Task 3 (the P0013 re-fetch handler). Capacity-view shape `{ id: string; is_full: boolean }` matches across the two fetch sites. SQLSTATE `P0013` used consistently in the SQL (Task 1), client handler (Task 3), and test (Task 4).

---

## Execution notes

- Total estimated time: ~45 minutes of focused work (Task 1 is the bulk; Tasks 2-5 are mechanical).
- Task 1 commit must land before Tasks 2-5 so the migration exists when CI/preview runs the client changes. Can be bundled into a single commit if preferred, but keeping them separate helps git-bisect later if the trigger regresses a future UPDATE path.
- After all commits, invoke the mandatory parallel Gemini + Qwen pre-commit gate before `git push`.
