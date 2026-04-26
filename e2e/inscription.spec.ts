import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 1D registration flow + new public routes
 * Covers the LandingPage form wired to /api/register and the
 * /inscription/confirmee, /paiement, /cgu, /confidentialite pages.
 */

const VALID_REGISTER_RESPONSE = {
  participant_id: "00000000-0000-0000-0000-000000000001",
  payment_reference: "RMK-A8B3-7E92",
};

async function openInscriptionForm(page: Page) {
  await page.goto("/");
  const cta = page.getByRole("button", { name: /s'inscrire/i }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page.locator("#field-email")).toBeVisible({ timeout: 8000 });
}

async function fillRequiredFields(page: Page) {
  await page.locator("#field-civilite").selectOption("M.");
  await page.locator("#field-nom").fill("Doe");
  await page.locator("#field-prenom").fill("Jane");
  await page.locator("#field-email").fill("jane@example.com");
  // tel pre-filled with "+225 " — append the rest
  await page.locator("#field-tel").fill("+225 07 02 61 15 82");
  await page.locator("#field-societe").fill("Acme");
  await page.locator("#field-fonction").fill("CFO");
  // First non-pack option in the seminar select
  const seminarSelect = page.locator("#field-seminaire");
  const firstId = await seminarSelect
    .locator('option[value]:not([value=""]):not([value="pack2"]):not([value="pack4"])')
    .first()
    .getAttribute("value");
  if (!firstId) throw new Error("no seminar option found");
  await seminarSelect.selectOption(firstId);
  await page.locator("#referral_channel").selectOption("LinkedIn");
  await page.locator("#consent").check();
}

test.describe("Inscription form — Phase 1D /api/register flow", () => {
  test("S'inscrire CTA opens the form", async ({ page }) => {
    await openInscriptionForm(page);
    await expect(page.locator("#field-email")).toBeVisible();
  });

  test("HTML5 validation blocks empty submission", async ({ page }) => {
    await openInscriptionForm(page);
    const submit = page.getByRole("button", { name: /envoyer/i }).first();
    await submit.click();
    // Custom JS validate() runs first and renders inline errors.
    await expect(page.getByText(/civilité est obligatoire/i)).toBeVisible();
  });

  test("happy path: 201 → navigates to /inscription/confirmee with reference", async ({
    page,
  }) => {
    await page.route("**/api/register", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(VALID_REGISTER_RESPONSE),
      }),
    );

    await openInscriptionForm(page);
    await fillRequiredFields(page);
    await page.getByRole("button", { name: /envoyer/i }).click();

    await expect(page).toHaveURL(/\/inscription\/confirmee/);
    await expect(
      page.getByRole("heading", { name: /inscription enregistrée/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/référence de paiement/i)).toContainText(
      "RMK-A8B3-7E92",
    );
    // sessionStorage was seeded for refresh resilience
    const stored = await page.evaluate(() =>
      sessionStorage.getItem("rmk:lastReg"),
    );
    expect(stored).toContain("RMK-A8B3-7E92");
  });

  test("409 resent_confirmation: shows the renvoyé banner", async ({ page }) => {
    await page.route("**/api/register", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "duplicate_registration",
          state: "pending_unpaid",
          payment_reference: "RMK-X",
          action_taken: "resent_confirmation",
        }),
      }),
    );

    await openInscriptionForm(page);
    await fillRequiredFields(page);
    await page.getByRole("button", { name: /envoyer/i }).click();
    await expect(page.getByText(/renvoyer votre confirmation/i)).toBeVisible();
    await expect(page).toHaveURL(/^(?!.*confirmee)/);
  });

  test("409 sent_magic_link: shows the magic-link banner", async ({ page }) => {
    await page.route("**/api/register", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "duplicate_registration",
          state: "confirmed",
          payment_reference: "RMK-X",
          action_taken: "sent_magic_link",
        }),
      }),
    );

    await openInscriptionForm(page);
    await fillRequiredFields(page);
    await page.getByRole("button", { name: /envoyer/i }).click();
    await expect(page.getByText(/lien magique/i)).toBeVisible();
  });

  test("400: server validation issues map back to field-level errors", async ({
    page,
  }) => {
    await page.route("**/api/register", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "validation",
          issues: [
            { path: ["email"], message: "Email serveur invalide" },
            { path: ["fonction"], message: "Fonction trop courte" },
          ],
        }),
      }),
    );

    await openInscriptionForm(page);
    await fillRequiredFields(page);
    await page.getByRole("button", { name: /envoyer/i }).click();
    await expect(page.getByText(/email serveur invalide/i)).toBeVisible();
    await expect(page.getByText(/fonction trop courte/i)).toBeVisible();
  });

  test("5xx: shows the generic error banner", async ({ page }) => {
    await page.route("**/api/register", (route) =>
      route.fulfill({ status: 500, body: "boom" }),
    );

    await openInscriptionForm(page);
    await fillRequiredFields(page);
    await page.getByRole("button", { name: /envoyer/i }).click();
    await expect(page.getByText(/une erreur est survenue/i)).toBeVisible();
  });

  test("ChannelField reveals 'Recommandation' sub-field on demand", async ({
    page,
  }) => {
    await openInscriptionForm(page);
    await page.locator("#referral_channel").selectOption("Recommandation");
    await expect(page.locator("#referrer_name")).toBeVisible();
    await page.locator("#referral_channel").selectOption("LinkedIn");
    await expect(page.locator("#referrer_name")).toBeHidden();
  });

  test("ChannelField reveals 'Autre' sub-field on demand", async ({ page }) => {
    await openInscriptionForm(page);
    await page.locator("#referral_channel").selectOption("Autre");
    await expect(page.locator("#channel_other")).toBeVisible();
  });
});

