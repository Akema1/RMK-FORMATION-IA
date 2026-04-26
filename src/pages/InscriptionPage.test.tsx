import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { InscriptionPage } from "./LandingPage";
import { SEMINARS } from "../data/seminars";

vi.mock("../lib/supabaseClient", () => ({ supabase: {} }));

const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.selectOptions(screen.getByLabelText(/civilité/i), "M.");
  await user.type(screen.getByLabelText(/^nom/i), "Doe");
  await user.type(screen.getByLabelText(/^prénom/i), "Jane");
  await user.type(screen.getByLabelText(/email professionnel/i), "jane@example.com");
  // tel pre-filled with "+225 "
  await user.type(screen.getByLabelText(/téléphone/i), "07 02 61 15 82");
  await user.type(screen.getByLabelText(/^société/i), "Acme");
  await user.type(screen.getByLabelText(/^fonction/i), "CFO");
  await user.selectOptions(screen.getByLabelText(/atelier souhaité/i), SEMINARS[0]!.id);
  await user.selectOptions(
    screen.getByLabelText(/comment avez-vous entendu parler/i),
    "LinkedIn",
  );
  await user.click(screen.getByRole("checkbox"));
};

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderInscription() {
  return render(
    <MemoryRouter initialEntries={["/inscription"]}>
      <Routes>
        <Route
          path="/inscription"
          element={
            <InscriptionPage
              selectedSem={SEMINARS[0]!.id}
              seminars={SEMINARS}
              fullSeminars={new Set()}
              onCapacityChange={() => {}}
            />
          }
        />
        <Route
          path="/inscription/confirmee"
          element={<LocationDisplay />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InscriptionPage submit branches", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("on 201, persists to sessionStorage and navigates to /inscription/confirmee", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          participant_id: "p1",
          payment_reference: "RMK-A8B3-7E92",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderInscription();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /envoyer/i }));

    await waitFor(() =>
      expect(screen.getByTestId("loc")).toHaveTextContent("/inscription/confirmee"),
    );
    const stored = JSON.parse(sessionStorage.getItem("rmk:lastReg") ?? "{}");
    expect(stored.paymentReference).toBe("RMK-A8B3-7E92");
  });

  it("on 409 with action_taken=resent_confirmation, shows the resent banner", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "duplicate_registration",
          state: "pending_unpaid",
          payment_reference: "RMK-X",
          action_taken: "resent_confirmation",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderInscription();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(
      await screen.findByText(/renvoyer votre confirmation/i),
    ).toBeInTheDocument();
  });

  it("on 409 with action_taken=sent_magic_link, shows the magic-link banner", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "duplicate_registration",
          state: "confirmed",
          payment_reference: "RMK-X",
          action_taken: "sent_magic_link",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderInscription();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(
      await screen.findByText(/lien magique/i),
    ).toBeInTheDocument();
  });

  it("on 400, renders field-level errors mapped from issues path", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "validation",
          issues: [
            { path: ["email"], message: "Email invalide" },
            { path: ["fonction"], message: "Fonction requise" },
          ],
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderInscription();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(await screen.findByText(/email invalide/i)).toBeInTheDocument();
    expect(screen.getByText(/fonction requise/i)).toBeInTheDocument();
  });

  it("on 5xx, shows a generic error banner", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("server boom", { status: 500 }),
    );
    renderInscription();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(
      await screen.findByText(/une erreur est survenue/i),
    ).toBeInTheDocument();
  });

  it("on network failure, shows a connection error banner", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));
    renderInscription();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(
      await screen.findByText(/connexion impossible/i),
    ).toBeInTheDocument();
  });
});
