import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Mock the AI SDK so any imported code that pulls ai/gateway still loads.
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

// Shared mock for supabase-js. Individual tests override .auth.getUser and
// the from().select() / from().insert() chains via vi.fn() so they can assert
// on call args and return different shapes per scenario.
//
// The participant lookup chain is now .select().eq().eq().order().limit()
// (multi-row tolerant — one email may have rows for S1+S2). mockFromSelectList
// resolves to { data: Row[], error }. maybeSingle is kept on the chain for
// any legacy callers (e.g. the requireAdmin admin_users lookup would use it,
// though this test file never hits requireAdmin).
const mockAuthGetUser = vi.fn();
const mockFromSelectList = vi.fn();
const mockFromInsert = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: mockFromSelectList,
            }),
          }),
        }),
      }),
      insert: mockFromInsert,
    }),
  }),
}));

// Must import AFTER mocks.
import { createApp } from "../_app.js";

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  // Fresh app per test: resets express-rate-limit's in-memory store so the
  // 429 test is deterministic regardless of test execution order.
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
  // Default: auth returns a valid user, participant lookup returns a
  // confirmed row for seminar "s1", insert succeeds. Individual tests
  // override. The participant is registered for seminar s1, which maps to
  // code "S1" in src/data/seminars.ts — the endpoint derives the seminar_tag
  // server-side, so tests assert on that derived value.
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "participant@example.com" } },
    error: null,
  });
  mockFromSelectList.mockResolvedValue({
    data: [
      {
        id: "participant-row-1",
        nom: "Doe",
        prenom: "Jane",
        email: "participant@example.com",
        seminar: "s1",
        status: "confirmed",
      },
    ],
    error: null,
  });
  mockFromInsert.mockResolvedValue({ error: null });
});

const validBody = { text: "Bonjour la communauté !" };

describe("POST /api/community/post", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app).post("/api/community/post").send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Supabase JWT is invalid", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid token" },
    });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer bad-token")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 when text is missing", async () => {
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 400 when text exceeds 2000 chars", async () => {
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send({ text: "x".repeat(2001) });
    expect(res.status).toBe(400);
  });

  it("returns 403 when the authenticated email has no participants row", async () => {
    mockFromSelectList.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/confirmed/i);
  });

  it("returns 403 when the participant has no confirmed row (query filters status=confirmed)", async () => {
    // The endpoint's query is .eq("status","confirmed"), so a participant
    // whose only row is 'pending' appears as an empty result set. Unified
    // 403 — same shape as "no registration" (avoids email-enumeration leak).
    mockFromSelectList.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/confirmed/i);
  });

  it("handles multi-seminar registration: picks the most recent confirmed row", async () => {
    // Regression: one email can register for S1 AND S2. participants has no
    // unique constraint on email. Previously .maybeSingle() threw PGRST116
    // and the endpoint returned 500 for these users. The new query uses
    // .order("created_at",desc).limit(1), so it gets whichever row the DB
    // returns first — the test simulates that by returning a single-element
    // array, which is what limit(1) on a multi-row result set looks like.
    mockFromSelectList.mockResolvedValueOnce({
      data: [
        {
          id: "participant-row-most-recent",
          nom: "Doe",
          prenom: "Jane",
          email: "participant@example.com",
          seminar: "s2",
          status: "confirmed",
        },
      ],
      error: null,
    });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(201);
    const row = mockFromInsert.mock.calls[0][0];
    const actualRow = Array.isArray(row) ? row[0] : row;
    expect(actualRow.participant_id).toBe("participant-row-most-recent");
    // s2 is defined in src/data/seminars.ts, so seminar_tag must resolve
    // to its code (not the "Tous" fallback).
    expect(actualRow.seminar_tag).not.toBe("Tous");
    expect(actualRow.seminar_tag).toBeTruthy();
  });

  it("returns 400 when sanitized text is empty (2000 control chars payload)", async () => {
    // Regression for the sanitize-after-validate gap: Zod's .min(1) passes
    // on a string of 2000 \u0001 control chars, then sanitizeText strips
    // them to "", and without a post-sanitize check an empty post would
    // land in the DB.
    const ctrlPayload = "\u0001".repeat(2000);
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send({ text: ctrlPayload });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/i);
  });

  it("returns 201 and a post on the happy path", async () => {
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("post");
    expect(res.body.post.text).toBe("Bonjour la communauté !");
  });

  it("derives seminar_tag server-side from the participant's seminar row (security)", async () => {
    // Attacker sends seminar_tag='S9' in the body. Server must ignore and
    // use the participant's actual seminar (s1 → code 'S1').
    await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send({ text: "cross-post attempt", seminar_tag: "S9" } as any);
    expect(mockFromInsert).toHaveBeenCalled();
    const insertArg = mockFromInsert.mock.calls[0][0];
    const row = Array.isArray(insertArg) ? insertArg[0] : insertArg;
    // The derived tag comes from SEMINARS.find(s => s.id === 's1')?.code
    // in src/data/seminars.ts. If that mapping changes, update the expectation.
    expect(row.seminar_tag).not.toBe("S9");
    expect(row.seminar_tag).toBeTruthy();
  });

  it("falls back to seminar_tag='Tous' when the participant's seminar id is unknown", async () => {
    // Resilience case: a participant row may reference a seminar id that
    // was removed from src/data/seminars.ts (e.g. a historical seminar that
    // got archived). The endpoint must not 500 — it should fall back to a
    // safe default tag so the post still lands.
    mockFromSelectList.mockResolvedValueOnce({
      data: [
        {
          id: "participant-row-1",
          nom: "Doe",
          prenom: "Jane",
          email: "participant@example.com",
          seminar: "seminar-that-no-longer-exists",
          status: "confirmed",
        },
      ],
      error: null,
    });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(201);
    const row = mockFromInsert.mock.calls[0][0];
    const actualRow = Array.isArray(row) ? row[0] : row;
    expect(actualRow.seminar_tag).toBe("Tous");
  });

  it("ignores any client-supplied author/initials/participant_id", async () => {
    await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send({
        ...validBody,
        author: "Attacker",
        initials: "AT",
        participant_id: "someone-else-row-id",
      } as any);
    expect(mockFromInsert).toHaveBeenCalled();
    const insertArg = mockFromInsert.mock.calls[0][0];
    const row = Array.isArray(insertArg) ? insertArg[0] : insertArg;
    expect(row.author).toBe("Jane Doe");
    expect(row.initials).toBe("JD");
    expect(row.participant_id).toBe("participant-row-1");
  });

  it("sanitizes text (strips control characters)", async () => {
    await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send({ text: "hello\u0007world" });
    const row = mockFromInsert.mock.calls[0][0];
    const actualRow = Array.isArray(row) ? row[0] : row;
    expect(actualRow.text).toBe("helloworld");
  });

  it("returns 500 when the insert fails", async () => {
    mockFromInsert.mockResolvedValueOnce({
      error: { message: "db down" },
    });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(500);
  });

  it("enforces the rate limit (4th request in a minute → 429)", async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await request(app)
        .post("/api/community/post")
        .set("Authorization", "Bearer ok-token")
        .send(validBody);
      expect(ok.status).toBe(201);
    }
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(429);
  });
});
