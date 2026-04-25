import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateMagicLinkUrl(
  email: string,
  supabaseAdmin: SupabaseClient,
  redirectTo: string = `${process.env.SITE_URL ?? "https://rmkconseils.com"}/portal`,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error || !data?.properties?.action_link) return null;
  return data.properties.action_link;
}
