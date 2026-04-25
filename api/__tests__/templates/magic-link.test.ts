import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { magicLink } from "../../email-templates/magic-link.js";

const props = {
  prenom: "Jean",
  seminarTitle: "S2 — IA Finance",
  magicLinkUrl: "https://rmkconseils.com/portal#access_token=xyz",
  supportPhone: "+225 07 02 61 15 82",
};

describe("magicLink", () => {
  it("renders the link as a button", () => {
    expect(renderEmail(magicLink, props).html).toContain(props.magicLinkUrl);
  });
  it("text version includes the URL on its own line", () => {
    expect(renderEmail(magicLink, props).text).toContain(props.magicLinkUrl);
  });
  it("mentions expiration", () => {
    const out = renderEmail(magicLink, props);
    expect(out.html).toMatch(/expire dans 1 heure/);
    expect(out.text).toMatch(/expire dans 1 heure/);
  });
  it("mentions security note (didn't request)", () => {
    expect(renderEmail(magicLink, props).text).toMatch(/n'avez pas demandé/);
  });
  it("includes seminar title for context", () => {
    expect(renderEmail(magicLink, props).html).toContain("S2 — IA Finance");
  });
});
