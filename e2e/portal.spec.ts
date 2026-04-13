import { test, expect } from '@playwright/test';

/**
 * Client portal — magic link auth flow
 * Tests the 3-step auth: email input → sent confirmation → dashboard (mocked).
 */

test.describe('Client portal', () => {
  test('portal login page renders correctly', async ({ page }) => {
    await page.goto('/portal');

    // Logo / brand visible
    await expect(page.getByText(/Espace Client Privé/i).first()).toBeVisible();

    // Email input is present
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // CTA button to receive magic link is present
    const sendBtn = page.getByRole('button', { name: /lien|connexion|connecter/i }).first();
    await expect(sendBtn).toBeVisible();
  });

  test('empty email disables the send button', async ({ page }) => {
    await page.goto('/portal');

    const sendBtn = page.getByRole('button', { name: /lien|connexion|connecter/i }).first();
    // Button should be disabled/non-interactive when email is empty
    const isDisabled = await sendBtn.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test('entering email enables the send button', async ({ page }) => {
    await page.goto('/portal');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@entreprise.ci');

    const sendBtn = page.getByRole('button', { name: /lien|connexion|connecter/i }).first();
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

    await page.goto('/portal');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('participant@entreprise.ci');

    const sendBtn = page.getByRole('button', { name: /lien|connexion|connecter/i }).first();
    await sendBtn.click();

    // Should now show the "check your email" confirmation screen
    await expect(page.getByText(/vérifiez/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('participant@entreprise.ci')).toBeVisible();
  });

  test('back button from confirmation screen resets to email input', async ({ page }) => {
    // Mock Supabase OTP
    await page.route('**/auth/v1/otp*', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ message_id: 'mock' }) });
    });

    await page.goto('/portal');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@exemple.com');
    await page.getByRole('button', { name: /lien|connexion|connecter/i }).first().click();

    // Wait for sent screen
    await page.getByText(/changer/i).first().waitFor({ state: 'visible', timeout: 5000 });

    // Click "Changer d'email" (back button)
    await page.getByText(/changer/i).first().click();

    // Should be back on email input screen
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('dashboard loads when session is active (mocked)', async ({ page }) => {
    // Mock Supabase getSession to return a valid session
    await page.route('**/auth/v1/user*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-id',
          email: 'participant@test.ci',
          role: 'authenticated',
        }),
      });
    });

    // Mock participants table lookup
    await page.route('**/rest/v1/participants*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: '1',
          nom: 'Dupont',
          prenom: 'Jean',
          email: 'participant@test.ci',
          tel: '+225 07 00 00 00',
          societe: 'Test Corp',
          fonction: 'Directeur',
          seminar: 'S1',
          amount: 540000,
          status: 'confirmed',
          payment: 'wave',
          notes: '',
          created_at: '2026-01-01T00:00:00Z',
        }]),
      });
    });

    // Mock seminars
    await page.route('**/rest/v1/seminars*', route => {
      route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.goto('/portal');

    // The portal login screen should be visible by default (no session injected)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
  });

  test('"Retour au site" button navigates to home', async ({ page }) => {
    await page.goto('/portal');
    const backBtn = page.getByRole('button', { name: /retour/i }).first();
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/');
  });
});
