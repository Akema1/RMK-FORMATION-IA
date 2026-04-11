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
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const app = express();

// ── CORS: restrict to known deployment origins ────────────────────────────────
// Set APP_URL in Vercel env vars to your production domain once known.
const ALLOWED_ORIGINS = process.env.APP_URL
  ? [process.env.APP_URL]
  : ["http://localhost:8080"];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server calls (no origin) and known domains
      if (!origin || ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
  })
);
app.use(express.json());

// ── Admin Supabase client (service role — bypasses RLS, server-side only) ─────
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Anon client — used only to verify user JWTs ───────────────────────────────
const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// AI client — initialized lazily; routes that need it will check at call time
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

// ── Auth middleware: verify Supabase JWT for admin endpoints ──────────────────
async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  next();
}

// ── HTML escaping for email templates ─────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Registration notification (email + WhatsApp) ──────────────────────────────
app.post("/api/notify-registration", notifyLimiter, async (req, res) => {
  try {
    const participant = req.body;
    const seminarTitle =
      SEMINARS.find((s) => s.id === participant.seminar)?.title ||
      escapeHtml(participant.seminar);

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
      // WhatsApp is plain text — no HTML injection risk
      await client.messages.create({
        body: `Bonjour ${participant.prenom}, nous avons bien reçu votre demande d'inscription pour le séminaire ${seminarTitle}. L'équipe RMK vous contactera sous 24h.`,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${participant.tel}`,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Notification Error:", error);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// ── Client portal lookup ──────────────────────────────────────────────────────
// No admin auth — participants look up their own registrations by email + nom.
// Rate-limited to 5 req/min per IP to prevent enumeration.
app.post("/api/portal/lookup", portalLimiter, async (req, res) => {
  const { email, nom } = req.body;
  if (!email || !nom || typeof email !== "string" || typeof nom !== "string") {
    return res.status(400).json({ error: "Email and nom required" });
  }

  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("nom, prenom, email, tel, seminar, status, created_at")
    .eq("email", email.toLowerCase().trim())
    .ilike("nom", nom.trim());

  if (error) {
    console.error("Portal lookup error:", error);
    return res.status(500).json({ error: "Lookup failed" });
  }
  res.json(data || []);
});

// ── AI generation (admin only — requires valid Supabase session) ──────────────
app.post("/api/ai/generate", aiLimiter, requireAuth, async (req, res) => {
  if (!ai) return res.status(503).json({ error: "AI features not configured" });
  try {
    const { systemPrompt, userPrompt, messages, tools } = req.body;
    const contents = messages || userPrompt;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
      },
    });
    res.json({ text: response.text, functionCalls: response.functionCalls });
  } catch (error: any) {
    console.error("AI Generate Error:", error.message || error);
    res.status(500).json({ error: "AI generation failed" });
  }
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
// Wrap user content in XML delimiters to mitigate prompt injection.
app.post("/webhook/prospect", aiLimiter, async (req, res) => {
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
  Nom: ${nom}
  Poste: ${poste}
  Entreprise: ${entreprise}
  Séminaire cible: ${seminar}
</prospect>`,
      config: { systemInstruction: "Tu es un expert en cold emailing B2B. Génère uniquement l'email demandé." },
    });
    res.json({ email: response.text });
  } catch {
    res.status(500).json({ error: "Failed to generate email" });
  }
});

app.post("/webhook/whatsapp", aiLimiter, async (req, res) => {
  if (!ai) return res.status(503).json({ error: "AI features not configured" });
  try {
    const { from, message } = req.body;
    if (!from || !message) {
      return res.status(400).json({ error: "Missing from or message" });
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `<message_from>${from}</message_from>
<message_content>${message}</message_content>`,
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
