import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { welcomeConfirmed } from "../../email-templates/welcome-confirmed.js";

const props = {
  prenom: "Aïcha",
  seminarTitle: "S1 — IA Stratégique pour Dirigeants",
  seminarDates: "26-30 mai 2026",
  magicLinkUrl: "https://rmkconseils.com/portal#access_token=xyz",
  portalUrl: "https://rmkconseils.com/portal",
  supportPhone: "+225 07 02 61 15 82",
};

describe("welcomeConfirmed", () => {
  it("subject mentions confirmation", () => {
    expect(renderEmail(welcomeConfirmed, props).subject).toMatch(/confirmée/);
  });
  it("html includes magic link URL and seminar title", () => {
    const out = renderEmail(welcomeConfirmed, props);
    expect(out.html).toContain(props.magicLinkUrl);
    expect(out.html).toContain(props.seminarTitle);
  });
  it("text version includes magic link URL and seminar title", () => {
    const out = renderEmail(welcomeConfirmed, props);
    expect(out.text).toContain(props.magicLinkUrl);
    expect(out.text).toContain(props.seminarTitle);
  });
  it("includes the participant's first name", () => {
    expect(renderEmail(welcomeConfirmed, props).html).toContain("Aïcha");
  });
  it("escapes hostile input in seminarTitle", () => {
    const out = renderEmail(welcomeConfirmed, { ...props, seminarTitle: "<script>alert(1)</script>" });
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).not.toContain("<script>alert(1)</script>");
  });
});
