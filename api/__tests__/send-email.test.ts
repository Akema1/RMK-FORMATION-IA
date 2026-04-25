import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
// Vitest 4 quirk: vi.fn().mockImplementation isn't `new`-able.
// A plain function declaration is constructable and lets the test
// call `new Resend(...)` cleanly.
vi.mock("resend", () => {
  function MockResend() {
    return { emails: { send: sendMock } };
  }
  return { Resend: MockResend };
});

import { sendEmail } from "../lib/send-email.js";

beforeEach(() => sendMock.mockReset());

describe("sendEmail", () => {
  it("forwards subject/html/text to Resend with EMAIL_FROM", async () => {
    sendMock.mockResolvedValue({ data: { id: "x" }, error: null });
    await sendEmail(
      { to: "a@b.com", subject: "S", html: "<p>H</p>", text: "T" },
      { resendApiKey: "key", from: "RMK <a@b.com>" },
    );
    expect(sendMock).toHaveBeenCalledWith({
      from: "RMK <a@b.com>",
      to: "a@b.com",
      subject: "S",
      html: "<p>H</p>",
      text: "T",
    });
  });

  it("throws when Resend returns error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "bad" } });
    await expect(
      sendEmail(
        { to: "a@b.com", subject: "S", html: "h", text: "t" },
        { resendApiKey: "k", from: "f" },
      ),
    ).rejects.toThrow("bad");
  });

  it("no-ops when resendApiKey is empty (graceful degradation)", async () => {
    await sendEmail(
      { to: "a@b.com", subject: "S", html: "h", text: "t" },
      { resendApiKey: "", from: "f" },
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
