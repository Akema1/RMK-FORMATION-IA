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

type MockResponse = { data: unknown; error: unknown };
const participantsQueue: MockResponse[] = [];
const updateQueue: MockResponse[] = [];
const adminQueue: MockResponse[] = [];
const mockGenerateLink = vi.fn();
const mockGetUser = vi.fn();

function nextParticipant(): MockResponse {
  return participantsQueue.shift() ?? { data: null, error: null };
}
function nextUpdate(): MockResponse {
  return updateQueue.shift() ?? { data: [], error: null };
}
function nextAdmin(): MockResponse {
  return adminQueue.shift() ?? { data: null, error: null };
}

vi.mock("@supabase/supabase-js", () => {
  const buildParticipants = () => {
    const handler = {
      select: () => handler,
      eq: () => handler,
      neq: () => handler,
      maybeSingle: () => Promise.resolve(nextParticipant()),
      single: () => Promise.resolve(nextParticipant()),
      // update().eq().neq().select() returns the update mock
      update: () => ({
        eq: () => ({
          neq: () => ({ select: () => Promise.resolve(nextUpdate()) }),
          select: () => Promise.resolve(nextUpdate()),
        }),
      }),
    };
    return handler;
  };
  const buildAdmin = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve(nextAdmin()),
      }),
    }),
  });
  const buildSeminars = () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: { title: "S1", dates: "26 Mai" },
            error: null,
          }),
      }),
    }),
  });
  return {
    createClient: () => ({
      auth: {
        getUser: mockGetUser,
        admin: { generateLink: mockGenerateLink },
      },
      from: (table: string) => {
        if (table === "participants") return buildParticipants();
        if (table === "admin_users") return buildAdmin();
        if (table === "seminars") return buildSeminars();
        const noop = {
          select: () => noop,
          eq: () => noop,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          insert: () => Promise.resolve({ data: null, error: null }),
        };
        return noop;
      },
    }),
  };
});

import { createApp } from "../_app.js";

let app: Express;

function authedAsAdmin() {
  mockGetUser.mockResolvedValue({
    data: { user: { email: "admin@example.com" } },
    error: null,
  });
  adminQueue.push({ data: { email: "admin@example.com" }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  participantsQueue.length = 0;
  updateQueue.length = 0;
  adminQueue.length = 0;
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "RMK <noreply@rmk-conseils.com>";
  process.env.SITE_URL = "https://rmk-conseils.com";
  process.env.SUPPORT_PHONE = "+225 07 02 61 15 82";
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
});

describe("POST /api/admin/participants/:id/mark-paid", () => {
  it("requires bearer auth — 401 without Authorization header", async () => {
    const res = await request(app).post("/api/admin/participants/abc/mark-paid");
    expect(res.status).toBe(401);
  });

  it("requires admin allowlist — 403 when authed but not admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { email: "rando@example.com" } },
      error: null,
    });
    adminQueue.push({ data: null, error: null }); // not in admin_users
    const res = await request(app)
      .post("/api/admin/participants/abc/mark-paid")
      .set("Authorization", "Bearer token");
    expect(res.status).toBe(403);
  });

  it("flips status=confirmed AND payment=paid, sends welcome email with magic link", async () => {
    authedAsAdmin();
    participantsQueue.push({
      data: {
        id: "p1",
        email: "marie@example.com",
        prenom: "Marie",
        seminar: "s1",
        status: "pending",
        payment: "pending",
      },
      error: null,
    });
    updateQueue.push({ data: [{ id: "p1" }], error: null });
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase/magic" } },
      error: null,
    });

    const res = await request(app)
      .post("/api/admin/participants/p1/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({ payment_provider: "wave" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.was_already_confirmed).toBe(false);
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const sent = (mockResendSend.mock.calls as unknown[][])[0]![0] as {
      to: string;
      html: string;
    };
    expect(sent.to).toBe("marie@example.com");
    expect(sent.html).toContain("https://supabase/magic");
  });

  it("idempotent — already-confirmed returns 200 without re-sending email", async () => {
    authedAsAdmin();
    participantsQueue.push({
      data: {
        id: "p2",
        email: "x@y.com",
        prenom: "X",
        seminar: "s1",
        status: "confirmed",
        payment: "paid",
      },
      error: null,
    });
    updateQueue.push({ data: [], error: null }); // 0 rows updated by .neq("status","confirmed")

    const res = await request(app)
      .post("/api/admin/participants/p2/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.was_already_confirmed).toBe(true);
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("404 when participant not found", async () => {
    authedAsAdmin();
    participantsQueue.push({ data: null, error: null });

    const res = await request(app)
      .post("/api/admin/participants/missing/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({});
    expect(res.status).toBe(404);
  });

  it("rejects unknown payment_provider value with 400", async () => {
    authedAsAdmin();
    const res = await request(app)
      .post("/api/admin/participants/p3/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({ payment_provider: "bitcoin" });
    expect(res.status).toBe(400);
  });

  it("accepts valid payment_provider values", async () => {
    authedAsAdmin();
    participantsQueue.push({
      data: {
        id: "p4",
        email: "z@y.com",
        prenom: "Z",
        seminar: "s1",
        status: "pending",
        payment: "pending",
      },
      error: null,
    });
    updateQueue.push({ data: [{ id: "p4" }], error: null });
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase/magic" } },
      error: null,
    });

    const res = await request(app)
      .post("/api/admin/participants/p4/mark-paid")
      .set("Authorization", "Bearer admin-token")
      .send({ payment_provider: "orange_money" });
    expect(res.status).toBe(200);
  });
});
