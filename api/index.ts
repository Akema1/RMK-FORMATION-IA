/**
 * Vercel Serverless Function — Express API handler.
 * All route logic lives in `api/app.ts`; this file is just the prod entry
 * point and startup guard.
 */
import { createApp } from "./_app.js";

// ── Startup guard: fail loudly on missing critical secrets ───────────────────
if (
  !process.env.VITE_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY ||
  !process.env.VITE_SUPABASE_ANON_KEY
) {
  throw new Error(
    "Missing required env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY"
  );
}

const app = createApp({
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
  appUrl: process.env.APP_URL,
  gracefulDegradation: false,
});

export default app;
