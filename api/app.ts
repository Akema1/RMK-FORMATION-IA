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
import { Resend } from "resend";
import twilio from "twilio";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { SEMINARS } from "../src/data/seminars.js";
import { renderSystemPrompt, PROMPT_TEMPLATES, type TemplateId } from "./prompts.js";

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
const VERCEL_PREVIEW_RE = /^https:\/\/rmk-formation-ia-[a-z0-9-]+\.vercel\.app$/;

// ── Sanitization helpers ────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

const registrationSchema = z.object({
  email: z.string().email().max(254),
  prenom: z.string().min(1).max(100),
  nom: z.string().min(1).max(100),
  tel: z.string().max(20).regex(/^\+?[\d\s()-]{6,20}$/, "Invalid phone format").optional(),
  societe: z.string().max(200).optional(),
  fonction: z.string().max(200).optional(),
  seminar: z.string().min(1).max(50),
  amount: z.number().int().min(0).optional(),
});

const portalLookupSchema = z.object({
  email: z.string().email().max(254),
  nom: z.string().min(1).max(100),
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
  const notifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many notification requests." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Separate bucket from notifyLimiter: public lead-capture surface shouldn't
  // starve the registration-notification budget on a shared limiter.
  const leadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: "Too many lead submissions. Try again in a minute." },
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

  // ── Registration notification (email + WhatsApp) ──────────────────────────
  app.post("/api/notify-registration", notifyLimiter, async (req, res) => {
    try {
      const parsed = registrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid input",
          details: parsed.error.issues.map((i) => i.message),
        });
      }
      const participant = parsed.data;

      if (supabaseAdmin) {
        const { data: exists } = await supabaseAdmin
          .from("participants")
          .select("id")
          .eq("email", participant.email.toLowerCase().trim())
          .eq("seminar", participant.seminar)
          .single();
        if (!exists) {
          return res.status(400).json({ error: "Participant not found" });
        }

        // Blocker #2a — auto-task creation. Moved from the anon client on
        // LandingPage to here so it survives the is_admin()-scoped RLS: the
        // service-role key bypasses RLS and anon inserts into `tasks` are
        // now blocked. Best-effort — a task insert failure must not roll
        // back the registration, which is already committed.
        try {
          const fullName = `${participant.prenom} ${participant.nom}`;
          await supabaseAdmin.from("tasks").insert([
            {
              task: `[Onboarding] Vérifier dossier & appeler ${fullName}`,
              owner: "alexis",
              priority: "high",
              seminar: participant.seminar,
              status: "todo",
            },
            {
              task: `[Finance] Confirmer paiement de ${fullName}`,
              owner: "alexis",
              priority: "medium",
              seminar: participant.seminar,
              status: "todo",
            },
          ]);
        } catch (taskErr) {
          console.error("Auto-task insert failed (non-fatal):", taskErr);
        }
      }

      const seminarTitle =
        SEMINARS.find((s) => s.id === participant.seminar)?.title ||
        participant.seminar;

      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "RMK Conseils <onboarding@resend.dev>",
          to: [participant.email],
          subject:
            "Confirmation de votre demande d'inscription - RMK Conseils",
          html: `
            <h2>Bonjour ${escapeHtml(participant.prenom)},</h2>
            <p>Nous avons bien reçu votre demande d'inscription pour le séminaire <strong>${escapeHtml(seminarTitle)}</strong>.</p>
            <p>L'équipe RMK vous contactera sous 24h pour confirmer votre inscription et les modalités de paiement.</p>
            <br/>
            <p>Cordialement,</p>
            <p>L'équipe RMK Conseils</p>
          `,
        });
      }

      // Skip WhatsApp send if participant did not provide a phone number —
      // otherwise we'd POST `whatsapp:undefined` to Twilio and get a 400.
      if (
        participant.tel &&
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_NUMBER
      ) {
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        await client.messages.create({
          body: `Bonjour ${sanitizeText(participant.prenom, 50)}, nous avons bien reçu votre demande d'inscription pour le séminaire ${sanitizeText(seminarTitle, 100)}. L'équipe RMK vous contactera sous 24h.`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${participant.tel}`,
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Notification error:", err);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

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
  Séminaire cible: ${escapeXml(seminar)}
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
