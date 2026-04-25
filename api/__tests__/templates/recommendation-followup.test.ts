import { describe, it, expect } from "vitest";
import { renderEmail } from "../../lib/render-email.js";
import { recommendationFollowup } from "../../email-templates/recommendation-followup.js";

const props = {
  prenom: "Fatou",
  recommendation: "Concentrez-vous sur l'atelier S2 pour outiller votre équipe finance.",
  portalUrl: "https://rmkconseils.com/portal",
};

describe("recommendationFollowup", () => {
  it("includes the participant's first name", () => {
    expect(renderEmail(recommendationFollowup, props).html).toContain("Fatou");
    expect(renderEmail(recommendationFollowup, props).text).toContain("Fatou");
  });
  it("interpolates the recommendation string", () => {
    const out = renderEmail(recommendationFollowup, props);
    expect(out.html).toContain(props.recommendation);
    expect(out.text).toContain(props.recommendation);
  });
  it("links back to the portal", () => {
    expect(renderEmail(recommendationFollowup, props).html).toContain(props.portalUrl);
    expect(renderEmail(recommendationFollowup, props).text).toContain(props.portalUrl);
  });
  it("subject mentions personalized journey", () => {
    expect(renderEmail(recommendationFollowup, props).subject).toMatch(/parcours personnalisé/i);
  });
  it("escapes hostile input in recommendation", () => {
    const out = renderEmail(recommendationFollowup, { ...props, recommendation: "<img src=x onerror=alert(1)>" });
    expect(out.html).toContain("&lt;img");
    expect(out.html).not.toContain("<img src=x");
  });
});
