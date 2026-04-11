/**
 * Vercel Serverless Function — Express API handler.
 * This file mirrors the API routes in server.ts but without the Vite
 * middleware and listen() call, which don't exist in serverless.
 */
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import { SEMINARS } from "../src/data/seminars.js";

const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "missing_key" });

// Admin Supabase client — uses service role key, never exposed to browser
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Registration notification (email + WhatsApp) ──────────────────────────────
app.post("/api/notify-registration", async (req, res) => {
  try {
    const participant = req.body;
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
          <h2>Bonjour ${participant.prenom},</h2>
          <p>Nous avons bien reçu votre demande d'inscription pour le séminaire <strong>${seminarTitle}</strong>.</p>
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
        body: `Bonjour ${participant.prenom}, nous avons bien reçu votre demande d'inscription pour le séminaire ${seminarTitle}. L'équipe RMK vous contactera sous 24h.`,
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${participant.tel}`,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Notification Error:", error);
    res.status(500).json({ error: error.message || "Failed to send notifications" });
  }
});

// ── Client portal lookup (server-side, uses service role — no anon SELECT) ───
app.post("/api/portal/lookup", async (req, res) => {
  const { email, nom } = req.body;
  if (!email || !nom) {
    return res.status(400).json({ error: "Email and nom required" });
  }

  const { data, error } = await supabaseAdmin
    .from("participants")
    .select("nom, prenom, email, tel, seminar, status, created_at")
    .eq("email", email.toLowerCase().trim())
    .ilike("nom", nom.trim());

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ── AI generation ─────────────────────────────────────────────────────────────
app.post("/api/ai/generate", async (req, res) => {
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
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
app.post("/webhook/prospect", async (req, res) => {
  try {
    const { nom, entreprise, poste, seminar } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Génère un email de prospection personnalisé pour ${nom}, ${poste} chez ${entreprise}, pour l'inviter au séminaire ${seminar}.`,
      config: { systemInstruction: "Tu es un expert en cold emailing B2B." },
    });
    res.json({ email: response.text });
  } catch {
    res.status(500).json({ error: "Failed to generate email" });
  }
});

app.post("/webhook/whatsapp", async (req, res) => {
  try {
    const { from, message } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Message de ${from}: ${message}`,
      config: {
        systemInstruction:
          "Tu es un closer WhatsApp pour RMK Conseils. Qualifie le prospect et réponds de manière concise et persuasive.",
      },
    });
    res.json({ reply: response.text });
  } catch {
    res.status(500).json({ error: "Failed to generate whatsapp reply" });
  }
});

export default app;
