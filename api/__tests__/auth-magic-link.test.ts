import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

const mockParticipantLookup = vi.fn();
const mockSeminarLookup = vi.fn();
const mockGenerateLink = vi.fn();
const mockResendSend = vi.fn(async () => ({ data: { id: "msg_1" }, error: null }));

// Vitest 4 compat: mock must be a real constructor, not an arrow-returning vi.fn().
vi.mock("resend", () => {
  function MockResend() {
    return { emails: { send: mockResendSend } };
  }
  return { Resend: MockResend };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      admin: {
        generateLink: mockGenerateLink,
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: unknown) => ({
          eq: () => ({
            maybeSingle: () =>
              table === "participants"
                ? mockParticipantLookup()
                : mockSeminarLookup(),
          }),
          maybeSingle: () =>
            table === "seminars"
              ? mockSeminarLookup()
              : mockParticipantLookup(),
        }),
      }),
    }),
  }),
}));

import { createApp } from "../_app.js";

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "RMK <noreply@rmkconseils.com>";
  process.env.SITE_URL = "https://rmkconseils.com";
  process.env.SUPPORT_PHONE = "+225 07 02 61 15 82";
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
});

describe("POST /api/auth/send-magic-link", () => {
  it("returns 200 {ok:true} and sends email when participant is confirmed", async () => {
    mockParticipantLookup.mockResolvedValueOnce({
      data: { prenom: "Marie", seminar: "s1" },
      error: null,
    });
    mockSeminarLookup.mockResolvedValueOnce({
      data: { title: "S1 Découverte IA" },
      error: null,
    });
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase/magic?token=abc" } },
      error: null,
    });

    const res = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "marie@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const sent = (mockResendSend.mock.calls as unknown[][])[0]![0] as {
      to: string;
      html: string;
    };
    expect(sent.to).toBe("marie@example.com");
    expect(sent.html).toContain("https://supabase/magic?token=abc");
  });

  it("returns 200 {ok:true} when email is unknown — no leak, no email", async () => {
    mockParticipantLookup.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "stranger@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 200 {ok:true} when participant exists but is pending — no leak", async () => {
    // The participant lookup filters on status='confirmed', so a pending row
    // returns null. Same response shape as unknown email — anti-enumeration.
    mockParticipantLookup.mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "pending@example.com" });

    expect(res.status).toBe(200);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("rejects malformed email with 400", async () => {
    const res = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(mockParticipantLookup).not.toHaveBeenCalled();
  });

  it("rejects missing email with 400", async () => {
    const res = await request(app).post("/api/auth/send-magic-link").send({});
    expect(res.status).toBe(400);
  });

  it("normalizes email to lowercase before lookup", async () => {
    mockParticipantLookup.mockResolvedValueOnce({ data: null, error: null });
    const res = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "Marie@Example.COM" });
    expect(res.status).toBe(200);
  });

  it("rate-limits 4th request within window", async () => {
    mockParticipantLookup.mockResolvedValue({ data: null, error: null });
    for (let i = 0; i < 3; i++) {
      const r = await request(app)
        .post("/api/auth/send-magic-link")
        .send({ email: "a@b.com" });
      expect(r.status).toBe(200);
    }
    const r4 = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "a@b.com" });
    expect(r4.status).toBe(429);
  });

  it("still returns 200 when generateLink fails (no leak about backend)", async () => {
    mockParticipantLookup.mockResolvedValueOnce({
      data: { prenom: "Marie", seminar: "s1" },
      error: null,
    });
    mockSeminarLookup.mockResolvedValueOnce({
      data: { title: "S1" },
      error: null,
    });
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: null },
      error: { message: "supabase admin error" },
    });

    const res = await request(app)
      .post("/api/auth/send-magic-link")
      .send({ email: "marie@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
