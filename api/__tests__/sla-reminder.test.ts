import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "unused" })),
}));
vi.mock("@ai-sdk/gateway", () => ({
  gateway: () => "mock-model",
}));

const mockResendSend = vi.fn(async () => ({ data: { id: "x" }, error: null }));
vi.mock("resend", () => {
  function MockResend() {
    return { emails: { send: mockResendSend } };
  }
  return { Resend: MockResend };
});

const mockStaleQuery = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn(), admin: { generateLink: vi.fn() } },
    from: (table: string) => {
      if (table === "participants") {
        // The cron query: .select(...).eq("status","pending").eq("payment","pending").lt("created_at",cutoff)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                lt: () => mockStaleQuery(),
              }),
            }),
          }),
        };
      }
      const noop = {
        select: () => noop,
        eq: () => noop,
        in: () => Promise.resolve({ data: [], error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      };
      return noop;
    },
  }),
}));

import { createApp } from "../_app.js";

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "RMK <noreply@rmkconseils.com>";
  process.env.SITE_URL = "https://rmkconseils.com";
  process.env.ADMIN_NOTIFY_EMAILS = "admin@example.com";
  process.env.CRON_SECRET = "secret-token";
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
});

describe("POST /api/cron/sla-reminder", () => {
  it("rejects without CRON_SECRET — 401", async () => {
    const res = await request(app).post("/api/cron/sla-reminder");
    expect(res.status).toBe(401);
  });

  it("rejects with wrong secret — 401", async () => {
    const res = await request(app)
      .post("/api/cron/sla-reminder")
      .set("Authorization", "Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("returns count=0 when no stale rows, no email sent", async () => {
    mockStaleQuery.mockResolvedValueOnce({ data: [], error: null });

    const res = await request(app)
      .post("/api/cron/sla-reminder")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("emails admins when stale rows exist", async () => {
    const fortyNineHoursAgo = new Date(
      Date.now() - 49 * 3600 * 1000,
    ).toISOString();
    mockStaleQuery.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          prenom: "Marie",
          nom: "Koffi",
          email: "marie@example.com",
          seminar: "s1",
          payment_reference: "RMK-2026-AAAAA",
          created_at: fortyNineHoursAgo,
        },
        {
          id: "p2",
          prenom: "Jean",
          nom: "Dupont",
          email: "jean@example.com",
          seminar: "s2",
          payment_reference: "RMK-2026-BBBBB",
          created_at: fortyNineHoursAgo,
        },
      ],
      error: null,
    });

    const res = await request(app)
      .post("/api/cron/sla-reminder")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const sent = (mockResendSend.mock.calls as unknown[][])[0]![0] as {
      to: string[] | string;
      html: string;
    };
    expect(sent.html).toContain("RMK-2026-AAAAA");
    expect(sent.html).toContain("RMK-2026-BBBBB");
  });

  it("skips email when ADMIN_NOTIFY_EMAILS is empty", async () => {
    process.env.ADMIN_NOTIFY_EMAILS = "";
    app = createApp({
      gracefulDegradation: false,
      supabaseUrl: "https://mock.supabase.co",
      supabaseServiceKey: "mock-service-key",
      supabaseAnonKey: "mock-anon-key",
    });

    mockStaleQuery.mockResolvedValueOnce({
      data: [
        {
          id: "p1",
          prenom: "X",
          nom: "Y",
          email: "x@y.com",
          seminar: "s1",
          payment_reference: "RMK-2026-CCCCC",
          created_at: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
        },
      ],
      error: null,
    });

    const res = await request(app)
      .post("/api/cron/sla-reminder")
      .set("Authorization", "Bearer secret-token");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
