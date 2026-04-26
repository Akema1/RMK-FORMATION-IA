/**
 * Shared Express app factory — used by both `api/index.ts` (Vercel serverless)
 * and `server.ts` (local dev with Vite middleware).
 *
 * Extracted to eliminate dev/prod drift in CORS, rate limiters, auth, and
 * route handlers. The only differences between environments are:
 *  - dev: optional Supabase (graceful degradation when env missing)
 *  - dev: `.env` loaded via dotenv before this runs
 *  - dev: Vite middleware mounted by caller after this returns
 *  - dev: `app.listen()` + cron scheduled by caller
 *  - prod: strict startup guard, OIDC for AI Gateway, `export default app`
 */
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import { SEMINARS, EARLY_BIRD_DAYS_BEFORE, getSeminarPricing } from "../src/data/seminars.js";
import { renderSystemPrompt, PROMPT_TEMPLATES, type TemplateId } from "./_prompts.js";
import { renderEmail } from "./_lib/render-email.js";
import { sendEmail } from "./_lib/send-email.js";
import { generateMagicLinkUrl } from "./_lib/magic-link.js";
import {
  RegisterBodySchema,
  registerOrDedup,
  type RegisterBody,
} from "./_lib/registration.js";
import { magicLink } from "./_email-templates/magic-link.js";
import { registrationConfirmation } from "./_email-templates/registration-confirmation.js";
import { adminNewRegistration } from "./_email-templates/admin-new-registration.js";
import { welcomeConfirmed } from "./_email-templates/welcome-confirmed.js";
import { adminSlaReminder } from "./_email-templates/admin-sla-reminder.js";
import { recommendationFollowup } from "./_email-templates/recommendation-followup.js";

export interface CreateAppOptions {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseAnonKey?: string;
  appUrl?: string;
  /**
   * dev: tolerate missing Supabase (routes that need it return 503).
   * prod: never set true — `api/index.ts` asserts env vars before calling.
   */
  gracefulDegradation?: boolean;
}

// Scoped to this project's preview URLs only — prevents other Vercel apps from passing CORS.
// Vercel emits two preview hostnames for the same deployment:
//   - Branch alias:       rmk-formation-ia-git-<branch>-akemas-projects.vercel.app
//   - Deployment-unique:  rmk-formation-<hash>-akemas-projects.vercel.app  (drops "-ia")
// Anchor on the team suffix so only this team's previews are allowed.
const VERCEL_PREVIEW_RE = /^https:\/\/rmk-formation(-ia)?-[a-z0-9-]+-akemas-projects\.vercel\.app$/;

// ── Sanitization helpers ────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeText(str: string, maxLen = 200): string {
  return String(str)
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, maxLen);
}

function escapeLike(str: string): string {
  return str.replace(/([%_\\])/g, "\\$1");
}

// ── Validation schemas ──────────────────────────────────────────────────────

const portalLookupSchema = z.object({
  email: z.string().email().max(254),
  nom: z.string().min(1).max(100),
});

// Sprint 7 Phase 4 — pre-insert idempotency check. The LandingPage calls this
// before its anon insert into `participants` so a retry (network timeout,
// browser back-button, double-click edge case) doesn't create a second row
// for the same (email, seminar) tuple. The participants RLS lets anon INSERT
// but not SELECT, so the dupe check MUST go through the service role here.
const registrationCheckSchema = z.object({
  email: z.string().email().max(254),
  seminar: z.string().min(1).max(50),
});

const aiGenerateSchema = z.object({
  templateId: z.enum(PROMPT_TEMPLATES as readonly [TemplateId, ...TemplateId[]]),
  vars: z.record(z.string(), z.any()).optional(),
  userPrompt: z.string().max(5000).optional(),
  messages: z.array(z.object({
    role: z.string(),
    text: z.string().max(5000).optional(),
    parts: z.array(z.any()).optional(),
  })).max(20).optional(),
})
.refine(
  (v) => {
    if (v.templateId !== "prospection") return true;
    const vars = v.vars ?? {};
    return (
      typeof vars.sector === "string" &&
      typeof vars.zone === "string" &&
      typeof vars.need === "string" &&
      (vars.sector as string).length > 0 &&
      (vars.zone as string).length > 0 &&
      (vars.need as string).length > 0
    );
  },
  { message: "prospection template requires vars.sector, vars.zone, vars.need", path: ["vars"] }
)
.refine(
  (v) => {
    if (v.templateId !== "prospection") return true;
    const ctx = v.vars?.seminarsContext;
    if (ctx === undefined) return true;
    if (!Array.isArray(ctx)) return false;
    return ctx.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).code === "string" &&
        typeof (s as Record<string, unknown>).title === "string" &&
        typeof (s as Record<string, unknown>).week === "string"
    );
  },
  { message: "prospection seminarsContext must be Array<{code,title,week}>", path: ["vars", "seminarsContext"] }
);

// Public chat endpoint — stricter schema than aiGenerateSchema:
// - templateId locked to "chat" (can't jailbreak into commercial/seo/research)
// - mode locked to "client" (unauthenticated callers cannot request the admin
//   persona — see Gemini security scan finding #2 during Phase 1 review)
// - messages: role is a strict enum, 20 entry cap, 5000 chars each
// - parts: strict object shape with bounded text (prevents DoS via z.any())
const aiChatSchema = z.object({
  templateId: z.literal("chat"),
  vars: z.object({
    mode: z.literal("client"),
    seminars: z.array(z.object({
      id: z.string().max(100),
      code: z.string().max(20),
      title: z.string().max(200),
      week: z.string().max(100),
    })).max(10),
    userName: z.string().max(100).optional(),
  }),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "model"]),
    text: z.string().max(5000).optional(),
    parts: z.array(z.object({
      text: z.string().max(5000),
    })).max(10).optional(),
  })).min(1).max(20),
});

