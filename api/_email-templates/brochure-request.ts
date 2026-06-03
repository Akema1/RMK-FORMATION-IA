import type { EmailTemplate } from "../_lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface BrochureRequestProps {
  prenom: string;
  brochureUrl: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
}

export const brochureRequest: EmailTemplate<BrochureRequestProps> = {
  subject: () =>
    "Votre brochure — Séminaires IA RMK × CABEXIA",

  text: (p) => `${p.prenom ? `Bonjour ${p.prenom},` : "Bonjour,"}

Merci pour votre intérêt. Vous trouverez la brochure complète du
programme à cette adresse :

${p.brochureUrl}

En bref :
- À Abidjan, en juillet et septembre 2026
- Format hybride : 3 jours en présentiel + sessions en ligne
- Organisé par CABEXIA × RMK Conseils

Quatre parcours sur quatre semaines, choisissez celui qui vous correspond :
- Dirigeants & Managers · 07 – 11 juillet 2026
- Finance & Institutions financières · 14 – 18 juillet 2026
- Notaires & Professions juridiques · 8 – 11 septembre 2026
- Ressources Humaines · 15 – 18 septembre 2026

Prêt à réserver votre place ? Répondez simplement à cet email avec
le parcours qui vous intéresse. Notre équipe vous recontacte sous
24h pour finaliser les modalités (paiement, logistique, attestation).

Cordialement,
L'équipe CABEXIA × RMK Conseils

Web : ${p.websiteUrl}
Email : ${p.contactEmail}
Tél : ${p.contactPhone}`,

  html: (p) => `
<p>${p.prenom ? `Bonjour <strong>${escapeHtml(p.prenom)}</strong>,` : "Bonjour,"}</p>
<p>Merci pour votre intérêt. Vous trouverez la brochure complète du programme en téléchargement ci-dessous.</p>

<p style="text-align:center;margin:24px 0;">
  <a href="${escapeHtml(p.brochureUrl)}" style="display:inline-block;background:#C9A84C;color:#1B2A4A;
     text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:700;font-size:15px;">
    Télécharger la brochure (PDF)
  </a>
</p>

<p style="margin-top:24px;"><strong>En bref :</strong></p>
<ul style="padding-left:20px;margin:8px 0 16px;">
  <li>À <strong>Abidjan</strong>, en juillet et septembre 2026</li>
  <li>Format <strong>hybride</strong> : 3 jours en présentiel + sessions en ligne</li>
  <li>Organisé par <strong>CABEXIA × RMK Conseils</strong></li>
</ul>

<p><strong>Quatre parcours sur quatre semaines, choisissez celui qui vous correspond :</strong></p>
<ul style="padding-left:20px;margin:8px 0 16px;">
  <li>Dirigeants &amp; Managers · <em>07 – 11 juillet 2026</em></li>
  <li>Finance &amp; Institutions financières · <em>14 – 18 juillet 2026</em></li>
  <li>Notaires &amp; Professions juridiques · <em>8 – 11 septembre 2026</em></li>
  <li>Ressources Humaines · <em>15 – 18 septembre 2026</em></li>
</ul>

<p style="background:#F5F1E4;border-left:3px solid #C9A84C;padding:14px 18px;margin:20px 0;color:#1B2A4A;">
  <strong>Prêt à réserver votre place ?</strong> Répondez simplement à cet email avec
  le parcours qui vous intéresse. Notre équipe vous recontacte sous 24h pour finaliser
  les modalités (paiement, logistique, attestation).
</p>

<p style="margin-top:28px;">Cordialement,<br>
<em>L'équipe CABEXIA × RMK Conseils</em></p>
`,
};
