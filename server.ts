/**
 * Local development server — wraps the shared Express app from `api/app.ts`
 * with Vite middleware, an HTTP listener, and the LinkedIn cron job.
 *
 * All API route logic lives in `api/app.ts` — do not re-declare it here.
 */
import express from "express";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import cron from "node-cron";
import path from "path";
import { createApp } from "./api/app.js";

dotenv.config();

async function startServer() {
  const PORT = 8080;

  // Warn (don't throw) when Supabase env vars are missing so `npm run dev`
  // still boots for frontend-only work.
  if (
    !process.env.VITE_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.VITE_SUPABASE_ANON_KEY
  ) {
    console.warn(
      "⚠️  Missing Supabase env vars. DB-backed features will return 503."
    );
  }

  const app = createApp({
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
    appUrl: process.env.APP_URL,
    gracefulDegradation: true,
  });

  // ── CRON: LinkedIn post generation (dev-only — Vercel runs it via cron entry) ──
  cron.schedule("0 8 * * *", async () => {
    try {
      console.log("Running LinkedIn CRON job at 08:00");
      const response = await generateText({
        model: gateway("anthropic/claude-haiku-4.5"),
        system: "Tu es un community manager expert B2B sur LinkedIn.",
        prompt:
          "Génère un post LinkedIn expert sur l'IA avec hashtags, hook, et CTA vers les formations RMK Conseils.",
      });
      console.log("Generated LinkedIn Post:\n", response.text);
    } catch (error) {
      console.error("CRON Error:", error);
    }
  });

  // ── Vite middleware (dev) or static files (prod-style local) ──────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
