import type { EmailTemplate } from "../lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface AdminNewRegistrationProps {
  prenom: string;
  nom: string;
  civilite?: string | null;
  email: string;
  tel?: string | null;
  societe?: string | null;
  fonction: string;
  seminarTitle: string;
  amountFcfa: number;
  referralChannel?: string | null;
  referrerName?: string | null;
  channelOther?: string | null;
  paymentReference: string;
  participantId: string;
  adminUrl: string;
}

const fmtAmount = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export const adminNewRegistration: EmailTemplate<AdminNewRegistrationProps> = {
  subject: (p) => `[Inscription] ${p.civilite ?? ""} ${p.prenom} ${p.nom} — ${p.seminarTitle}`,

  text: (p) => `Nouvelle inscription:

  Référence : ${p.paymentReference}
  Nom       : ${p.civilite ?? ""} ${p.prenom} ${p.nom}
  Email     : ${p.email}
  Tel       : ${p.tel ?? "—"}
  Société   : ${p.societe ?? "—"}
  Fonction  : ${p.fonction}
  Atelier   : ${p.seminarTitle}
  Montant   : ${fmtAmount(p.amountFcfa)}

  Canal     : ${p.referralChannel ?? "—"}
  ${p.referrerName ? `Recommandé par : ${p.referrerName}\n  ` : ""}${p.channelOther ? `Précision : ${p.channelOther}\n  ` : ""}

Voir dans l'admin : ${p.adminUrl}/admin?focus=${p.participantId}`,

  html: (p) => `
<p>Nouvelle inscription reçue&nbsp;:</p>
<table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;">
  <tr><td style="color:#666;">Référence</td><td><strong>${escapeHtml(p.paymentReference)}</strong></td></tr>
  <tr><td style="color:#666;">Nom</td><td>${escapeHtml(p.civilite ?? "")} ${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</td></tr>
  <tr><td style="color:#666;">Email</td><td><a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></td></tr>
  <tr><td style="color:#666;">Téléphone</td><td>${escapeHtml(p.tel ?? "—")}</td></tr>
  <tr><td style="color:#666;">Société</td><td>${escapeHtml(p.societe ?? "—")}</td></tr>
  <tr><td style="color:#666;">Fonction</td><td>${escapeHtml(p.fonction)}</td></tr>
  <tr><td style="color:#666;">Atelier</td><td>${escapeHtml(p.seminarTitle)}</td></tr>
  <tr><td style="color:#666;">Montant</td><td>${fmtAmount(p.amountFcfa)}</td></tr>
  <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:12px;"></td></tr>
  <tr><td style="color:#666;">Canal</td><td><strong>${escapeHtml(p.referralChannel ?? "—")}</strong></td></tr>
  ${p.referrerName ? `<tr><td style="color:#666;">Recommandé par</td><td>${escapeHtml(p.referrerName)}</td></tr>` : ""}
  ${p.channelOther ? `<tr><td style="color:#666;">Précision</td><td>${escapeHtml(p.channelOther)}</td></tr>` : ""}
</table>

<p style="margin-top:24px;">
  <a href="${p.adminUrl}/admin?focus=${p.participantId}"
     style="display:inline-block;background:#1B2A4A;color:#fff;text-decoration:none;
            padding:10px 20px;border-radius:6px;font-weight:600;">
    Ouvrir dans l'admin →
  </a>
</p>
`,
};
