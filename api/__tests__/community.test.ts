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
const mockAuthGetUser = vi.fn();
const mockFromSelectSingle = vi.fn();
const mockFromInsert = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockFromSelectSingle,
        }),
      }),
      insert: mockFromInsert,
    }),
  }),
}));

// Must import AFTER mocks.
import { createApp } from "../app.js";

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
  mockFromSelectSingle.mockResolvedValue({
    data: {
      id: "participant-row-1",
      nom: "Doe",
      prenom: "Jane",
      email: "participant@example.com",
      seminar: "s1",
      status: "confirmed",
    },
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
    mockFromSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not a registered participant/i);
  });

  it("returns 403 when the participant status is not confirmed", async () => {
    mockFromSelectSingle.mockResolvedValueOnce({
      data: {
        id: "participant-row-1",
        nom: "Doe",
        prenom: "Jane",
        email: "participant@example.com",
        seminar: "s1",
        status: "pending",
      },
      error: null,
    });
    const res = await request(app)
      .post("/api/community/post")
      .set("Authorization", "Bearer ok-token")
      .send(validBody);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/confirmed/i);
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
    mockFromSelectSingle.mockResolvedValueOnce({
      data: {
        id: "participant-row-1",
        nom: "Doe",
        prenom: "Jane",
        email: "participant@example.com",
        seminar: "seminar-that-no-longer-exists",
        status: "confirmed",
      },
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
