import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { adminNewRegistration } from "../../email-templates/admin-new-registration.js";

const base = {
  prenom: "Marie", nom: "Koffi", civilite: "Mme",
  email: "marie@example.com", tel: "+22507000000",
  societe: "Acme", fonction: "DG",
  seminarTitle: "S1", amountFcfa: 700000,
  paymentReference: "RMK-2026-A4F2",
  participantId: "abc-123",
  adminUrl: "https://rmkconseils.com",
};

describe("adminNewRegistration", () => {
  it("includes channel when present", () => {
    const out = renderEmail(adminNewRegistration, {
      ...base, referralChannel: "LinkedIn",
    });
    expect(out.html).toContain("LinkedIn");
  });
  it("includes recommender name when channel is Recommandation", () => {
    const out = renderEmail(adminNewRegistration, {
      ...base, referralChannel: "Recommandation", referrerName: "Jean Diallo",
    });
    expect(out.html).toContain("Jean Diallo");
    expect(out.html).toContain("Recommandé par");
  });
  it("includes channel detail when Autre", () => {
    const out = renderEmail(adminNewRegistration, {
      ...base, referralChannel: "Autre", channelOther: "Conférence CIO",
    });
    expect(out.html).toContain("Conférence CIO");
  });
  it("links to admin focused on the participant", () => {
    const out = renderEmail(adminNewRegistration, base);
    expect(out.html).toContain("/admin?focus=abc-123");
  });
  it("subject includes participant name and seminar", () => {
    expect(renderEmail(adminNewRegistration, base).subject).toContain("Marie Koffi");
    expect(renderEmail(adminNewRegistration, base).subject).toContain("S1");
  });
});
