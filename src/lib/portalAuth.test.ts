import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendPortalMagicLink } from "./portalAuth";

describe("sendPortalMagicLink", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the lowercased trimmed email to /api/auth/send-magic-link", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await sendPortalMagicLink("  USER@Example.COM ");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/auth/send-magic-link");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ email: "user@example.com" });
  });

  it("returns ok=true on 200 (anti-enumeration: always treated as sent)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const r = await sendPortalMagicLink("a@b.co");
    expect(r).toEqual({ ok: true });
  });

  it("returns invalid_email on 400", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_email" }), { status: 400 }),
    );
    const r = await sendPortalMagicLink("not-an-email");
    expect(r).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("returns rate_limited on 429", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many" }), { status: 429 }),
    );
    const r = await sendPortalMagicLink("a@b.co");
    expect(r).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("returns network on fetch rejection", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    const r = await sendPortalMagicLink("a@b.co");
    expect(r).toEqual({ ok: false, reason: "network" });
  });

  it("returns network on unexpected status", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("oops", { status: 500 }),
    );
    const r = await sendPortalMagicLink("a@b.co");
    expect(r).toEqual({ ok: false, reason: "network" });
  });

  it("rejects empty email locally without calling fetch", async () => {
    const r = await sendPortalMagicLink("   ");
    expect(r).toEqual({ ok: false, reason: "invalid_email" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
