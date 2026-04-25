import type { EmailTemplate } from "../_lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface MagicLinkProps {
  prenom: string;
  seminarTitle: string;
  magicLinkUrl: string;
  supportPhone: string;
}

export const magicLink: EmailTemplate<MagicLinkProps> = {
  subject: () => "Votre lien d'accès à l'espace participant — RMK Conseils",

  text: (p) => `Bonjour ${p.prenom},

Voici votre lien d'accès sécurisé à votre espace participant
pour la formation :

  ${p.seminarTitle}
  Abidjan — Mai 2026

Accédez à votre espace :
${p.magicLinkUrl}

Ce lien expire dans 1 heure et ne peut être utilisé qu'une fois.

Dans votre espace, vous trouverez :
  • Le programme détaillé
  • Votre attestation (après la formation)
  • Le coaching IA personnalisé (formation S1)
  • La communauté des participants
  • Les ressources Découverte IA

Vous n'avez pas demandé cet email ? Ignorez-le simplement,
aucune action ne sera prise sur votre compte.

Question ? ${p.supportPhone} (Appel/WhatsApp)

— L'équipe RMK Conseils`,

  html: (p) => `
<p>Bonjour <strong>${escapeHtml(p.prenom)}</strong>,</p>

<p>Voici votre lien d'accès sécurisé à votre espace participant pour la formation&nbsp;:</p>

<div style="background:#F5F1E4;border-left:3px solid #C9A84C;padding:12px 16px;margin:16px 0;">
  <strong style="color:#1B2A4A;">${escapeHtml(p.seminarTitle)}</strong><br>
  <span style="color:#666;">Abidjan — Mai 2026</span>
</div>

<p style="text-align:center;margin:32px 0;">
  <a href="${escapeHtml(p.magicLinkUrl)}"
     style="display:inline-block;background:#C9A84C;color:#1B2A4A;text-decoration:none;
            padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">
    👉 Accéder à mon espace
  </a>
</p>

<p style="color:#666;font-size:13px;text-align:center;margin-top:-16px;">
  Ce lien expire dans 1 heure et ne peut être utilisé qu'une fois.
</p>

<h4 style="color:#1B2A4A;margin-top:28px;">Dans votre espace, vous trouverez&nbsp;:</h4>
<ul style="color:#444;line-height:1.8;">
  <li>Le programme détaillé de votre formation</li>
  <li>Votre attestation (disponible après la formation)</li>
  <li>L'accès au coaching IA personnalisé (formation S1)</li>
  <li>La communauté des participants</li>
  <li>Les ressources Découverte IA</li>
</ul>

<p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
  Vous n'avez pas demandé cet email&nbsp;? Ignorez-le simplement, aucune action
  ne sera prise sur votre compte.<br><br>
  Question&nbsp;? <a href="https://wa.me/${p.supportPhone.replace(/\D/g, "")}" style="color:#C9A84C;">${escapeHtml(p.supportPhone)}</a> (Appel/WhatsApp)
</p>
`,
};
