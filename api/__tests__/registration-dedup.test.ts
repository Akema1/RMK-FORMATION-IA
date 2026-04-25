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

// Queue-based mock for participants table — each request pulls the next planned
// response. Lets tests script SELECT / INSERT / re-SELECT sequences for dedup
// and race-condition cases. `tasks` is best-effort (auto-task creation), so we
// give it a permissive default to avoid forcing every test to mock it.
type MockResponse = { data: unknown; error: unknown };
const participantsQueue: MockResponse[] = [];
const tasksQueue: MockResponse[] = [];
const mockGenerateLink = vi.fn();

function nextParticipant(): MockResponse {
  return participantsQueue.shift() ?? { data: null, error: null };
}
function nextTasks(): MockResponse {
  return tasksQueue.shift() ?? { data: [], error: null };
}

const insertSpy = vi.fn();
vi.mock("@supabase/supabase-js", () => {
  const buildParticipants = () => {
    const handler = {
      select: () => handler,
      eq: () => handler,
      neq: () => handler,
      limit: () => handler,
      in: () => handler,
      maybeSingle: () => Promise.resolve(nextParticipant()),
      single: () => Promise.resolve(nextParticipant()),
    };
    return {
      ...handler,
      insert: (row: unknown) => {
        insertSpy(row);
        return { select: () => ({ single: handler.single }) };
      },
    };
  };
  const buildTasks = () => {
    const handler = {
      select: () => handler,
      eq: () => handler,
      in: () => handler,
      limit: () => Promise.resolve(nextTasks()),
      insert: () => Promise.resolve({ data: null, error: null }),
    };
    return handler;
  };
  return {
    createClient: () => ({
      auth: {
        getUser: vi.fn(),
        admin: { generateLink: mockGenerateLink },
      },
      from: (table: string) => {
        if (table === "participants") return buildParticipants();
        if (table === "tasks") return buildTasks();
        // Catch-all for other tables (admin_users, leads, etc.)
        const noop = {
          select: () => noop,
          eq: () => noop,
          neq: () => noop,
          ilike: () => noop,
          in: () => noop,
          limit: () => Promise.resolve({ data: [], error: null }),
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

function validBody() {
  return {
    civilite: "Mme",
    nom: "Koffi",
    prenom: "Marie",
    email: "marie@example.com",
    tel: "+22507000000",
    societe: "Acme",
    fonction: "DG",
    seminar: "s1",
    referral_channel: "LinkedIn",
    consent: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertSpy.mockClear();
  participantsQueue.length = 0;
  tasksQueue.length = 0;
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "RMK <noreply@rmkconseils.com>";
  process.env.SITE_URL = "https://rmkconseils.com";
  process.env.SUPPORT_PHONE = "+225 07 02 61 15 82";
  process.env.ADMIN_NOTIFY_EMAILS = "admin@example.com";
  app = createApp({
    gracefulDegradation: false,
    supabaseUrl: "https://mock.supabase.co",
    supabaseServiceKey: "mock-service-key",
    supabaseAnonKey: "mock-anon-key",
  });
});

describe("POST /api/register — dedup matrix", () => {
  it("new email → 201, inserts row, sends 2 emails (participant + admin)", async () => {
    participantsQueue.push({ data: null, error: null }); // initial dedup SELECT
    participantsQueue.push({
      data: { id: "uuid-1" },
      error: null,
    }); // INSERT result

    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.payment_reference).toMatch(/^RMK-\d{4}-[A-Z0-9]{5}$/);
    expect(res.body.participant_id).toBe("uuid-1");
    expect(mockResendSend).toHaveBeenCalledTimes(2);
  });

  it("existing pending+pending → 409 state=pending_unpaid, resends confirmation", async () => {
    participantsQueue.push({
      data: {
        id: "row-1",
        status: "pending",
        payment: "pending",
        payment_reference: "RMK-2026-ABCDE",
      },
      error: null,
    });

    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("pending_unpaid");
    expect(res.body.action_taken).toBe("resent_confirmation");
    expect(res.body.payment_reference).toBe("RMK-2026-ABCDE");
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("existing pending+paid → 409 state=pending_paid, no email resent", async () => {
    participantsQueue.push({
      data: {
        id: "row-2",
        status: "pending",
        payment: "paid",
        payment_reference: "RMK-2026-PAID1",
      },
      error: null,
    });

    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("pending_paid");
    expect(res.body.action_taken).toBe("none");
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("existing confirmed → 409 state=confirmed, sends magic link", async () => {
    participantsQueue.push({
      data: {
        id: "row-3",
        status: "confirmed",
        payment: "paid",
        payment_reference: "RMK-2026-CONF1",
      },
      error: null,
    });
    mockGenerateLink.mockResolvedValueOnce({
      data: { properties: { action_link: "https://supabase/magic" } },
      error: null,
    });

    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("confirmed");
    expect(res.body.action_taken).toBe("sent_magic_link");
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("rejects without consent_at", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ ...validBody(), consent: false });
    expect(res.status).toBe(400);
  });

  it("rejects when channel=Recommandation but referrer_name missing", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({
        ...validBody(),
        referral_channel: "Recommandation",
        referrer_name: "",
      });
    expect(res.status).toBe(400);
  });

  it("rejects when channel=Autre but channel_other missing", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ ...validBody(), referral_channel: "Autre", channel_other: "" });
    expect(res.status).toBe(400);
  });

  it("rejects unknown channel value", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ ...validBody(), referral_channel: "TikTok" });
    expect(res.status).toBe(400);
  });

  it("rejects unknown seminar id", async () => {
    const res = await request(app)
      .post("/api/register")
      .send({ ...validBody(), seminar: "s999" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("unknown_seminar");
  });

  it("on payment_reference collision retries and inserts", async () => {
    participantsQueue.push({ data: null, error: null }); // dedup SELECT: not found
    participantsQueue.push({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value",
        details: "Key (payment_reference)=(RMK-2026-XXXXX) already exists.",
      },
    });
    participantsQueue.push({
      data: { id: "uuid-retry" },
      error: null,
    });

    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.participant_id).toBe("uuid-retry");
  });

  it("on (email,seminar) race after passing SELECT, returns 409 dedup", async () => {
    participantsQueue.push({ data: null, error: null }); // dedup SELECT: not found
    participantsQueue.push({
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value",
        details:
          "Key (lower(email), seminar)=(marie@example.com, s1) already exists.",
      },
    });
    participantsQueue.push({
      data: {
        id: "row-raced",
        status: "pending",
        payment: "pending",
        payment_reference: "RMK-2026-RACED",
      },
      error: null,
    }); // re-SELECT after race

    const res = await request(app).post("/api/register").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.state).toBe("pending_unpaid");
  });

  it("rate-limits 6th submission from same IP", async () => {
    // Each submission needs a dedup SELECT that returns an existing row so the
    // request is short-circuited on dedup (no INSERT mock needed, no email
    // mock noise). 5 allowed, 6th hits the limiter.
    for (let i = 0; i < 6; i++) {
      participantsQueue.push({
        data: {
          id: `r${i}`,
          status: "pending",
          payment: "paid",
          payment_reference: `RMK-2026-X${i}`,
        },
        error: null,
      });
    }
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const r = await request(app).post("/api/register").send(validBody());
      lastStatus = r.status;
    }
    expect(lastStatus).toBe(429);
  });

  // Early-bird regression — the legacy LandingPage computed isEarlyBird
  // client-side and passed the discounted amount. The Phase 1C refactor
  // accidentally hardcoded standard price; this test guards against that
  // recurring. The fix moved the early-bird math into /api/register itself.
  it("inserts the early-bird amount when the seminar is more than 15 days away", async () => {
    participantsQueue.push({ data: null, error: null }); // dedup SELECT
    participantsQueue.push({ data: { id: "uuid-eb" }, error: null }); // INSERT

    const farFutureSeminar = "s4"; // S4 starts later in the program; well past the cutoff
    const res = await request(app)
      .post("/api/register")
      .send({ ...validBody(), seminar: farFutureSeminar });

    expect(res.status).toBe(201);
    const inserted = insertSpy.mock.calls[0]?.[0] as { amount: number };
    expect(inserted.amount).toBe(540000); // S4 earlyBirdPrice
  });

  it("inserts the standard amount when the seminar is within 15 days", async () => {
    // Build an in-memory body for a seminar so close that early-bird is gone.
    // Easier than mucking with system clock: use a seminar id that doesn't
    // exist (falls back to standard) and assert standard price flows through.
    // Actually the validator rejects unknown seminars, so instead we mock
    // Date.now to be inside the cutoff for s1 (which starts 2026-05-26).
    const realNow = Date.now;
    Date.now = () => new Date("2026-05-20T00:00:00Z").getTime(); // 6 days before s1
    try {
      participantsQueue.push({ data: null, error: null });
      participantsQueue.push({ data: { id: "uuid-std" }, error: null });

      const res = await request(app)
        .post("/api/register")
        .send({ ...validBody(), seminar: "s1" });

      expect(res.status).toBe(201);
      const inserted = insertSpy.mock.calls[0]?.[0] as { amount: number };
      expect(inserted.amount).toBe(700000); // S1 standard price (per seminars.ts)
    } finally {
      Date.now = realNow;
    }
  });
});
