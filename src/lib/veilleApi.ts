import { supabase } from './supabaseClient';

/**
 * Veille IA data layer (Slice 1).
 *
 * Reads go DIRECTLY through the anon Supabase client — the same pattern the
 * landing page uses for `seminars`. RLS on `veille_articles` restricts anon to
 * `status = 'published'`, so drafts are never returned even though we also pass
 * an explicit `.eq('status','published')` filter (defense in depth).
 *
 * Writes go through service-role API endpoints, because anon RLS inserts are
 * deliberately blocked across this project:
 *  - subscribe  -> POST /api/veille/subscribe
 *  - diagnostic -> POST /api/lead/capture (reused, tagged source='veille-...')
 */

export interface VeilleFormationLink {
  label: string;
  url: string;
}

export interface VeilleArticle {
  id: string;
  slug: string;
  title_fr: string;
  summary_fr: string;
  /** Per-sector "so what", e.g. { banque: "...", agro: "..." } */
  so_what: Record<string, string>;
  primary_sector: string;
  sectors: string[];
  source_url: string;
  source_name: string | null;
  image_url: string | null;
  formation_links: VeilleFormationLink[];
  published_at: string | null;
  created_at: string;
}

const ARTICLE_FIELDS =
  'id, slug, title_fr, summary_fr, so_what, primary_sector, sectors, source_url, source_name, image_url, formation_links, published_at, created_at';

export async function fetchPublishedArticles(
  sector?: string
): Promise<{ data: VeilleArticle[]; error?: string }> {
  let query = supabase
    .from('veille_articles')
    .select(ARTICLE_FIELDS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);
  if (sector) query = query.eq('primary_sector', sector);

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as VeilleArticle[] };
}

export async function fetchArticleBySlug(
  slug: string
): Promise<{ data: VeilleArticle | null; error?: string }> {
  const { data, error } = await supabase
    .from('veille_articles')
    .select(ARTICLE_FIELDS)
    .eq('status', 'published')
    .eq('slug', slug)
    .limit(1);
  if (error) return { data: null, error: error.message };
  return { data: (data?.[0] ?? null) as VeilleArticle | null };
}

export interface SubscribeInput {
  email: string;
  role?: string;
  sectors?: string[];
  source_utm?: string;
}

export async function subscribeToVeille(
  input: SubscribeInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/veille/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export interface DiagnosticInput {
  nom: string;
  contact: string;
  entreprise?: string;
  notes?: string;
}

/** Reuses the existing /api/lead/capture endpoint with a veille-specific source. */
export async function bookDiagnostic(
  input: DiagnosticInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/lead/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, source: 'veille-diagnostic-banque' }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
