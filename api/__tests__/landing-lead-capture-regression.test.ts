import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Sprint 7 Phase 4 — regression guard.
//
// Upstream's `baa54f3` ContactLead shipped a direct `supabase.from("leads").insert(...)`
// on the public LandingPage. That pattern is incompatible with our is_admin()-scoped
// RLS on `leads` and `tasks`: anon inserts silently fail (return { data: null, error })
// and the user sees a success screen after a lost lead. The /api/lead/capture endpoint
// (service role, rate limited, see api/app.ts:/api/lead/capture) is the only correct
// path for the public lead magnet.
//
// This test asserts the source of src/pages/LandingPage.tsx does NOT re-introduce the
// direct-supabase pattern. It's a string grep, not a runtime test — the goal is to
// fail fast in CI if a future upstream merge brings the pattern back.

const LANDING_PAGE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "pages",
  "LandingPage.tsx"
);

describe("LandingPage lead-capture path (regression)", () => {
  const source = readFileSync(LANDING_PAGE_PATH, "utf-8");

  it("ContactLead posts to /api/lead/capture (the correct server-side path)", () => {
    expect(source).toMatch(/\/api\/lead\/capture/);
  });

  it("LandingPage does NOT contain a direct `supabase.from(\"leads\")` insert", () => {
    // Accept both single and double quotes, with or without spaces.
    const forbidden = /supabase\s*\.\s*from\s*\(\s*['"]leads['"]\s*\)/;
    expect(source).not.toMatch(forbidden);
  });

  it("LandingPage does NOT contain a direct `supabase.from(\"tasks\")` insert (same RLS class)", () => {
    const forbidden = /supabase\s*\.\s*from\s*\(\s*['"]tasks['"]\s*\)/;
    expect(source).not.toMatch(forbidden);
  });
});
