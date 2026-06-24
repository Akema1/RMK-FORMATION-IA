import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

// Subscribe path uses: from().select().eq().limit() for the idempotency check,
// then from().insert() for the write.
const mockSelectLimit = vi.fn();
const mockInsert = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          limit: mockSelectLimit,
        }),
      }),
      insert: mockInsert,
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
});

describe("POST /api/veille/subscribe", () => {
  it("stores a new subscriber and returns success", async () => {
    mockSelectLimit.mockResolvedValueOnce({ data: [], error: null });
    mockInsert.mockResolvedValueOnce({ error: null });
    const res = await request(app)
      .post("/api/veille/subscribe")
      .send({ email: "dirigeant@banque.ci", role: "DG", sectors: ["banque"] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("is idempotent: an existing email does not insert again", async () => {
    mockSelectLimit.mockResolvedValueOnce({ data: [{ id: "sub-1" }], error: null });
    const res = await request(app)
      .post("/api/veille/subscribe")
      .send({ email: "existing@banque.ci" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid email with 400 before touching the DB", async () => {
    const res = await request(app)
      .post("/api/veille/subscribe")
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(mockSelectLimit).not.toHaveBeenCalled();
  });

  it("lowercases the email and sets safe defaults before storing", async () => {
    mockSelectLimit.mockResolvedValueOnce({ data: [], error: null });
    mockInsert.mockResolvedValueOnce({ error: null });
    await request(app)
      .post("/api/veille/subscribe")
      .send({ email: "Dirigeant@Banque.CI" });
    const inserted = mockInsert.mock.calls[0][0][0];
    expect(inserted.email).toBe("dirigeant@banque.ci");
    expect(inserted.confirmed).toBe(false);
    expect(inserted.status).toBe("active");
  });

  it("returns 500 when the insert fails (no silent success)", async () => {
    mockSelectLimit.mockResolvedValueOnce({ data: [], error: null });
    mockInsert.mockResolvedValueOnce({ error: { message: "db down" } });
    const res = await request(app)
      .post("/api/veille/subscribe")
      .send({ email: "fail@banque.ci" });
    expect(res.status).toBe(500);
  });
});
