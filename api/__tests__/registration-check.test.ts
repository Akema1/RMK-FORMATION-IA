import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Mocks for imported AI SDK surface (unused here but pulled in via app.ts imports).
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

// Shared supabase-js mock. The check-duplicate endpoint uses the chain
// .from("participants").select("status").eq("email", ...).eq("seminar", ...).limit(1).
// We return a rows array (possibly empty) via `mockLimit`.
const mockLimit = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: mockLimit,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
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
  // Default: no existing row. Individual tests override.
  mockLimit.mockResolvedValue({ data: [], error: null });
});

const validBody = { email: "jane@example.com", seminar: "s1" };

describe("POST /api/registration/check-duplicate", () => {
  it("returns { exists: false } when no existing row matches (email, seminar)", async () => {
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: false });
  });

  it("returns { exists: true, status } when a row matches (email, seminar)", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ status: "pending" }],
      error: null,
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ exists: true, status: "pending" });
  });

  it("returns { exists: true, status } for a confirmed row too (blocks resubmit regardless of status)", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ status: "confirmed" }],
      error: null,
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.status).toBe("confirmed");
  });

  it("normalizes email to lowercase before querying (mixed-case must match lowercase-stored rows)", async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ status: "pending" }],
      error: null,
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "Jane@EXAMPLE.com", seminar: "s1" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
  });

  it("returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ seminar: "s1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 400 when email is malformed", async () => {
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "not-an-email", seminar: "s1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when seminar is missing", async () => {
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "jane@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 500 when the database query errors (fail-closed — does NOT silently return exists:false)", async () => {
    mockLimit.mockResolvedValueOnce({
      data: null,
      error: { message: "connection refused" },
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send(validBody);
    expect(res.status).toBe(500);
    // Critical: the client must NOT proceed assuming no dupe if the DB is down.
    expect(res.body).not.toHaveProperty("exists", false);
  });
});
