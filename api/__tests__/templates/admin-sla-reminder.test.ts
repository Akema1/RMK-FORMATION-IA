import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { adminSlaReminder, type SlaReminderRow } from "../../email-templates/admin-sla-reminder.js";

const rows: SlaReminderRow[] = [
  { prenom: "Marie", nom: "Koffi", email: "marie@example.com", seminarTitle: "S1", paymentReference: "RMK-2026-A4F2", hoursWaiting: 52 },
  { prenom: "Jean", nom: "Diallo", email: "jean@example.com", seminarTitle: "S2", paymentReference: "RMK-2026-B7C9", hoursWaiting: 73 },
];

const props = { rows, adminUrl: "https://rmkconseils.com" };

describe("adminSlaReminder", () => {
  it("subject contains the row count", () => {
    expect(renderEmail(adminSlaReminder, props).subject).toContain("2 inscription(s)");
  });
  it("text body lists each payment reference", () => {
    const out = renderEmail(adminSlaReminder, props);
    expect(out.text).toContain("RMK-2026-A4F2");
    expect(out.text).toContain("RMK-2026-B7C9");
  });
  it("html body lists each payment reference and hours waiting", () => {
    const out = renderEmail(adminSlaReminder, props);
    expect(out.html).toContain("RMK-2026-A4F2");
    expect(out.html).toContain("52h");
    expect(out.html).toContain("RMK-2026-B7C9");
    expect(out.html).toContain("73h");
  });
  it("links to the admin", () => {
    expect(renderEmail(adminSlaReminder, props).html).toContain("https://rmkconseils.com/admin");
    expect(renderEmail(adminSlaReminder, props).text).toContain("https://rmkconseils.com/admin");
  });
  it("escapes hostile input in row name", () => {
    const hostile: SlaReminderRow = {
      prenom: "<script>", nom: "x", email: "x@y.z", seminarTitle: "S1", paymentReference: "RMK-2026-XXX", hoursWaiting: 50,
    };
    const out = renderEmail(adminSlaReminder, { rows: [hostile], adminUrl: "https://rmkconseils.com" });
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).not.toContain("<script>x");
  });
});
