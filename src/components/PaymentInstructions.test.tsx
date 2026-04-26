import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentInstructions } from "./PaymentInstructions";

describe("PaymentInstructions", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("renders the heading", () => {
    render(<PaymentInstructions supportPhone="+225 07 02 61 15 82" />);
    expect(
      screen.getByRole("heading", { name: /modalités de paiement/i }),
    ).toBeInTheDocument();
  });

  it("hides the reference block when no reference is provided", () => {
    render(<PaymentInstructions supportPhone="+225 07 02 61 15 82" />);
    expect(screen.queryByLabelText(/référence de paiement/i)).toBeNull();
  });

  it("shows the reference block when a reference is provided", () => {
    render(
      <PaymentInstructions
        reference="RMK-A8B3-7E92"
        supportPhone="+225 07 02 61 15 82"
      />,
    );
    expect(screen.getByLabelText(/référence de paiement/i)).toHaveTextContent(
      "RMK-A8B3-7E92",
    );
  });

  it("formats the amount with French thousands separators", () => {
    render(
      <PaymentInstructions
        amountFcfa={540000}
        supportPhone="+225 07 02 61 15 82"
      />,
    );
    expect(screen.getByText(/540\s?000\s+FCFA/)).toBeInTheDocument();
  });

  it("renders the Wave and Orange Money logos with alt text", () => {
    render(<PaymentInstructions supportPhone="+225 07 02 61 15 82" />);
    expect(screen.getByAltText(/wave/i)).toBeInTheDocument();
    expect(screen.getByAltText(/orange money/i)).toBeInTheDocument();
  });

  it("does not include MoMo per spec D5", () => {
    render(<PaymentInstructions supportPhone="+225 07 02 61 15 82" />);
    expect(screen.queryByText(/momo|mtn money/i)).toBeNull();
  });

  it("links the support phone to wa.me", () => {
    render(<PaymentInstructions supportPhone="+225 07 02 61 15 82" />);
    const link = screen.getByRole("link", { name: /\+225/ });
    expect(link).toHaveAttribute("href", "https://wa.me/2250702611582");
  });
});
