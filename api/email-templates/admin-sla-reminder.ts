import type { EmailTemplate } from "../lib/render-email.js";
import { escapeHtml } from "./_layout.js";

export interface SlaReminderRow {
  prenom: string;
  nom: string;
  email: string;
  seminarTitle: string;
  paymentReference: string;
  hoursWaiting: number;
}

export interface AdminSlaReminderProps {
  rows: SlaReminderRow[];
  adminUrl: string;
}

export const adminSlaReminder: EmailTemplate<AdminSlaReminderProps> = {
  subject: (p) => `[SLA] ${p.rows.length} inscription(s) en attente > 48h`,

  text: (p) =>
    `${p.rows.length} inscription(s) sont en attente de paiement depuis plus de 48h:\n\n` +
    p.rows.map(r =>
      `  ${r.paymentReference} — ${r.prenom} ${r.nom} (${r.email}) — ${r.seminarTitle} — ${r.hoursWaiting}h`
    ).join("\n") +
    `\n\nVoir l'admin: ${p.adminUrl}/admin`,

  html: (p) => `
<p><strong>${p.rows.length}</strong> inscription(s) en attente de paiement depuis plus de 48h&nbsp;:</p>
<table cellpadding="6" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;font-size:13px;">
  <tr style="background:#F5F1E4;color:#1B2A4A;">
    <th align="left" style="padding:8px;">Réf</th>
    <th align="left">Nom</th>
    <th align="left">Atelier</th>
    <th align="right">Attente</th>
  </tr>
  ${p.rows.map(r => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="font-family:Menlo,monospace;">${escapeHtml(r.paymentReference)}</td>
      <td>${escapeHtml(r.prenom)} ${escapeHtml(r.nom)}<br><span style="color:#888;font-size:11px;">${escapeHtml(r.email)}</span></td>
      <td>${escapeHtml(r.seminarTitle)}</td>
      <td align="right" style="color:#c44;"><strong>${r.hoursWaiting}h</strong></td>
    </tr>`).join("")}
</table>
<p><a href="${escapeHtml(p.adminUrl)}/admin" style="color:#C9A84C;">Ouvrir l'admin →</a></p>
`,
};
