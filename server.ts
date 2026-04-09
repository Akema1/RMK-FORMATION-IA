import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cron from "node-cron";
import path from "path";
import { Resend } from 'resend';
import twilio from 'twilio';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const ai = new GoogleGenAI({ apiKey: "dummy_key_that_is_long_enough_to_pass_validation_1234567890" });

  app.post('/api/notify-registration', async (req, res) => {
    try {
      const participant = req.body;
      
      // Send Email via Resend
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'RMK Conseils <onboarding@resend.dev>', // Use onboarding email for testing
          to: [participant.email],
          subject: 'Confirmation de votre demande d\'inscription - RMK Conseils',
          html: `
            <h2>Bonjour ${participant.prenom},</h2>
            <p>Nous avons bien reçu votre demande d'inscription pour le séminaire <strong>${participant.seminar}</strong>.</p>
            <p>L'équipe RMK vous contactera sous 24h pour confirmer votre inscription et les modalités de paiement.</p>
            <br/>
            <p>Cordialement,</p>
            <p>L'équipe RMK Conseils</p>
          `
        });
      }

      // Send WhatsApp via Twilio
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER) {
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
      res.status(500).json({ error: error.message || "Failed to send notifications" });
    }
  });

  app.get('/api/debug/env', (req, res) => {
    res.json({ 
      keys: Object.keys(process.env),
      keyValue: process.env.GEMINI_API_KEY,
      nextKeyValue: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
      appUrl: process.env.APP_URL
    });
  });

  // PROBLÈME 1 : SÉCURITÉ — Clé API exposée côté client
  app.post('/api/ai/generate', async (req, res) => {
    try {
      const { systemPrompt, userPrompt, messages, tools } = req.body;
      
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
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // FONCTIONNALITÉ 14 : BACKEND AUTOMATISATION (3 WEBHOOKS)
  // Route 1 : Cold Emailing
  app.post('/webhook/prospect', async (req, res) => {
    try {
      const { nom, entreprise, poste, seminar } = req.body;
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

  // Route 2 : Closer WhatsApp
  app.post('/webhook/whatsapp', async (req, res) => {
    try {
      const { from, message } = req.body;
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

  // Route 3 : CRON LinkedIn
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log("Running LinkedIn CRON job at 08:00");
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Génère un post LinkedIn expert sur l'IA avec hashtags, hook, et CTA vers les formations RMK Conseils.",
        config: { systemInstruction: "Tu es un community manager expert B2B sur LinkedIn." }
      });
      console.log("Generated LinkedIn Post:\n", response.text);
      // Here you would typically post to LinkedIn API
    } catch (error) {
      console.error("CRON Error:", error);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
