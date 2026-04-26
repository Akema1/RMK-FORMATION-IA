import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyableReference } from "./CopyableReference";

describe("CopyableReference", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("renders the reference text", () => {
    render(<CopyableReference value="RMK-A8B3-7E92" />);
    expect(screen.getByText("RMK-A8B3-7E92")).toBeInTheDocument();
  });

  it("copies the reference to the clipboard on button click", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CopyableReference value="RMK-A8B3-7E92" />);
    await user.click(screen.getByRole("button", { name: /copier/i }));
    expect(writeText).toHaveBeenCalledWith("RMK-A8B3-7E92");
  });

  it("shows confirmation feedback after a successful copy", async () => {
    const user = userEvent.setup();
    render(<CopyableReference value="RMK-A8B3-7E92" />);
    await user.click(screen.getByRole("button", { name: /copier/i }));
    expect((await screen.findAllByText(/copié/i)).length).toBeGreaterThan(0);
  });

  it("shows an error message when clipboard is unavailable", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    render(<CopyableReference value="RMK-A8B3-7E92" />);
    await user.click(screen.getByRole("button", { name: /copier/i }));
    expect(
      (await screen.findAllByText(/échec|impossible/i)).length,
    ).toBeGreaterThan(0);
  });

  it("exposes the reference for assistive tech via aria-label on the value", () => {
    render(<CopyableReference value="RMK-A8B3-7E92" />);
    expect(screen.getByLabelText(/référence de paiement/i)).toHaveTextContent(
      "RMK-A8B3-7E92",
    );
  });
});
