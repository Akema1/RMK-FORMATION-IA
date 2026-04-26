import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PostSubmitScreen } from "./PostSubmitScreen";

function renderAt(pathname: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname, state }]}>
      <Routes>
        <Route path="/inscription/confirmee" element={<PostSubmitScreen />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PostSubmitScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("renders the reference from location.state", () => {
    renderAt("/inscription/confirmee", {
      paymentReference: "RMK-A8B3-7E92",
      seminarId: "S2",
    });
    expect(screen.getByLabelText(/référence de paiement/i)).toHaveTextContent(
      "RMK-A8B3-7E92",
    );
  });

  it("falls back to sessionStorage when location.state is empty", () => {
    sessionStorage.setItem(
      "rmk:lastReg",
      JSON.stringify({ paymentReference: "RMK-CACHE-9999", seminarId: "S2" }),
    );
    renderAt("/inscription/confirmee");
    expect(screen.getByLabelText(/référence de paiement/i)).toHaveTextContent(
      "RMK-CACHE-9999",
    );
  });

  it("redirects to / when neither location.state nor sessionStorage has data", () => {
    renderAt("/inscription/confirmee");
    expect(screen.getByText("HOME")).toBeInTheDocument();
  });

  it("renders the PaymentInstructions section", () => {
    renderAt("/inscription/confirmee", {
      paymentReference: "RMK-A8B3-7E92",
      seminarId: "S2",
    });
    expect(
      screen.getByRole("heading", { name: /modalités de paiement/i }),
    ).toBeInTheDocument();
  });

  it("links to the brochure download", () => {
    renderAt("/inscription/confirmee", {
      paymentReference: "RMK-A8B3-7E92",
      seminarId: "S2",
    });
    const link = screen.getByRole("link", { name: /brochure|programme/i });
    expect(link).toHaveAttribute("href", "/brochure.pdf");
  });
});
