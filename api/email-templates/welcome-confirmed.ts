import type { EmailTemplate } from "../lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface WelcomeConfirmedProps {
  prenom: string;
  seminarTitle: string;
  seminarDates: string;
  magicLinkUrl: string;
  portalUrl: string;
  supportPhone: string;
}

export const welcomeConfirmed: EmailTemplate<WelcomeConfirmedProps> = {
  subject: () => "🎉 Votre inscription est confirmée — Bienvenue !",

  text: (p) => `Bonjour ${p.prenom},

Excellente nouvelle : votre paiement est confirmé et votre place
pour ${p.seminarTitle} (${p.seminarDates}) est définitivement réservée.

Voici votre accès à l'espace participant :
${p.magicLinkUrl}

(Lien valide 1 heure. Pour toute connexion future, rendez-vous sur
${p.portalUrl} avec votre email.)

À très bientôt,
L'équipe RMK Conseils

Question ? ${p.supportPhone} (Appel/WhatsApp)`,

  html: (p) => `
<h2 style="color:#1B2A4A;">🎉 Bienvenue, ${escapeHtml(p.prenom)} !</h2>

<p>Excellente nouvelle&nbsp;: votre paiement est confirmé et votre place pour
<strong>${escapeHtml(p.seminarTitle)}</strong> (${escapeHtml(p.seminarDates)})
est définitivement réservée.</p>

<p style="text-align:center;margin:32px 0;">
  <a href="${p.magicLinkUrl}"
     style="display:inline-block;background:#C9A84C;color:#1B2A4A;text-decoration:none;
            padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">
    Accéder à mon espace participant
  </a>
</p>

<p style="color:#666;font-size:13px;text-align:center;margin-top:-16px;">
  Lien valide 1 heure. Pour toute connexion future, rendez-vous sur
  <a href="${p.portalUrl}" style="color:#C9A84C;">${p.portalUrl}</a>.
</p>

<h4 style="color:#1B2A4A;margin-top:28px;">Prochaines étapes&nbsp;:</h4>
<ol style="color:#444;line-height:1.8;">
  <li>Connectez-vous avec votre email</li>
  <li>Personnalisez votre profil (2 minutes)</li>
  <li>Découvrez le programme et les ressources</li>
</ol>

<p style="color:#999;font-size:12px;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
  Question&nbsp;? <a href="https://wa.me/${p.supportPhone.replace(/\D/g, "")}" style="color:#C9A84C;">${escapeHtml(p.supportPhone)}</a> (Appel/WhatsApp)
</p>
`,
};
