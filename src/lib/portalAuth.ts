export type SendMagicLinkResult =
  | { ok: true }
  | { ok: false; reason: "invalid_email" | "rate_limited" | "network" };

export async function sendPortalMagicLink(
  rawEmail: string,
): Promise<SendMagicLinkResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { ok: false, reason: "invalid_email" };

  let res: Response;
  try {
    res = await fetch("/api/auth/send-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  if (res.status === 200) return { ok: true };
  if (res.status === 400) return { ok: false, reason: "invalid_email" };
  if (res.status === 429) return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "network" };
}
