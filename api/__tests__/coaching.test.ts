import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Mock AI SDK
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "Voici votre plan d'action IA personnalisé..." })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

// Supabase mock — coaching endpoint uses .ilike().eq().eq().order().limit()
// (ilike for case-insensitive email, then eq for seminar + status)
const mockAuthGetUser = vi.fn();
const mockFromSelectList = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser },
    from: (_table: string) => ({
      select: () => ({
        ilike: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: mockFromSelectList,
              }),
            }),
          }),
        }),
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: mockFromSelectList,
            }),
          }),
        }),
      }),
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
  mockAuthGetUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "participant@example.com" } },
    error: null,
  });
  mockFromSelectList.mockResolvedValue({
    data: [
      {
        id: "row-1",
        nom: "Doe",
        prenom: "Jane",
        email: "participant@example.com",
        seminar: "s1",
        status: "confirmed",
      },
    ],
    error: null,
  });
});

const validBody = {
  seminar: "s1",
  userPrompt: "Comment appliquer l'IA dans la gestion financière de mon entreprise?",
};

describe("POST /api/ai/coaching", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app).post("/api/ai/coaching").send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Supabase JWT is invalid", async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid token" },
    });
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer bad-token")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 when seminar is missing", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ userPrompt: "test" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when userPrompt is missing", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ seminar: "s1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when userPrompt exceeds 1000 chars", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ seminar: "s1", userPrompt: "a".repeat(1001) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown seminar ID not in catalog", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send({ seminar: "nonexistent-seminar", userPrompt: "test question" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Unknown seminar");
  });

  it("returns 403 when no confirmed participant found", async () => {
    mockFromSelectList.mockResolvedValueOnce({ data: [], error: null });
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("returns 200 with AI coaching text for confirmed participant", async () => {
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("text");
    expect(typeof res.body.text).toBe("string");
  });

  it("returns 502 when AI generation fails", async () => {
    const { generateText } = await import("ai");
    (generateText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Gemini API error")
    );
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("AI service temporarily unavailable");
  });

  it("returns 429 after 5 requests in 1 minute", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/ai/coaching")
        .set("Authorization", "Bearer valid-token")
        .send(validBody);
    }
    const res = await request(app)
      .post("/api/ai/coaching")
      .set("Authorization", "Bearer valid-token")
      .send(validBody);
    expect(res.status).toBe(429);
  });
});
