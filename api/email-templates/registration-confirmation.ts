import type { EmailTemplate } from "../lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface RegistrationConfirmationProps {
  prenom: string;
  civilite?: string | null;
  seminarTitle: string;
  seminarDates: string;
  amountFcfa: number;
  paymentReference: string;
  supportPhone: string;
  siteUrl: string;
}

const fmtAmount = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export const registrationConfirmation: EmailTemplate<RegistrationConfirmationProps> = {
  subject: () => "Confirmation de votre demande d'inscription — RMK Conseils",

  text: (p) =>
    `Bonjour ${p.civilite ?? ""} ${p.prenom},

Nous avons bien reçu votre demande d'inscription pour:
  ${p.seminarTitle}
  ${p.seminarDates}

═════════════════════════════════════════
  IMPORTANT — À INDIQUER DANS LE MOTIF
═════════════════════════════════════════

         ${p.paymentReference}

Lors de votre paiement, saisissez ce code dans le champ
« motif » ou « raison du transfert ». Sans cette référence,
la confirmation peut être retardée de plusieurs jours.

═════════════════════════════════════════

Montant : ${fmtAmount(p.amountFcfa)}

Modalités de paiement :
  • Wave           : ${p.supportPhone}
  • Orange Money   : ${p.supportPhone}
  • Virement       : contactez-nous

Pour toute question ou pour le virement bancaire,
appelez ou écrivez sur WhatsApp : ${p.supportPhone}

Dès réception de votre paiement, votre espace participant
sera activé sous 24h ouvrées.

Coordonnées de paiement à jour : ${p.siteUrl}/paiement

Cordialement,
L'équipe RMK Conseils`,

  html: (p) => `
<p style="font-size:16px;">Bonjour <strong>${escapeHtml(p.civilite ?? "")} ${escapeHtml(p.prenom)}</strong>,</p>

<p>Nous avons bien reçu votre demande d'inscription pour&nbsp;:</p>
<p style="font-size:17px;font-weight:600;color:#1B2A4A;margin:8px 0 4px;">${escapeHtml(p.seminarTitle)}</p>
<p style="color:#666;margin:0 0 24px;">${escapeHtml(p.seminarDates)}</p>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="background:#FFF8E1;border:2px solid #C9A84C;border-radius:8px;padding:20px;text-align:center;">
    <div style="font-size:11px;font-weight:bold;color:#C9A84C;letter-spacing:1.5px;margin-bottom:8px;">
      ⚠ IMPORTANT — À INDIQUER DANS LE MOTIF
    </div>
    <div style="font-family:Menlo,Consolas,monospace;font-size:26px;font-weight:bold;color:#1B2A4A;letter-spacing:2px;margin:8px 0;">
      ${escapeHtml(p.paymentReference)}
    </div>
    <div style="font-size:13px;color:#5a4a1a;line-height:1.5;">
      Lors de votre paiement, saisissez ce code dans le champ<br>
      «&nbsp;motif&nbsp;» ou «&nbsp;raison du transfert&nbsp;».
    </div>
  </td></tr>
</table>

<p style="font-size:15px;"><strong>Montant&nbsp;:</strong> ${fmtAmount(p.amountFcfa)}</p>

<h3 style="color:#1B2A4A;margin-top:28px;border-bottom:1px solid #e7e3d6;padding-bottom:6px;">Modalités de paiement</h3>
<table cellpadding="8" cellspacing="0" border="0" width="100%" style="margin:8px 0;">
  <tr>
    <td width="32"><img src="${escapeHtml(p.siteUrl)}/payment-logos/wave@2x.png" alt="Wave" width="32" height="32" style="display:block;"></td>
    <td><strong>Wave</strong></td>
    <td align="right" style="font-family:Menlo,monospace;">${escapeHtml(p.supportPhone)}</td>
  </tr>
  <tr>
    <td><img src="${escapeHtml(p.siteUrl)}/payment-logos/orange-money@2x.png" alt="Orange Money" width="32" height="32" style="display:block;"></td>
    <td><strong>Orange Money</strong></td>
    <td align="right" style="font-family:Menlo,monospace;">${escapeHtml(p.supportPhone)}</td>
  </tr>
  <tr>
    <td>🏦</td>
    <td><strong>Virement bancaire</strong></td>
    <td align="right" style="color:#666;">contactez-nous</td>
  </tr>
</table>

<p style="background:#F5F1E4;padding:12px 16px;border-radius:6px;margin:24px 0;">
  📞 <strong>Question ou virement&nbsp;:</strong> ${escapeHtml(p.supportPhone)} (Appel ou WhatsApp)
</p>

<p>Dès réception de votre paiement, votre espace participant sera activé sous 24h ouvrées.</p>

<p style="color:#999;font-size:12px;margin-top:24px;">
  Coordonnées de paiement à jour&nbsp;: <a href="${escapeHtml(p.siteUrl)}/paiement" style="color:#C9A84C;">${escapeHtml(p.siteUrl)}/paiement</a>
</p>
`,
};
