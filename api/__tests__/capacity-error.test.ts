import { describe, it, expect } from "vitest";
import {
  registrationErrorToBanner,
  DUPLICATE_BANNER,
  CAPACITY_BANNER,
} from "../../src/lib/errors";

// These tests import the REAL mapping used at runtime by LandingPage.tsx,
// so a regression in the handler (renamed code, dropped branch, tweaked
// French string) will fail the test — unlike an inline re-implementation.

describe("registrationErrorToBanner — Postgres SQLSTATE → French banner", () => {
  it("maps 23505 (unique_violation) to the duplicate banner", () => {
    expect(registrationErrorToBanner({ code: "23505" })).toEqual(DUPLICATE_BANNER);
  });

  it("maps P0013 (enforce_seminar_capacity trigger) to the capacity banner", () => {
    expect(registrationErrorToBanner({ code: "P0013" })).toEqual(CAPACITY_BANNER);
  });

  it("flags the capacity banner for capacity-view refetch, but not the duplicate banner", () => {
    expect(CAPACITY_BANNER.refetchCapacity).toBe(true);
    expect(DUPLICATE_BANNER.refetchCapacity).toBe(false);
  });

  it("returns null for unknown codes so the caller re-throws", () => {
    expect(registrationErrorToBanner({ code: "42P01" })).toBeNull();
    expect(registrationErrorToBanner({ code: "foo" })).toBeNull();
  });

  it("returns null for an error object with no code", () => {
    expect(registrationErrorToBanner({})).toBeNull();
  });

  it("capacity banner message mentions 'Atelier complet'", () => {
    // Guards against accidental copy drift away from the trigger's RAISE message.
    expect(CAPACITY_BANNER.message).toMatch(/Atelier complet/);
  });

  it("duplicate banner message mentions 'Portail Client' (the recovery path)", () => {
    expect(DUPLICATE_BANNER.message).toMatch(/Portail Client/);
  });
});
