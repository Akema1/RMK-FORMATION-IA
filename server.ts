import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cron from "node-cron";
import path from "path";
import { Resend } from 'resend';
import twilio from 'twilio';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// ─── HTML SANITIZATION ───
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── ZOD SCHEMAS ───
const registrationSchema = z.object({
  nom: z.string().min(1).max(200),
  prenom: z.string().min(1).max(200),
  email: z.string().email().max(320),
  tel: z.string().max(30).optional().default(''),
  societe: z.string().min(1).max(300),
  fonction: z.string().min(1).max(200),
  seminar: z.string().min(1).max(50),
  amount: z.number().int().min(0).optional(),
  status: z.string().max(50).optional(),
  payment: z.string().max(200).optional(),
  notes: z.string().max(2000).optional().default(''),
});

const aiGenerateSchema = z.object({
  systemPrompt: z.string().max(10000).optional(),
  userPrompt: z.string().max(10000).optional(),
  messages: z.array(z.any()).optional(),
  tools: z.array(z.any()).optional(),
});

const prospectSchema = z.object({
  nom: z.string().min(1).max(200),
  entreprise: z.string().min(1).max(300),
  poste: z.string().min(1).max(200),
  seminar: z.string().min(1).max(50),
});

const whatsappSchema = z.object({
  from: z.string().min(1).max(50),
  message: z.string().min(1).max(5000),
});

// ─── AUTH MIDDLEWARE ───
function requireAuth(supabaseUrl: string, supabaseKey: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = user;
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = 8080;

  // ─── CORS ───
  app.use(cors({
    origin: process.env.APP_URL || 'http://localhost:8080',
    methods: ['GET', 'POST'],
  }));
  app.use(express.json({ limit: '1mb' }));

  // ─── RATE LIMITING ───
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', globalLimiter);
  app.use('/webhook/', globalLimiter);

  // Stricter limit for registration to prevent spam
  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many registration attempts, please try again later.' },
  });

  // ─── HEALTH CHECK ───
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ─── GEMINI AI ───
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.warn('GEMINI_API_KEY is not set. AI features will not work.');
  }
  const ai = new GoogleGenAI({ apiKey: geminiApiKey || 'missing_key' });

  // ─── AUTH SETUP ───
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const authMiddleware = requireAuth(supabaseUrl, supabaseKey);

  // ─── PUBLIC: REGISTRATION NOTIFICATION ───
  app.post('/api/notify-registration', registrationLimiter, async (req, res) => {
    try {
      const parsed = registrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid registration data', details: parsed.error.flatten() });
      }
      const participant = parsed.data;

      // Send Email via Resend
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'RMK Conseils <onboarding@resend.dev>',
          to: [participant.email],
          subject: "Confirmation de votre demande d'inscription - RMK Conseils",
          html: `
            <h2>Bonjour ${escapeHtml(participant.prenom)},</h2>
            <p>Nous avons bien reçu votre demande d'inscription pour le séminaire <strong>${escapeHtml(participant.seminar)}</strong>.</p>
            <p>L'équipe RMK vous contactera sous 24h pour confirmer votre inscription et les modalités de paiement.</p>
            <br/>
            <p>Cordialement,</p>
            <p>L'équipe RMK Conseils</p>
          `
        });
      }

      // Send WhatsApp via Twilio
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER && participant.tel) {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `Bonjour ${participant.prenom}, nous avons bien reçu votre demande d'inscription pour le séminaire ${participant.seminar}. L'équipe RMK vous contactera sous 24h.`,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${participant.tel}`
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Notification Error:", error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  // ─── PROTECTED: AI GENERATE (admin only) ───
  app.post('/api/ai/generate', authMiddleware, async (req, res) => {
    try {
      const parsed = aiGenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid request data', details: parsed.error.flatten() });
      }
      const { systemPrompt, messages, userPrompt, tools } = parsed.data;

      const contents = messages || userPrompt;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          tools: tools ? [{ functionDeclarations: tools }] : undefined
        }
      });

      res.json({ text: response.text, functionCalls: response.functionCalls });
    } catch (error: any) {
      console.error("AI Generate Error:", error.message || error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  // ─── PROTECTED: COLD EMAIL WEBHOOK ───
  app.post('/webhook/prospect', authMiddleware, async (req, res) => {
    try {
      const parsed = prospectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid prospect data', details: parsed.error.flatten() });
      }
      const { nom, entreprise, poste, seminar } = parsed.data;
      const prompt = `Génère un email de prospection personnalisé pour ${nom}, ${poste} chez ${entreprise}, pour l'inviter au séminaire ${seminar}.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { systemInstruction: "Tu es un expert en cold emailing B2B." }
      });
      res.json({ email: response.text });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate email" });
    }
  });

  // ─── PROTECTED: WHATSAPP WEBHOOK ───
  app.post('/webhook/whatsapp', authMiddleware, async (req, res) => {
    try {
      const parsed = whatsappSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid message data', details: parsed.error.flatten() });
      }
      const { from, message } = parsed.data;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Message de ${from}: ${message}`,
        config: { systemInstruction: "Tu es un closer WhatsApp pour RMK Conseils. Qualifie le prospect et réponds de manière concise et persuasive." }
      });
      res.json({ reply: response.text });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate whatsapp reply" });
    }
  });

  // ─── CRON: LINKEDIN POST ───
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log("Running LinkedIn CRON job at 08:00");
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Génère un post LinkedIn expert sur l'IA avec hashtags, hook, et CTA vers les formations RMK Conseils.",
        config: { systemInstruction: "Tu es un community manager expert B2B sur LinkedIn." }
      });
      console.log("Generated LinkedIn Post:\n", response.text);
    } catch (error) {
      console.error("CRON Error:", error);
    }
  });

  // ─── VITE / STATIC ───
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
