import { describe, it, expect } from "vitest";
import { generatePaymentReference } from "../_lib/payment-reference.js";

describe("generatePaymentReference", () => {
  it("formats as RMK-<year>-<5-char>", () => {
    const ref = generatePaymentReference("9c2b7e1a-4f8d-4b3a-9d12-3e4f5a6b7c8d");
    expect(ref).toMatch(/^RMK-\d{4}-[A-Z0-9]{5}$/);
  });

  it("uses current year", () => {
    const ref = generatePaymentReference("9c2b7e1a-4f8d-4b3a-9d12-3e4f5a6b7c8d");
    const year = new Date().getUTCFullYear();
    expect(ref.startsWith(`RMK-${year}-`)).toBe(true);
  });

  it("is deterministic for the same UUID", () => {
    const id = "9c2b7e1a-4f8d-4b3a-9d12-3e4f5a6b7c8d";
    expect(generatePaymentReference(id)).toBe(generatePaymentReference(id));
  });

  it("differs across UUIDs", () => {
    const a = generatePaymentReference("11111111-1111-1111-1111-111111111111");
    const b = generatePaymentReference("22222222-2222-2222-2222-222222222222");
    expect(a).not.toBe(b);
  });

  it("4-char code excludes ambiguous chars (0/O, 1/I, L, U)", () => {
    // Only the suffix must avoid look-alikes — the year (2026) legitimately
    // contains 0, and the static RMK- prefix is fixed.
    for (let i = 0; i < 100; i++) {
      const uuid = crypto.randomUUID();
      const code = generatePaymentReference(uuid).split("-")[2];
      expect(code).not.toMatch(/[01OILU]/);
    }
  });
});
