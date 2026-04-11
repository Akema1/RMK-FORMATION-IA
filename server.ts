/**
 * Local development server — Express + Vite middleware.
 * Mirrors api/index.ts routes with app.listen() and Vite dev middleware.
 */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import cron from "node-cron";
import path from "path";
import { Resend } from "resend";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import rateLimit from "express-rate-limit";
import { SEMINARS } from "./src/data/seminars.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 8080;

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: process.env.APP_URL || "http://localhost:8080",
      methods: ["GET", "POST"],
    })
  );
  app.use(express.json());

  // ── Supabase clients ────────────────────────────────────────────────────────
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.warn(
      "⚠️  Missing Supabase env vars. DB features will not work."
    );
  }

  const supabaseAdmin =
    supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;

  const supabaseAnon =
    supabaseUrl && supabaseAnonKey
      ? createClient(supabaseUrl, supabaseAnonKey)
      : null;

  // ── AI model ──────────────────────────────────────────────────────────────
  // Routes through Vercel AI Gateway — auth via OIDC or AI_GATEWAY_API_KEY.
  // For local dev: run `vercel env pull .env.local` or set AI_GATEWAY_API_KEY.
  const AI_MODEL = gateway("anthropic/claude-haiku-4.5");

  // ── Rate limiters ─────────────────────────────────────────────────────────
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

  // ── Auth middleware: verify Supabase JWT ───────────────────────────────────
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
    const { data, error } = await supabaseAnon.auth.getUser(
      authHeader.slice(7)
    );
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    next();
  }

  // ── Webhook auth: shared secret header ────────────────────────────────────
  function requireWebhookSecret(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Webhook not configured" });
    }
    if (req.headers["x-webhook-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }

  // ── Sanitization helpers ──────────────────────────────────────────────────
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

  // ── Registration notification ─────────────────────────────────────────────
  app.post("/api/notify-registration", notifyLimiter, async (req, res) => {
    try {
      const participant = req.body;
      if (!participant?.email || !participant?.seminar) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Verify participant exists before sending any messages
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
    const { email, nom } = req.body;
    if (
      !email ||
      !nom ||
      typeof email !== "string" ||
      typeof nom !== "string"
    ) {
      return res.status(400).json({ error: "Email and nom required" });
    }

    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("nom, prenom, email, seminar, status, created_at")
      .eq("email", email.toLowerCase().trim())
      .ilike("nom", escapeLike(nom.trim()));

    if (error) {
      console.error("Portal lookup error:", error);
      return res.status(500).json({ error: "Lookup failed" });
    }
    res.json(data || []);
  });

  // ── AI generation (admin only) ────────────────────────────────────────────
  app.post("/api/ai/generate", aiLimiter, requireAuth, async (req, res) => {
    try {
      const { systemPrompt, userPrompt, messages } = req.body;

      // Convert Gemini message format ({role, parts:[{text}]}) to AI SDK format
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

      const response = await generateText({
        model: AI_MODEL,
        system: systemPrompt,
        ...(aiMessages ? { messages: aiMessages } : { prompt: userPrompt }),
      });
      res.json({ text: response.text });
    } catch (err) {
      console.error("AI generation error:", err);
      res.status(500).json({ error: "AI generation failed" });
    }
  });

  // ── Webhooks (require shared secret) ──────────────────────────────────────
  app.post(
    "/webhook/prospect",
    aiLimiter,
    requireWebhookSecret,
    async (req, res) => {
      try {
        const { nom, entreprise, poste, seminar } = req.body;
        if (!nom || !entreprise || !poste || !seminar) {
          return res.status(400).json({ error: "Missing required fields" });
        }
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
    }
  );

  app.post(
    "/webhook/whatsapp",
    aiLimiter,
    requireWebhookSecret,
    async (req, res) => {
      try {
        const { from, message } = req.body;
        if (!from || !message) {
          return res.status(400).json({ error: "Missing from or message" });
        }
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
    }
  );

  // ── CRON: LinkedIn post generation ────────────────────────────────────────
  cron.schedule("0 8 * * *", async () => {
    try {
      console.log("Running LinkedIn CRON job at 08:00");
      const response = await generateText({
        model: AI_MODEL,
        system: "Tu es un community manager expert B2B sur LinkedIn.",
        prompt:
          "Génère un post LinkedIn expert sur l'IA avec hashtags, hook, et CTA vers les formations RMK Conseils.",
      });
      console.log("Generated LinkedIn Post:\n", response.text);
    } catch (error) {
      console.error("CRON Error:", error);
    }
  });

  // ── Vite middleware (dev) or static files (prod) ──────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
