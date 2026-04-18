import { test, expect, Page } from '@playwright/test';

/**
 * Client portal — magic link auth flow
 *
 * The portal entry is a 4-step onboarding carousel:
 *   step 0: welcome    → "Commencer" button, or "J'ai deja un compte" shortcut
 *   step 1: profile    → name / email / company / fonction
 *   step 2: interests  → seminar selection + coaching toggle
 *   step 3: magic link → email input + "Recevoir mon lien de connexion" CTA
 *
 * Returning users (and these tests) skip to step 3 via the shortcut on step 0.
 */

async function gotoLogin(page: Page) {
  await page.goto('/portal');
  await page.getByRole('button', { name: /deja un compte/i }).click();
  await expect(page.locator('input[type="email"]')).toBeVisible();
}

test.describe('Client portal', () => {
  test('portal login page renders correctly', async ({ page }) => {
    await gotoLogin(page);

    // Brand heading on the magic-link step
    await expect(page.getByText(/connectez-vous a votre espace/i).first()).toBeVisible();

    // Email input is present
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // CTA button to receive magic link is present
    const sendBtn = page.getByRole('button', { name: /lien|connexion|connecter/i }).first();
    await expect(sendBtn).toBeVisible();
  });

  test('empty email disables the send button', async ({ page }) => {
    await gotoLogin(page);

    // Email starts empty on the shortcut path; CTA should be disabled.
    const sendBtn = page.getByRole('button', { name: /recevoir mon lien/i });
    await expect(sendBtn).toBeDisabled();
  });

  test('entering email enables the send button', async ({ page }) => {
    await gotoLogin(page);

    await page.locator('input[type="email"]').fill('test@entreprise.ci');

    const sendBtn = page.getByRole('button', { name: /recevoir mon lien/i });
    await expect(sendBtn).toBeEnabled();
  });

  test('clicking send with valid email shows confirmation screen', async ({ page }) => {
    // Mock Supabase auth OTP endpoint
    await page.route('**/auth/v1/otp*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message_id: 'mock-message-id' }),
      });
    });

    await gotoLogin(page);

    await page.locator('input[type="email"]').fill('participant@entreprise.ci');
    await page.getByRole('button', { name: /recevoir mon lien/i }).click();

    // Sent screen heading is "Verifiez votre email" (unaccented in source)
    await expect(page.getByRole('heading', { name: /verifiez votre email/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('participant@entreprise.ci')).toBeVisible();
  });

  test('back button from confirmation screen resets to email input', async ({ page }) => {
    await page.route('**/auth/v1/otp*', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ message_id: 'mock' }) });
    });

    await gotoLogin(page);

    await page.locator('input[type="email"]').fill('test@exemple.com');
    await page.getByRole('button', { name: /recevoir mon lien/i }).click();

    // Wait for sent screen
    const changeBtn = page.getByRole('button', { name: /changer d'email/i });
    await expect(changeBtn).toBeVisible({ timeout: 5000 });

    await changeBtn.click();

    // Should be back on the magic-link step (email input visible again)
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('login screen is reachable from a cold visit (no session injected)', async ({ page }) => {
    // Mock Supabase endpoints to avoid network flake
    await page.route('**/auth/v1/user*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-user-id', email: 'participant@test.ci', role: 'authenticated' }),
      });
    });
    await page.route('**/rest/v1/participants*', route => {
      route.fulfill({ status: 200, body: JSON.stringify([]) });
    });
    await page.route('**/rest/v1/seminars*', route => {
      route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await gotoLogin(page);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  });

  test('"Retour au site" button navigates to home', async ({ page }) => {
    await page.goto('/portal');
    const backBtn = page.getByRole('button', { name: /retour au site/i }).first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/');
  });
});
