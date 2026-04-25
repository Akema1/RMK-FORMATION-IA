const NAVY = "#1B2A4A";
const GOLD = "#C9A84C";
const SURFACE = "#F7F4ED";
const TEXT = "#2A2A2A";

export function layout(opts: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};font-family:Helvetica,Arial,sans-serif;color:${TEXT};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE};padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e3d6;">
        <tr><td style="background:${NAVY};padding:24px 32px;color:#fff;font-size:18px;font-weight:bold;letter-spacing:2px;">
          R M K &nbsp; C O N S E I L S
        </td></tr>
        <tr><td style="padding:32px;line-height:1.6;font-size:15px;">
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="background:${NAVY};padding:20px 32px;color:#cbd0dc;font-size:12px;">
          RMK Conseils — Abidjan, Côte d'Ivoire<br>
          Contact : +225 07 02 61 15 82 (Appel/WhatsApp) —
          <a href="https://rmkconseils.com" style="color:${GOLD};text-decoration:none;">rmkconseils.com</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * HTML-escape user-provided strings before interpolating them into a template.
 *
 * IMPORTANT: every email template that interpolates props into HTML MUST
 * call this on every prop value. The renderer does NOT escape automatically
 * — we'd otherwise double-escape pre-rendered fragments (links with text,
 * formatted prices, etc.).
 *
 * The cost of forgetting: stored XSS in the email client. Most clients
 * sandbox JS but rendering-engine bugs and HTML-injected phishing still bite.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
