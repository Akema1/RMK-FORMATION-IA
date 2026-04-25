import type { EmailTemplate } from "../lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface RecommendationFollowupProps {
  prenom: string;
  recommendation: string;
  portalUrl: string;
}

export const recommendationFollowup: EmailTemplate<RecommendationFollowupProps> = {
  subject: () => "Votre parcours personnalisé RMK — Recommandation",

  text: (p) => `Bonjour ${p.prenom},

Merci d'avoir partagé vos objectifs avec nous. Voici notre
recommandation personnalisée pour tirer le meilleur parti de
votre formation :

${p.recommendation}

Retrouvez cette recommandation et toutes les ressources sur
votre espace : ${p.portalUrl}

— L'équipe RMK Conseils`,

  html: (p) => `
<p>Bonjour <strong>${escapeHtml(p.prenom)}</strong>,</p>
<p>Merci d'avoir partagé vos objectifs. Voici notre recommandation personnalisée&nbsp;:</p>
<div style="background:#F5F1E4;border-left:3px solid #C9A84C;padding:16px 20px;margin:20px 0;font-style:italic;color:#1B2A4A;">
  ${escapeHtml(p.recommendation)}
</div>
<p style="text-align:center;margin:24px 0;">
  <a href="${escapeHtml(p.portalUrl)}" style="display:inline-block;background:#1B2A4A;color:#fff;
     text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
    Retour à mon espace
  </a>
</p>
`,
};
