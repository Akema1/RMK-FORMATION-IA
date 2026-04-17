import { supabase } from './supabaseClient';

/**
 * POST /api/ai/coaching — authenticated AI coaching for confirmed participants.
 *
 * Sends { seminar, userPrompt } with the Supabase session bearer token.
 * The server derives participant identity from the session and injects
 * seminar-specific context into the AI prompt.
 */
export async function requestCoaching(input: {
  seminar: string;
  userPrompt: string;
}): Promise<{ text?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: 'Session expirée. Veuillez vous reconnecter.' };
  }

  try {
    const res = await fetch('/api/ai/coaching', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        seminar: input.seminar,
        userPrompt: input.userPrompt,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error || `Erreur HTTP ${res.status}` };
    }

    const body = await res.json();
    return { text: body.text };
  } catch (err) {
    console.error('Coaching API error:', err);
    return { error: 'Impossible de contacter le service de coaching. Veuillez réessayer.' };
  }
}