const leadCaptureSchema = z.object({
  nom: z.string().min(1).max(100),
  contact: z.string().min(1).max(200),
  source: z.string().min(1).max(100),
  entreprise: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

// Community post body schema. ONLY text comes from the client. The endpoint
// derives author, initials, participant_id, AND seminar_tag server-side from
// the authenticated caller's participants row — never trust the client for
// identity fields OR for which feed the post belongs to.
const communityPostSchema = z.object({
  text: z.string().min(1).max(2000),
});

const coachingRequestSchema = z.object({
  seminar: z.string().min(1).max(100),
  userPrompt: z.string().min(1).max(1000),
});

const webhookProspectSchema = z.object({
  nom: z.string().min(1).max(100),
  entreprise: z.string().min(1).max(200),
  poste: z.string().min(1).max(200),
  seminar: z.string().min(1).max(200),
});

const webhookWhatsappSchema = z.object({
  from: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
});

/**
 * Build an Express app with every RMK API route wired. Safe to call once per
 * process. See CreateAppOptions for dev-vs-prod differences.
 */
export function createApp(opts: CreateAppOptions): express.Express {
  const app = express();

  // Trust the first proxy hop (Vercel edge / Vite dev proxy) so
  // express-rate-limit keys on the real client IP, not the edge IP.
  app.set("trust proxy", 1);

  // ── CORS: exact-match allowlist + scoped Vercel preview regex ─────────────
  const ALLOWED_ORIGINS: string[] = opts.appUrl
    ? [opts.appUrl, "http://localhost:8080"]
    : ["http://localhost:8080"];
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // server-to-server, no Origin header
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        if (VERCEL_PREVIEW_RE.test(origin)) return cb(null, true);
        cb(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
    })
  );
  app.use(
    express.json({
      limit: "100kb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // ── Supabase clients ──────────────────────────────────────────────────────
  let supabaseAdmin: SupabaseClient | null = null;
  let supabaseAnon: SupabaseClient | null = null;
  if (opts.supabaseUrl && opts.supabaseServiceKey) {
    supabaseAdmin = createClient(opts.supabaseUrl, opts.supabaseServiceKey);
  }
  if (opts.supabaseUrl && opts.supabaseAnonKey) {
    supabaseAnon = createClient(opts.supabaseUrl, opts.supabaseAnonKey);
  }
  if (!opts.gracefulDegradation && (!supabaseAdmin || !supabaseAnon)) {
    throw new Error(
      "createApp: Supabase admin + anon clients required in non-degraded mode"
    );
  }

  // ── AI model ──────────────────────────────────────────────────────────────
  // Routes through Vercel AI Gateway — auth via OIDC (auto on Vercel) or AI_GATEWAY_API_KEY.
  const AI_MODEL = gateway("anthropic/claude-haiku-4.5");

  // ── Rate limiters ─────────────────────────────────────────────────────────
  // Portal lookups: 5/min is 7200/day — enough to seed an email enumeration.
  // 3/min = 4320/day and won't inconvenience a legitimate user.
  const portalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: "Too many requests. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: "Too many AI requests. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Separate bucket from registerLimiter: public lead-capture surface shouldn't
  // starve the registration budget on a shared limiter.
  const leadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: "Too many lead submissions. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Sprint 7 Phase 4 — registration duplicate check. Called from LandingPage
  // BEFORE the anon insert into participants. This endpoint reveals whether
  // a given (email, seminar) tuple has an existing row, which is an email-
  // enumeration primitive by design — the real user needs the answer. A
  // strict cap keeps the bulk-scraping surface small: 10/min/IP is ~4x the
  // happy-path need (4 seminars to check + typo retries) while blocking
  // automated sweeps. Review-fix: tightened from 30 on Gemini's flag.
  const registrationCheckLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many registration checks. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Community posts: strict rate limit. Phase 3 anti-spam.
  // Lower than leadLimiter (5/min) because a single confirmed participant
  // should never need to post more than ~2 messages per minute.
  //
  // NOTE: express-rate-limit uses an in-memory store by default. On Vercel
  // Fluid Compute this is per-instance, not shared across concurrent instances.
  // A Redis-backed store is a cross-cutting follow-up (also affects leadLimiter,
  // registerLimiter, etc). Tracked as a separate commit.
  const communityLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { error: "Too many community posts. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Coaching AI: 5/min — higher than community (3/min) because AI responses
  // take longer and participants may retry on timeout. Lower than admin AI
  // (20/min) because the participant surface is public-facing.
  const coachingLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: "Too many coaching requests. Try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // POST /api/register limiter: 5 req / 10 min / IP. /api/register owns the
  // participant INSERT, so abuse means real DB writes and real Resend quota
  // burn. The dedup branch short-circuits before INSERT, but each request
  // still hits the DB.
  const registerLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { error: "Too many registration submissions. Try again in a few minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Magic-link send: per-IP+email key, 3 req / 5 min. Anti-enumeration is
  // handled in the route (always 200), so this limiter only blocks abuse
  // (mass-mailbomb of one address, or one IP probing many addresses).
  const magicLinkLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    keyGenerator: (req) =>
      `${ipKeyGenerator(req.ip ?? "unknown")}:${String(req.body?.email ?? "").toLowerCase()}`,
    message: { error: "Too many magic-link requests. Try again in a few minutes." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ── Auth middleware: verify Supabase JWT + admin allowlist ──────────────
  // requireAuth: valid session required. requireAdmin: same + caller's email
  // must be in public.admin_users. Gating AI endpoints on requireAdmin
  // mirrors the DB-side RLS model (is_admin() / admin_users) so that every
  // admin surface — DB and HTTP — consults the same allowlist.
  async function requireAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (!supabaseAnon) {
      return res.status(503).json({ error: "Auth not configured" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { data, error } = await supabaseAnon.auth.getUser(authHeader.slice(7));
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    (req as any).userEmail = data.user.email ?? null;
    next();
  }

  async function requireAdmin(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const email = (req as any).userEmail as string | null;
    if (!email) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // Use maybeSingle() so a 0-row result returns data=null instead of throwing
    // PGRST116 (which would bubble as a 500 and mask an auth denial as a server
    // error). This preserves a clean 403 on "not an admin".
    const { data, error } = await supabaseAdmin
      .from("admin_users")
      .select("email")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (error) {
      return res.status(500).json({ error: "Admin lookup failed" });
    }
    if (!data) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  }

  // ── Webhook auth: HMAC-SHA256 body signature ──────────────────────────────
  function requireWebhookSecret(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const header = req.headers["x-webhook-signature"];
    const signature = typeof header === "string" ? header : "";
    const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
    const rawBody: Buffer | undefined = (req as any).rawBody;
    if (!rawBody || !provided) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const providedBuf = Buffer.from(provided, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

  // ── Fetch live seminar stats (participants/confirmed counts) ──────────────
  // Used to inject real-time context into the "commercial" AI prompt, replacing
  // the broken client-side tool-call loop. Returns nulls when Supabase is off.
  async function fetchSeminarStats(seminarId: string) {
    if (!supabaseAdmin) return null;
    const { data } = await supabaseAdmin
      .from("participants")
      .select("status")
      .eq("seminar", seminarId);
    if (!data) return null;
    return {
      total: data.length,
      confirmed: data.filter((p: any) => p.status === "confirmed").length,
    };
  }

  // ── Health check (public, no rate limit — used by uptime monitors) ───────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Registration duplicate check (Sprint 7 Phase 4) ──────────────────────
  // Idempotency guard for the public LandingPage registration form. Anon
  // SELECT is blocked by participants RLS, so the client can't do this
  // query itself. Same email CAN register for different seminars (confirmed
  // business rule, not a bug), but the same (email, seminar) tuple is a
  // duplicate regardless of row status.
  app.post(
    "/api/registration/check-duplicate",
    registrationCheckLimiter,
    async (req, res) => {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Database not configured" });
      }
      const parsed = registrationCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const email = parsed.data.email.toLowerCase().trim();
      const seminar = parsed.data.seminar;

      // Select only `id` — we only need the existence bit. Returning the
      // row's `status` (pending/confirmed/cancelled/etc) to an anonymous
      // caller leaks private state and turns the endpoint into a status-
      // enumeration primitive. The client just shows "already registered,
      // check portal" regardless of status, so there's no reason to share it.
      // Flagged by Qwen pre-push review.
      const { data, error } = await supabaseAdmin
        .from("participants")
        .select("id")
        .eq("email", email)
        .eq("seminar", seminar)
        .limit(1);

      if (error) {
        console.error("Registration check error:", error);
        // Fail-closed: the client must not silently proceed on DB failure.
        return res.status(500).json({ error: "Lookup failed" });
      }

      const exists = !!(data && data.length > 0);
      return res.json({ exists });
    }
  );

  // ── Client portal lookup ──────────────────────────────────────────────────
  app.post("/api/portal/lookup", portalLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const parsed = portalLookupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Email and nom required" });
    }
    const { email, nom } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from("participants")
      // tel excluded — phone number PII not needed in participant self-service view
      .select("nom, prenom, email, seminar, status, created_at")
      .eq("email", email.toLowerCase().trim())
      .ilike("nom", escapeLike(nom.trim()));

    if (error) {
      console.error("Portal lookup error:", error);
      return res.status(500).json({ error: "Lookup failed" });
    }
    res.json(data || []);
  });

  // ── Send recommendation email (Phase 1G / Task 27) ────────────────────────
  // Fired when a participant completes the onboarding survey. The recommendation
  // string is computed client-side (see surveyConfig.getRecommendation) and
  // passed in; the server enriches with prenom + portalUrl and sends via the
  // templated renderer. requireAuth ensures the JWT email matches a real user;
  // we then verify a participant row exists for that email before emailing.
  const SendRecommendationBody = z.object({
    recommendation: z.string().min(1).max(2000),
  });

  app.post("/api/portal/send-recommendation", requireAuth, async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const parsed = SendRecommendationBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "validation" });

    const userEmail = (req as { userEmail?: string | null }).userEmail;
    if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("prenom")
      .eq("email", userEmail.toLowerCase().trim())
      .order("confirmed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (!participant) return res.status(404).json({ error: "no_participant" });

    const siteUrl = process.env.SITE_URL ?? "https://rmk-conseils.com";
    try {
      await sendEmail(
        {
          ...renderEmail(recommendationFollowup, {
            prenom: (participant as { prenom: string }).prenom,
            recommendation: parsed.data.recommendation,
            portalUrl: `${siteUrl}/portal`,
          }),
          to: userEmail,
        },
        {
          resendApiKey: process.env.RESEND_API_KEY ?? "",
          from: process.env.EMAIL_FROM ?? "RMK Conseils <noreply@rmk-conseils.com>",
        },
      );
    } catch (err) {
      console.error("[send-recommendation] email send failed:", err);
      return res.status(502).json({ error: "email_send_failed" });
    }

    res.json({ ok: true });
  });

  // ── Magic-link send (Phase 1C / Task 12) ─────────────────────────────────
  // Anti-enumeration: ALWAYS responds 200 {ok:true} regardless of whether the
  // email matches a confirmed participant. Distinguishing 200/404 here would
  // leak who has registered. Email is sent only when (a) participant exists,
  // (b) status='confirmed', (c) Supabase generateLink() succeeds.
  app.post("/api/auth/send-magic-link", magicLinkLimiter, async (req, res) => {
    const respond = () => res.json({ ok: true });

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }

    if (!supabaseAdmin) {
      // Fail-open into anti-enumeration shape so dev (graceful-degradation)
      // and misconfigured prod don't leak DB-availability state.
      return respond();
    }

    // A user can be confirmed for multiple seminars under the same email — the
    // unique index is (email, seminar). Without limit(1) the maybeSingle() call
    // would PGRST116 and lock the user out of the magic-link flow. Order by
    // most recent confirmation so the magic link points at the seminar they're
    // most plausibly trying to access.
    const { data: participant } = await supabaseAdmin
      .from("participants")
      .select("prenom, seminar, confirmed_at")
      .eq("email", email)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!participant) return respond();

    const { data: seminar } = await supabaseAdmin
      .from("seminars")
      .select("title")
      .eq("id", participant.seminar)
      .maybeSingle();

    const url = await generateMagicLinkUrl(email, supabaseAdmin);
    if (!url) return respond();

    try {
      const rendered = renderEmail(magicLink, {
        prenom: participant.prenom,
        seminarTitle: seminar?.title ?? "votre formation",
        magicLinkUrl: url,
        supportPhone: process.env.SUPPORT_PHONE ?? "+225 07 02 61 15 82",
      });
      await sendEmail(
        { ...rendered, to: email },
        {
          resendApiKey: process.env.RESEND_API_KEY ?? "",
          from: process.env.EMAIL_FROM ?? "RMK Conseils <noreply@rmk-conseils.com>",
        },
      );
    } catch (err) {
      // Email failure must not break anti-enumeration. Log and respond 200.
      console.error("[magic-link] sendEmail failed for", email, err);
    }

    respond();
  });

  // ── Registration v2 (Phase 1C / Task 11) ─────────────────────────────────
  // Owns the participant INSERT. Dedup-aware:
  //   201 created   — new (email, seminar) pair, sends 2 emails (participant + admin)
  //   409 duplicate — existing row; behaviour depends on state:
  //     pending_unpaid → resend confirmation
  //     pending_paid   → no email (admin already saw, awaiting confirmation)
  //     confirmed      → send fresh magic link
  // Email failures do NOT roll back the DB row — the row is the source of truth.
  app.post("/api/register", registerLimiter, async (req, res) => {
    const parsed = RegisterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation", issues: parsed.error.issues });
    }
    const body: RegisterBody = parsed.data;

    const seminarMeta = SEMINARS.find((s) => s.id === body.seminar);
    if (!seminarMeta) {
      return res.status(400).json({ error: "unknown_seminar" });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Database not configured" });
    }

    // Early-bird pricing — owned server-side so the client cannot trick the
    // backend into a discount it hasn't earned. Pack ids ("pack2"/"pack4") have
    // no single start date, so they fall back to the EARLY_BIRD_DEADLINE-style
    // rule: only standard-priced seminars (S1..S4) are eligible.
    const pricing = getSeminarPricing(body.seminar);
    let amountFcfa = pricing.standard;
    if (seminarMeta.dates?.start) {
      const startMs = new Date(seminarMeta.dates.start + "T00:00:00Z").getTime();
      const cutoffMs = startMs - EARLY_BIRD_DAYS_BEFORE * 86_400_000;
      if (Date.now() <= cutoffMs) amountFcfa = pricing.earlyBird;
    }

    let result;
    try {
      result = await registerOrDedup(body, supabaseAdmin, amountFcfa);
    } catch (e) {
      console.error("[register] insert failed", e);
      return res.status(500).json({ error: "internal" });
    }

    const supportPhone = process.env.SUPPORT_PHONE ?? "+225 07 02 61 15 82";
    const siteUrl = process.env.SITE_URL ?? "https://rmk-conseils.com";
    const fromEmail = process.env.EMAIL_FROM ?? "RMK Conseils <noreply@rmk-conseils.com>";
    const resendApiKey = process.env.RESEND_API_KEY ?? "";
    const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const seminarDates = seminarMeta.week;
    const seminarTitle = seminarMeta.title;

    if (result.status === "created") {
      // Email failures must not block the 201 — DB row is source of truth.
      const sends: Promise<unknown>[] = [
        sendEmail(
          {
            ...renderEmail(registrationConfirmation, {
              prenom: body.prenom,
              civilite: body.civilite,
              seminarTitle,
              seminarDates,
              amountFcfa,
              paymentReference: result.paymentReference!,
              supportPhone,
              siteUrl,
            }),
            to: body.email,
          },
          { resendApiKey, from: fromEmail },
        ),
      ];
      if (adminEmails.length) {
        sends.push(
          sendEmail(
            {
              ...renderEmail(adminNewRegistration, {
                prenom: body.prenom,
                nom: body.nom,
                civilite: body.civilite,
                email: body.email,
                tel: body.tel,
                societe: body.societe,
                fonction: body.fonction,
                seminarTitle,
                amountFcfa,
                referralChannel: body.referral_channel,
                referrerName: body.referrer_name,
                channelOther: body.channel_other,
                paymentReference: result.paymentReference!,
                participantId: result.participantId!,
                adminUrl: siteUrl,
              }),
              to: adminEmails,
            },
            { resendApiKey, from: fromEmail },
          ),
        );
      }
      const settled = await Promise.allSettled(sends);
      settled.forEach((r, i) => {
        if (r.status === "rejected") {
          console.error(`[register] email ${i} failed for ${body.email}:`, r.reason);
        }
      });
      return res.status(201).json({
        participant_id: result.participantId,
        payment_reference: result.paymentReference,
      });
    }

    // Duplicate branches
    try {
      if (result.state === "pending_unpaid") {
        await sendEmail(
          {
            ...renderEmail(registrationConfirmation, {
              prenom: body.prenom,
              civilite: body.civilite,
              seminarTitle,
              seminarDates,
              // Use the row's stored amount so the resent confirmation matches
              // what the participant was originally invoiced (early-bird if they
              // qualified at registration time, standard otherwise). Falls back
              // to the freshly computed amount if the row didn't store one.
              amountFcfa: result.amountFcfa ?? amountFcfa,
              paymentReference: result.paymentReference!,
              supportPhone,
              siteUrl,
            }),
            to: body.email,
          },
          { resendApiKey, from: fromEmail },
        );
      } else if (result.state === "confirmed") {
        const url = await generateMagicLinkUrl(body.email, supabaseAdmin);
        if (url) {
          await sendEmail(
            {
              ...renderEmail(magicLink, {
                prenom: body.prenom,
                seminarTitle,
                magicLinkUrl: url,
                supportPhone,
              }),
              to: body.email,
            },
            { resendApiKey, from: fromEmail },
          );
        }
      }
    } catch (err) {
      console.error("[register] dup-branch email failed:", err);
    }

    return res.status(409).json({
      error: "duplicate_registration",
      state: result.state,
      payment_reference: result.paymentReference,
      action_taken: result.actionTaken,
    });
  });

  // ── Public lead capture (Blocker #2b) ─────────────────────────────────────
  // Used by the LandingPage ContactLead (lead magnet) form. Anon inserts into
  // `leads` and `tasks` are blocked by the is_admin()-scoped RLS, so all lead
  // capture now goes through this endpoint with the service-role key.
  app.post("/api/lead/capture", leadLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Database not configured" });
    }
    const parsed = leadCaptureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: parsed.error.issues.map((i) => i.message),
      });
    }
    const { nom, contact, source, entreprise, notes } = parsed.data;

    // Sanitize before storing — same pattern used elsewhere for text fields.
    const safeNom = sanitizeText(nom, 100);
    const safeContact = sanitizeText(contact, 200);
    const safeSource = sanitizeText(source, 100);
    const safeEntreprise = entreprise ? sanitizeText(entreprise, 200) : null;
    const safeNotes = notes ? sanitizeText(notes, 500) : null;

    // Idempotency guard: skip if a lead with the same contact info already
    // exists. Prevents duplicate leads on client retry or form re-submission.
    const { data: existingLead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("contact", safeContact)
      .limit(1);

    if (existingLead && existingLead.length > 0) {
      return res.json({ success: true });
    }

    try {
      const { error: leadErr } = await supabaseAdmin.from("leads").insert([
        {
          nom: safeNom,
          entreprise: safeEntreprise,
          contact: safeContact,
          source: safeSource,
          status: "froid",
          notes: safeNotes,
        },
      ]);
      if (leadErr) throw leadErr;

      // Best-effort follow-up task — mirrors the old ContactLead behavior.
      try {
        await supabaseAdmin.from("tasks").insert([
          {
            task: `[Commercial] Rappeler le prospect ${safeNom} (Contact: ${safeContact})`,
            owner: "alexis",
            priority: "high",
            seminar: "all",
            status: "todo",
          },
        ]);
      } catch (taskErr) {
        console.error("Lead follow-up task insert failed (non-fatal):", taskErr);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Lead capture error:", err);
      res.status(500).json({ error: "Lead capture failed" });
    }
  });

  // ── Community post (Phase 3: client portal feed) ─────────────────────────
  // Authenticated participant submits a post to the community feed. The
  // endpoint verifies the caller's session, looks up their participants row,
  // derives author/initials/participant_id/seminar_tag server-side from THAT
  // row (never from the client body), and inserts via the service role.
  //
  // Security invariants enforced here:
  // 1. requireAuth upstream ensures a valid Supabase session
  // 2. maybeSingle() lookup prevents PGRST116 from masking a 403 as a 500
  // 3. Only confirmed participants can post (mirrors the UI tab lock)
  // 4. ALL identity fields (author, initials, participant_id) come from the
  //    DB row, not the request body
  // 5. The seminar_tag is derived from SEMINARS.find(s => s.id === p.seminar)
  //    so a participant cannot cross-post into another seminar's feed
  // 6. sanitizeText strips control characters before storage
  app.post(
    "/api/community/post",
    communityLimiter,
    requireAuth,
    async (req, res) => {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Database not configured" });
      }

      const parsed = communityPostSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { text } = parsed.data;

      // requireAuth has already verified the session and set userEmail.
      const email = (req as any).userEmail as string | null;
      if (!email) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Look up the participant row by email. Multi-seminar registration is
      // supported (one email can register for S1, S2, etc.), so participants
      // has no unique constraint on email. Query for all confirmed rows and
      // pick the most recent one — the user posts into whichever seminar
      // they most recently registered for. A dedicated "post into which
      // seminar" selector is tracked as a follow-up (see TODOS.md).
      //
      // Using .limit(1) + array index instead of .maybeSingle() is what
      // prevents PGRST116 when the same email has multiple confirmed rows.
      const { data: participants, error: lookupErr } = await supabaseAdmin
        .from("participants")
        .select("id, nom, prenom, email, seminar, status")
        .eq("email", email.toLowerCase().trim())
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (lookupErr) {
        console.error("Participant lookup failed:", lookupErr);
        return res.status(500).json({ error: "Participant lookup failed" });
      }
      const participant = participants?.[0] ?? null;
      if (!participant) {
        // Unified 403 for both "no registration" and "not confirmed" — the
        // previous split leaked information about whether an email was
        // registered. Both are access denials from the caller's perspective.
        return res.status(403).json({
          error: "Community access requires a confirmed registration",
        });
      }

      // Derive every identity + scope field from the DB row.
      const safeText = sanitizeText(text, 2000);
      // Zod's .min(1) runs on the raw text, but sanitizeText strips control
      // characters — a payload of 2000 control chars would pass validation
      // and then collapse to an empty string. Re-check after sanitizing.
      if (!safeText) {
        return res.status(400).json({
          error: "Text cannot be empty after sanitization",
        });
      }
      const author = `${participant.prenom} ${participant.nom}`.trim();
      const initials = `${(participant.prenom || "?")[0] ?? "?"}${
        (participant.nom || "?")[0] ?? "?"
      }`.toUpperCase();

      // Server-side seminar_tag derivation: the participant can only post in
      // their own seminar's feed. Fall back to "Tous" if the participant row
      // references a seminar id that no longer exists in the SEMINARS list.
      const participantSeminar = SEMINARS.find(
        (s) => s.id === participant.seminar
      );
      const seminar_tag = participantSeminar?.code ?? "Tous";

      // crypto.randomUUID() is collision-resistant and matches the id pattern
      // already used by SeminarsManagement.tsx:180. Avoid Math.random() here:
      // non-cryptographic, theoretically collision-prone, contradicts the
      // otherwise tight security posture of this endpoint.
      const id = crypto.randomUUID();
      const date = new Date().toISOString().split("T")[0];

      const row = {
        id,
        author,
        initials,
        date,
        text: safeText,
        seminar_tag,
        participant_id: participant.id,
      };

      try {
        const { error: insertErr } = await supabaseAdmin
          .from("community_posts")
          .insert([row]);
        if (insertErr) throw insertErr;
        // Return only public-facing fields — never expose participant_id (internal FK)
        const { participant_id: _omit, ...publicRow } = row;
        return res.status(201).json({ post: publicRow });
      } catch (err) {
        console.error("Community post insert failed:", err);
        return res.status(500).json({ error: "Failed to save post" });
      }
    }
  );

  // ── AI coaching (confirmed participants only) ─────────────────────────
  app.post(
    "/api/ai/coaching",
    coachingLimiter,
    requireAuth,
    async (req, res) => {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Database not configured" });
      }

      const parsed = coachingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { seminar, userPrompt } = parsed.data;

      const email = (req as any).userEmail as string | null;
      if (!email) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify the seminar exists in our catalog before querying the DB.
      const seminarData = SEMINARS.find((s) => s.id === seminar);
      if (!seminarData) {
        return res.status(400).json({ error: "Unknown seminar" });
      }

      // Participant lookup: same pattern as /api/community/post.
      // Case-insensitive email match via .ilike() for defense-in-depth:
      // all emails are lowercase in the DB (Phase 3 migration normalized
      // them), but .ilike() guards against any future path that might
      // insert a mixed-case email before it hits the lower() index.
      const normalizedEmail = email.toLowerCase().trim();
      const { data: participants, error: lookupErr } = await supabaseAdmin
        .from("participants")
        .select("id, nom, prenom, email, seminar, status")
        .ilike("email", escapeLike(normalizedEmail))
        .eq("seminar", seminar)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (lookupErr) {
        console.error("Coaching participant lookup failed:", lookupErr);
        return res.status(500).json({ error: "Participant lookup failed" });
      }
      const participant = participants?.[0] ?? null;
      if (!participant) {
        return res.status(403).json({
          error: "Coaching access requires a confirmed registration for this seminar",
        });
      }

      const safePrompt = sanitizeText(userPrompt, 1000);
      if (!safePrompt) {
        return res.status(400).json({
          error: "Prompt cannot be empty after sanitization",
        });
      }

      try {
        const systemPrompt = renderSystemPrompt("coaching", {
          prenom: participant.prenom,
          nom: participant.nom,
          seminarId: participant.seminar,
          userPrompt: safePrompt,
        });

        const response = await generateText({
          model: AI_MODEL,
          system: systemPrompt,
          prompt: safePrompt,
        });

        return res.json({ text: response.text });
      } catch (err) {
        console.error("Coaching AI generation error:", err);
        return res.status(502).json({ error: "AI service temporarily unavailable" });
      }
    }
  );

  // ── Admin mark-paid (Phase 1C / Task 13) ─────────────────────────────────
  // Admin flips a participant from pending→confirmed in one call. Idempotent
  // via conditional UPDATE: the .neq("status","confirmed") clause ensures
  // already-confirmed rows are no-ops, and the affected-row count tells us
  // whether to fire the welcome email. Same-shape 200 in both branches —
  // distinguished by `was_already_confirmed`.
  const MarkPaidBody = z.object({
    payment_provider: z
      .enum(["wave", "orange_money", "bank_transfer", "cash", "flutterwave"])
      .optional(),
    confirmation_notes: z.string().trim().max(2000).optional(),
  });

  app.post(
    "/api/admin/participants/:id/mark-paid",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Database not configured" });
      }
      const parsed = MarkPaidBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "validation" });

      const { data: current } = await supabaseAdmin
        .from("participants")
        .select("id, email, prenom, seminar, status, payment")
        .eq("id", req.params.id)
        .maybeSingle();
      if (!current) return res.status(404).json({ error: "not_found" });

      const { data: updated, error } = await supabaseAdmin
        .from("participants")
        .update({
          status: "confirmed",
          payment: "paid",
          confirmed_at: new Date().toISOString(),
          confirmation_notes: parsed.data.confirmation_notes ?? null,
          payment_provider: parsed.data.payment_provider ?? null,
        })
        .eq("id", req.params.id)
        .neq("status", "confirmed")
        .select("id");

      if (error) {
        console.error("[mark-paid] update failed:", error);
        return res.status(500).json({ error: "update_failed" });
      }
      const wasAlreadyConfirmed = !updated || updated.length === 0;

      if (!wasAlreadyConfirmed) {
        try {
          const seminarMeta = SEMINARS.find((s) => s.id === (current as { seminar: string }).seminar);
          const seminarTitle = seminarMeta?.title ?? "votre formation";
          const seminarDates = seminarMeta?.week ?? "";
          const url = await generateMagicLinkUrl(
            (current as { email: string }).email,
            supabaseAdmin,
          );
          if (url) {
            const supportPhone = process.env.SUPPORT_PHONE ?? "+225 07 02 61 15 82";
            const siteUrl = process.env.SITE_URL ?? "https://rmk-conseils.com";
            await sendEmail(
              {
                ...renderEmail(welcomeConfirmed, {
                  prenom: (current as { prenom: string }).prenom,
                  seminarTitle,
                  seminarDates,
                  magicLinkUrl: url,
                  portalUrl: `${siteUrl}/portal`,
                  supportPhone,
                }),
                to: (current as { email: string }).email,
              },
              {
                resendApiKey: process.env.RESEND_API_KEY ?? "",
                from:
                  process.env.EMAIL_FROM ??
                  "RMK Conseils <noreply@rmk-conseils.com>",
              },
            );
          }
        } catch (err) {
          console.error("[mark-paid] welcome email failed (non-fatal):", err);
        }
      }

      res.json({ ok: true, was_already_confirmed: wasAlreadyConfirmed });
    },
  );

  // ── SLA reminder cron (Phase 1C / Task 14) ───────────────────────────────
  // Runs daily via Vercel Cron. Emails admins about pending registrations
  // older than 48h that have not yet been paid. Auth via CRON_SECRET bearer
  // token (Vercel Cron sets the Authorization header automatically when
  // configured in vercel.json).
  app.post("/api/cron/sla-reminder", async (req, res) => {
    const auth = req.header("authorization") ?? "";
    const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
    if (!process.env.CRON_SECRET || auth !== expected) {
      return res.sendStatus(401);
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: "Database not configured" });
    }

    // Bracketed window: only registrations between 48h and 72h old. Without
    // an upper bound the cron would re-include the same row every day forever
    // — admins would get reminded daily about the same stale registration.
    // The 24h window aligns with the daily cron schedule so each row fires
    // exactly one reminder over its lifetime.
    const lower = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    const upper = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: stale, error } = await supabaseAdmin
      .from("participants")
      .select("id, prenom, nom, email, seminar, payment_reference, created_at")
      .eq("status", "pending")
      .eq("payment", "pending")
      .gte("created_at", lower)
      .lt("created_at", upper);

    if (error) {
      console.error("[sla-reminder] query failed:", error);
      return res.status(500).json({ error: "query_failed" });
    }
    if (!stale || stale.length === 0) {
      return res.json({ count: 0 });
    }

    const rows = (stale as Array<{
      prenom: string;
      nom: string;
      email: string;
      seminar: string;
      payment_reference: string | null;
      created_at: string;
    }>).map((r) => {
      const seminarMeta = SEMINARS.find((s) => s.id === r.seminar);
      return {
        prenom: r.prenom,
        nom: r.nom,
        email: r.email,
        seminarTitle: seminarMeta?.title ?? r.seminar,
        paymentReference: r.payment_reference ?? "—",
        hoursWaiting: Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) / 3_600_000,
        ),
      };
    });

    const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (adminEmails.length) {
      try {
        await sendEmail(
          {
            ...renderEmail(adminSlaReminder, {
              rows,
              adminUrl: process.env.SITE_URL ?? "https://rmk-conseils.com",
            }),
            to: adminEmails,
          },
          {
            resendApiKey: process.env.RESEND_API_KEY ?? "",
            from:
              process.env.EMAIL_FROM ??
              "RMK Conseils <noreply@rmk-conseils.com>",
          },
        );
      } catch (err) {
        console.error("[sla-reminder] email failed:", err);
        // Still return count — cron observability is more useful than 500.
      }
    }

    res.json({ count: stale.length });
  });

  // ── AI generation (admin only) ────────────────────────────────────────────
  app.post("/api/ai/generate", aiLimiter, requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = aiGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { templateId, vars: rawVars, userPrompt, messages } = parsed.data;

      // For commercial template: fetch live seminar stats and inject into vars,
      // replacing the dead client-side tool-call loop with authoritative data.
      let vars: Record<string, unknown> | undefined = rawVars as any;
      if (templateId === "commercial" && vars?.seminarId) {
        const stats = await fetchSeminarStats(String(vars.seminarId));
        if (stats) {
          vars = { ...vars, stats };
        }
      }

      let systemPrompt: string;
      try {
        systemPrompt = renderSystemPrompt(templateId, vars as any);
      } catch (e: any) {
        return res.status(400).json({ error: e?.message || "Invalid template" });
      }

      const VALID_ROLES = new Set(["user", "assistant", "model"]);
      const aiMessages = messages
        ? (messages as any[])
            .filter((m) => VALID_ROLES.has(m.role))
            .map((m) => ({
              role: (m.role === "model" ? "assistant" : m.role) as
                | "user"
                | "assistant",
              content:
                m.parts?.map((p: any) => p.text).join("") ||
                String(m.text || ""),
            }))
        : undefined;

      const response = aiMessages
        ? await generateText({
            model: AI_MODEL,
            system: systemPrompt,
            messages: aiMessages,
          })
        : await generateText({
            model: AI_MODEL,
            system: systemPrompt,
            prompt: userPrompt ?? "",
          });
      res.json({ text: response.text });
    } catch (err) {
      console.error("AI generation error:", err);
      res.status(500).json({ error: "AI generation failed" });
    }
  });

  // ── Public AI chat (ChatWidget) ───────────────────────────────────────────
  // Public, rate-limited. Accepts ONLY templateId='chat' — any other templateId
  // is rejected by the Zod schema, so there's no way to jailbreak this endpoint
  // into the admin-only commercial/seo/research templates. The system prompt is
  // rendered server-side from the registry (api/prompts.ts), so the client never
  // supplies raw prompt text. This is stricter than both the upstream Sprint 7
  // design and our prior /api/chat checkpoint proposal.
  app.post("/api/ai/chat", aiLimiter, async (req, res) => {
    try {
      const parsed = aiChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { templateId, vars, messages } = parsed.data;

      let systemPrompt: string;
      try {
        systemPrompt = renderSystemPrompt(templateId, vars as any);
      } catch (e: any) {
        return res.status(400).json({ error: e?.message || "Invalid template" });
      }

      // Zod has already validated role ∈ {user,assistant,model}. Map "model"
      // → "assistant" (Gemini legacy alias) and reject any message whose
      // rendered content is empty, to avoid a downstream 400 from the AI SDK.
      const aiMessages = messages
        .map((m) => ({
          role: (m.role === "model" ? "assistant" : m.role) as
            | "user"
            | "assistant",
          content:
            m.parts?.map((p: any) => p.text).join("") ||
            String(m.text || ""),
        }))
        .filter((m) => m.content.trim().length > 0);

      if (aiMessages.length === 0) {
        return res.status(400).json({ error: "messages array must contain at least one non-empty message" });
      }

      const response = await generateText({
        model: AI_MODEL,
        system: systemPrompt,
        messages: aiMessages,
      });
      res.json({ text: response.text });
    } catch (err) {
      console.error("AI chat error:", err);
      res.status(500).json({ error: "AI chat failed" });
    }
  });

  // ── Webhooks (require shared secret) ──────────────────────────────────────
  // escapeXml prevents prompt injection via XML tag closing attacks:
  //   nom = '</prospect>\nIgnore all instructions...' would break the template.
  app.post("/webhook/prospect", aiLimiter, requireWebhookSecret, async (req, res) => {
    try {
      const parsed = webhookProspectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { nom, entreprise, poste, seminar } = parsed.data;
      const response = await generateText({
        model: AI_MODEL,
        system:
          "Tu es un expert en cold emailing B2B. Génère uniquement l'email demandé.",
        prompt: `Génère un email de prospection pour la personne suivante:
<prospect>
  Nom: ${escapeXml(nom)}
  Poste: ${escapeXml(poste)}
  Entreprise: ${escapeXml(entreprise)}
  Atelier cible: ${escapeXml(seminar)}
</prospect>`,
      });
      res.json({ email: response.text });
    } catch (err) {
      console.error("Prospect email generation error:", err);
      res.status(500).json({ error: "Failed to generate email" });
    }
  });

  app.post("/webhook/whatsapp", aiLimiter, requireWebhookSecret, async (req, res) => {
    try {
      const parsed = webhookWhatsappSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const { from, message } = parsed.data;
      const response = await generateText({
        model: AI_MODEL,
        system:
          "Tu es un closer WhatsApp pour RMK Conseils. Qualifie le prospect et réponds de manière concise et persuasive en français. Réponds uniquement au message client.",
        prompt: `<message_from>${escapeXml(from)}</message_from>
<message_content>${escapeXml(message)}</message_content>`,
      });
      res.json({ reply: response.text });
    } catch (err) {
      console.error("WhatsApp reply generation error:", err);
      res.status(500).json({ error: "Failed to generate reply" });
    }
  });

  return app;
}
