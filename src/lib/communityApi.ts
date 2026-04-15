import { supabase } from './supabaseClient';
import type { CommunityPost } from '../pages/portal/tokens';

/**
 * POST /api/community/post — authenticated community feed write.
 *
 * Only sends { text }. All identity fields (author, initials, participant_id)
 * and the seminar tag are derived server-side from the authenticated
 * participant's DB row — the client has no say in them. This prevents
 * identity spoofing and cross-feed posting even if the UI is compromised.
 *
 * Attaches the current Supabase session's bearer token so the server can
 * look up the participant by email. Returns { post } on success (matches
 * what the server returns so the caller can optimistically prepend it to
 * local state), or { error } on failure.
 */
export async function postCommunityPost(input: {
  text: string;
}): Promise<{ post?: CommunityPost; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: 'Not authenticated' };
  }

  try {
    const res = await fetch('/api/community/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ text: input.text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error || `HTTP ${res.status}` };
    }

    const body = await res.json();
    // Server returns snake_case seminar_tag; tokens.ts uses camelCase
    // seminarTag. Map here at the client boundary.
    const raw = body.post;
    const post: CommunityPost = {
      id: raw.id,
      author: raw.author,
      initials: raw.initials,
      date: raw.date,
      text: raw.text,
      seminarTag: raw.seminar_tag,
    };
    return { post };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' };
  }
}