test.describe("Phase 1D public routes", () => {
  test("/paiement renders generic payment instructions", async ({ page }) => {
    await page.goto("/paiement");
    await expect(
      page.getByRole("heading", { name: /^paiement$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /modalités de paiement/i }),
    ).toBeVisible();
    // No reference rendered in generic mode.
    await expect(page.getByLabel(/référence de paiement/i)).toHaveCount(0);
  });

  test("/cgu renders the CGU placeholder", async ({ page }) => {
    await page.goto("/cgu");
    await expect(
      page.getByRole("heading", { name: /conditions générales/i }),
    ).toBeVisible();
  });

  test("/confidentialite renders the privacy placeholder", async ({ page }) => {
    await page.goto("/confidentialite");
    await expect(
      page.getByRole("heading", { name: /politique de confidentialité/i }),
    ).toBeVisible();
  });

  test("/inscription/confirmee redirects home when no state and no sessionStorage", async ({
    page,
  }) => {
    await page.goto("/inscription/confirmee");
    await expect(page).toHaveURL(/\/$/);
  });

  test("/inscription/confirmee renders from sessionStorage fallback", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      sessionStorage.setItem(
        "rmk:lastReg",
        JSON.stringify({
          paymentReference: "RMK-CACHE-9999",
          participantId: "00000000-0000-0000-0000-000000000002",
          seminarId: "S1",
        }),
      );
    });
    await page.goto("/inscription/confirmee");
    await expect(
      page.getByRole("heading", { name: /inscription enregistrée/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/référence de paiement/i)).toContainText(
      "RMK-CACHE-9999",
    );
  });

  test("CGU link from the inscription form opens /cgu", async ({ page, context }) => {
    await openInscriptionForm(page);
    const link = page.getByRole("link", { name: /^cgu$/i });
    await expect(link).toHaveAttribute("href", "/cgu");
    await expect(link).toHaveAttribute("target", "_blank");
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      link.click(),
    ]);
    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/\/cgu$/);
    await popup.close();
  });
});

