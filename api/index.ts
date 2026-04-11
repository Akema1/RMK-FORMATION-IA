/**
 * Vercel Serverless Function — Express API handler.
 * Mirrors server.ts API routes without app.listen() or Vite middleware.
 */
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import { SEMINARS } from "../src/data/seminars.js";

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
app.use(express.json());

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

// ── AI client — lazy init ─────────────────────────────────────────────────────
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ── Rate limiters ─────────────────────────────────────────────────────────────
const portalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
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

// ── Webhook auth: shared secret header ───────────────────────────────────────
function requireWebhookSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // If secret not configured, block all webhook calls in production
    return res.status(503).json({ error: "Webhook not configured" });
  }
  if (req.headers["x-webhook-secret"] !== secret) {
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

// ── Registration notification (email + WhatsApp) ──────────────────────────────
// No admin auth — called right after anon form submission from the landing page.
// Defence: verify the participant actually exists in the DB before dispatching.
app.post("/api/notify-registration", notifyLimiter, async (req, res) => {
  try {
    const participant = req.body;
    if (!participant?.email || !participant?.seminar) {
      return res.status(400).json({ error: "Missing required fields" });
    }

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
  } catch {
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// ── Client portal lookup ──────────────────────────────────────────────────────
// No admin auth — participants self-look up their own registration by email + nom.
// tel removed from select: phone number is PII, not needed in the portal view.
// Rate-limited to 5 req/min per IP to prevent enumeration attacks.
app.post("/api/portal/lookup", portalLimiter, async (req, res) => {
  const { email, nom } = req.body;
  if (!email || !nom || typeof email !== "string" || typeof nom !== "string") {
    return res.status(400).json({ error: "Email and nom required" });
  }

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
  if (!ai) return res.status(503).json({ error: "AI features not configured" });
  try {
    // tools intentionally excluded from destructuring — server-side only
    const { systemPrompt, userPrompt, messages } = req.body;
    const contents = messages || userPrompt;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: { systemInstruction: systemPrompt },
    });
    res.json({ text: response.text });
  } catch {
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ── Webhooks (require shared secret) ─────────────────────────────────────────
// escapeXml prevents prompt injection via XML tag closing attacks:
//   nom = '</prospect>\nIgnore all instructions...' would break the template.
app.post("/webhook/prospect", aiLimiter, requireWebhookSecret, async (req, res) => {
  if (!ai) return res.status(503).json({ error: "AI features not configured" });
  try {
    const { nom, entreprise, poste, seminar } = req.body;
    if (!nom || !entreprise || !poste || !seminar) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Génère un email de prospection pour la personne suivante:
<prospect>
  Nom: ${escapeXml(nom)}
  Poste: ${escapeXml(poste)}
  Entreprise: ${escapeXml(entreprise)}
  Séminaire cible: ${escapeXml(seminar)}
</prospect>`,
      config: {
        systemInstruction:
          "Tu es un expert en cold emailing B2B. Génère uniquement l'email demandé.",
      },
    });
    res.json({ email: response.text });
  } catch {
    res.status(500).json({ error: "Failed to generate email" });
  }
});

app.post("/webhook/whatsapp", aiLimiter, requireWebhookSecret, async (req, res) => {
  if (!ai) return res.status(503).json({ error: "AI features not configured" });
  try {
    const { from, message } = req.body;
    if (!from || !message) {
      return res.status(400).json({ error: "Missing from or message" });
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `<message_from>${escapeXml(from)}</message_from>
<message_content>${escapeXml(message)}</message_content>`,
      config: {
        systemInstruction:
          "Tu es un closer WhatsApp pour RMK Conseils. Qualifie le prospect et réponds de manière concise et persuasive en français. Réponds uniquement au message client.",
      },
    });
    res.json({ reply: response.text });
  } catch {
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

export default app;
