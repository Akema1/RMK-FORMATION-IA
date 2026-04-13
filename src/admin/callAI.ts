/**
 * Thin client for the hardened /api/ai/generate endpoint.
 *
 * Routes through the Vercel AI Gateway (Claude Haiku) — see api/app.ts and
 * api/prompts.ts. The server enforces:
 *   - requireAuth middleware (Supabase JWT)
 *   - aiLimiter rate limit
 *   - templateId-based system prompt rendering (no client-supplied prompts)
 *   - Zod input validation
 *
 * Replaces the prior upstream `callGemini` helper, which sent raw client
 * prompts and lacked an Authorization header — both rejected by main's
 * security hardening.
 */
import { supabase } from '../lib/supabaseClient';

export type TemplateId = 'seo' | 'commercial' | 'research';

export interface CallAIOptions {
  /** Free-form user prompt (max 5000 chars server-side). */
  userPrompt?: string;
  /**
   * Template-specific variables — server validates the shape per templateId.
   * For "commercial": `{ seminarId: string }`. For "seo"/"research": none.
   */
  vars?: Record<string, unknown>;
  /** Optional multi-turn message history (max 20 entries server-side). */
  messages?: Array<{ role: string; text?: string; parts?: unknown[] }>;
}

export interface CallAIResult {
  text: string;
}

/**
 * Call the AI Gateway endpoint with a whitelisted templateId.
 *
 * Throws on non-2xx responses or auth failure. Callers should display the
 * error message to the user and not retry blindly.
 */
export async function callAI(
  templateId: TemplateId,
  opts: CallAIOptions = {}
): Promise<CallAIResult> {
  // Attach the user's Supabase session JWT so the server's requireAuth
  // middleware accepts the request. Without this, every call would 401.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Session expirée. Veuillez vous reconnecter pour utiliser les agents IA.");
  }

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      templateId,
      vars: opts.vars,
      userPrompt: opts.userPrompt,
      messages: opts.messages,
    }),
  });

  // Detect HTML responses (e.g., dev server not started, vite serving the SPA shell).
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      "Le serveur backend ne semble pas actif. Lancez-le avec: npm run dev"
    );
  }

  const data = await response.json();
  if (!response.ok) {
    // Surface only the server-provided error string — never raw stack traces.
    const msg = typeof data?.error === 'string' ? data.error : `Erreur serveur (${response.status})`;
    throw new Error(msg);
  }

  return { text: String(data.text ?? '') };
}
