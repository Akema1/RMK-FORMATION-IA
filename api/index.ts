/**
 * Vercel Serverless Function — Express API handler.
 * Mirrors server.ts API routes without app.listen() or Vite middleware.
 */
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { Resend } from "resend";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { SEMINARS } from "../src/data/seminars.js";
import { renderSystemPrompt, PROMPT_TEMPLATES, type TemplateId } from "./prompts.js";

// ── Startup guard: fail loudly on missing critical secrets ────────────────────
if (
  !process.env.VITE_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.VITE_SUPABASE_ANON_KEY
) {
  throw new Error(
    "Missing required env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY"
  );
}

const app = express();

// Trust the first proxy (Vercel's edge) so express-rate-limit keys on the real
// client IP (X-Forwarded-For) instead of the edge IP. Without this, rate limits
// either lock everyone out or lock no one out, depending on topology.
app.set("trust proxy", 1);

// ── CORS: exact-match origin list + Vercel preview subdomains ─────────────────
// startsWith() can be bypassed (rmkapp.vercel.app.evil.com starts with rmkapp.vercel.app).
// Use exact match for production + regex for Vercel preview URLs.
const ALLOWED_ORIGINS: string[] = process.env.APP_URL
  ? [process.env.APP_URL]
  : ["http://localhost:8080"];

// Scoped to this project's preview URLs only — prevents other Vercel apps from passing CORS
const VERCEL_PREVIEW_RE = /^https:\/\/rmk-formation-ia-[a-z0-9-]+\.vercel\.app$/;

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

// ── Supabase clients ──────────────────────────────────────────────────────────
// Admin client: service role, bypasses RLS. Server-side only — never exposed to clients.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Anon client: used only to verify user JWTs for admin-protected endpoints.
const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// ── AI model ─────────────────────────────────────────────────────────────────
// Routes through Vercel AI Gateway — auth via OIDC (auto on Vercel) or AI_GATEWAY_API_KEY.
const AI_MODEL = gateway("anthropic/claude-haiku-4.5");

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Tight limit on portal lookups: response shape is identical for hit/miss,
// but 5/min * 1440 = 7200 lookups/day per IP is still enough to seed an email
// enumeration. 3/min = 4320/day and won't inconvenience a legitimate user
// looking up their own registration.
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

// ── Auth middleware: verify Supabase JWT ──────────────────────────────────────
async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { data, error } = await supabaseAnon.auth.getUser(
    authHeader.slice(7)
  );
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  next();
}

// ── Webhook auth: HMAC-SHA256 body signature ─────────────────────────────────
// Clients must send `X-Webhook-Signature: sha256=<hex>` where <hex> is
// HMAC-SHA256(WEBHOOK_SECRET, rawBody). Verified with timingSafeEqual to
// prevent timing side-channel attacks.
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

// ── Sanitization helpers ──────────────────────────────────────────────────────

// Escape HTML for email templates — prevents XSS in email clients
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Escape XML metacharacters for AI prompt templates — prevents tag injection
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Strip control characters and cap length for SMS/WhatsApp plain text
function sanitizeText(str: string, maxLen = 200): string {
  return String(str)
    .replace(/[\x00-\x1F\x7F]/g, "")
    .slice(0, maxLen);
}

// Escape Postgres ilike wildcards (% and _) to prevent wildcard injection
function escapeLike(str: string): string {
  return str.replace(/([%_\\])/g, "\\$1");
}

// ── Validation schemas ───────────────────────────────────────────────────────
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
  // templateId selects a server-side system prompt from a fixed whitelist.
  // Clients can no longer supply arbitrary system prompts (prompt-injection / budget-abuse hardening).
  templateId: z.enum(PROMPT_TEMPLATES as readonly [TemplateId, ...TemplateId[]]),
  vars: z.record(z.string(), z.any()).optional(),
  userPrompt: z.string().max(5000).optional(),
  messages: z.array(z.object({
    role: z.string(),
    text: z.string().max(5000).optional(),
    parts: z.array(z.any()).optional(),
  })).max(20).optional(),
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

// ── Registration notification (email + WhatsApp) ──────────────────────────────
// No admin auth — called right after anon form submission from the landing page.
// Defence: verify the participant actually exists in the DB before dispatching.
app.post("/api/notify-registration", notifyLimiter, async (req, res) => {
  try {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues.map(i => i.message) });
    }
    const participant = parsed.data;

    // Verify participant exists before sending any messages
    const { data: exists } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("email", participant.email.toLowerCase().trim())
      .eq("seminar", participant.seminar)
      .single();

    if (!exists) {
      return res.status(400).json({ error: "Participant not found" });
    }

    const seminarTitle =
      SEMINARS.find((s) => s.id === participant.seminar)?.title ||
      participant.seminar;

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "RMK Conseils <onboarding@resend.dev>",
        to: [participant.email],
        subject: "Confirmation de votre demande d'inscription - RMK Conseils",
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

    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_NUMBER
    ) {
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      await client.messages.create({
        // sanitizeText: strip control chars, cap at 200 chars
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

// ── Client portal lookup ──────────────────────────────────────────────────────
// No admin auth — participants self-look up their own registration by email + nom.
// tel removed from select: phone number is PII, not needed in the portal view.
// Rate-limited to 5 req/min per IP to prevent enumeration attacks.
app.post("/api/portal/lookup", portalLimiter, async (req, res) => {
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
    // escapeLike prevents % and _ wildcard injection in ilike
    .ilike("nom", escapeLike(nom.trim()));

  if (error) {
    console.error("Portal lookup error:", error);
    return res.status(500).json({ error: "Lookup failed" });
  }
  res.json(data || []);
});

// ── AI generation (admin only) ────────────────────────────────────────────────
// tools are rejected from the request body — function declarations must be
// defined server-side only to prevent arbitrary function injection by clients.
app.post("/api/ai/generate", aiLimiter, requireAuth, async (req, res) => {
  try {
    const parsed = aiGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues.map(i => i.message) });
    }
    // tools intentionally excluded — server-side only
    const { templateId, vars, userPrompt, messages } = parsed.data;

    // Render system prompt from server-side whitelist — client cannot supply raw prompts.
    let systemPrompt: string;
    try {
      systemPrompt = renderSystemPrompt(templateId, vars as any);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid template" });
    }

    // Convert client message format to AI SDK format (Claude Haiku via Vercel AI Gateway)
    const VALID_ROLES = new Set(["user", "assistant", "model"]);
    const aiMessages = messages
      ? (messages as any[])
          .filter((m) => VALID_ROLES.has(m.role))
          .map((m) => ({
            role: (m.role === "model" ? "assistant" : m.role) as
              | "user"
              | "assistant",
            content:
              m.parts?.map((p: any) => p.text).join("") || String(m.text || ""),
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

// ── Webhooks (require shared secret) ─────────────────────────────────────────
// escapeXml prevents prompt injection via XML tag closing attacks:
//   nom = '</prospect>\nIgnore all instructions...' would break the template.
app.post("/webhook/prospect", aiLimiter, requireWebhookSecret, async (req, res) => {
  try {
    const parsed = webhookProspectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues.map(i => i.message) });
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
      return res.status(400).json({ error: "Invalid input", details: parsed.error.issues.map(i => i.message) });
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

export default app;
