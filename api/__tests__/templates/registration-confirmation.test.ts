import { describe, it, expect } from "vitest";
import { renderEmail } from "../../_lib/render-email.js";
import { registrationConfirmation } from "../../_email-templates/registration-confirmation.js";

const props = {
  prenom: "Marie",
  civilite: "Mme",
  seminarTitle: "S1 — IA Stratégique pour Dirigeants",
  seminarDates: "26-30 mai 2026",
  amountFcfa: 700000,
  paymentReference: "RMK-2026-A4F2",
  supportPhone: "+225 07 02 61 15 82",
  siteUrl: "https://rmkconseils.com",
};

describe("registrationConfirmation", () => {
  it("includes participant name", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("Marie");
    expect(out.text).toContain("Marie");
  });
  it("highlights the payment reference", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("RMK-2026-A4F2");
    expect(out.text).toContain("RMK-2026-A4F2");
  });
  it("instructs to use the reference as motif", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("motif");
    expect(out.text).toContain("motif");
  });
  it("formats amount with French thousand separator", () => {
    const out = renderEmail(registrationConfirmation, props);
    // Intl.NumberFormat("fr-FR") uses U+202F (narrow no-break space) — normalize for the assertion.
    expect(out.text.replace(/\s/g, " ")).toContain("700 000 FCFA");
  });
  it("does NOT mention MTN MoMo", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).not.toMatch(/MoMo|MTN/i);
    expect(out.text).not.toMatch(/MoMo|MTN/i);
  });
  it("includes Wave and Orange Money", () => {
    const out = renderEmail(registrationConfirmation, props);
    expect(out.html).toContain("Wave");
    expect(out.html).toContain("Orange Money");
  });
  it("escapes hostile input in seminarTitle", () => {
    const out = renderEmail(registrationConfirmation, { ...props, seminarTitle: "<script>" });
    expect(out.html).toContain("&lt;script&gt;");
  });
});
