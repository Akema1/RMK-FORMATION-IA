import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

const mockFromSelect = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: mockFromSelect,
          }),
        }),
      }),
    }),
  }),
}));

import { createApp } from "../_app.js";

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

describe("POST /api/registration/check-duplicate — uniqueness semantics", () => {
  it("returns exists=false for a new email+seminar pair", async () => {
    mockFromSelect.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "new@example.com", seminar: "s1" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it("returns exists=true for an existing email+seminar pair", async () => {
    mockFromSelect.mockResolvedValueOnce({
      data: [{ id: "row-1" }],
      error: null,
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "existing@example.com", seminar: "s1" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
  });

  it("returns exists=false for same email but different seminar", async () => {
    mockFromSelect.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "existing@example.com", seminar: "s2" });
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });

  it("normalizes email to lowercase before lookup", async () => {
    mockFromSelect.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "Alice@Example.COM", seminar: "s1" });
    expect(res.status).toBe(200);
  });

  it("returns 500 on database error (fail-closed)", async () => {
    mockFromSelect.mockResolvedValueOnce({
      data: null,
      error: { message: "connection error" },
    });
    const res = await request(app)
      .post("/api/registration/check-duplicate")
      .send({ email: "test@example.com", seminar: "s1" });
    expect(res.status).toBe(500);
  });
});
