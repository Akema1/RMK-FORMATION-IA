import { describe, it, expect } from "vitest";
import { renderEmail, type EmailTemplate } from "../lib/render-email.js";

const sample: EmailTemplate<{ name: string }> = {
  subject: (p) => `Hello ${p.name}`,
  html: (p) => `<p>Hi ${p.name}</p>`,
  text: (p) => `Hi ${p.name}`,
};

describe("renderEmail", () => {
  it("renders subject from props", () => {
    expect(renderEmail(sample, { name: "Alice" }).subject).toBe("Hello Alice");
  });

  it("wraps body html in layout", () => {
    const out = renderEmail(sample, { name: "Alice" });
    expect(out.html).toContain("<!doctype html>");
    expect(out.html).toContain("<p>Hi Alice</p>");
    expect(out.html).toContain("R M K");
  });

  it("returns plain text body unchanged", () => {
    expect(renderEmail(sample, { name: "Alice" }).text).toBe("Hi Alice");
  });

  it("escapes html in subject when used in title", () => {
    const out = renderEmail(sample, { name: "<script>" });
    expect(out.html).toContain("&lt;script&gt;");
  });
});
