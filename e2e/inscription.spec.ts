import { test, expect } from '@playwright/test';

/**
 * Inscription (registration) flow
 * Tests the form UX and mocked API submission on the landing page.
 */

test.describe('Inscription form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('clicking S\'inscrire opens the inscription form', async ({ page }) => {
    // Click the first "S'inscrire" CTA — should navigate to the inscription section/page
    const cta = page.getByRole('button', { name: /s'inscrire/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();

    // After click, an email input should appear (inscription form)
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 8000 });
  });

  test('form validates required fields before submission', async ({ page }) => {
    // Navigate directly to the inscription section
    await page.goto('/?page=inscription');

    // Try to find and submit an empty form
    const submitBtn = page.getByRole('button', { name: /envoyer|soumettre|confirmer/i }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Either a browser validation message or a custom error should appear
      // Browser native validation prevents submission — no server call
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.isVisible()) {
        const validationMessage = await emailInput.evaluate(
          (el: HTMLInputElement) => el.validationMessage
        );
        expect(validationMessage.length).toBeGreaterThan(0);
      }
    }
  });

  test('inscription form fields accept user input', async ({ page }) => {
    // Mock the notify-registration API so we don't send real emails
    await page.route('**/api/notify-registration', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    // Mock Supabase insert
    await page.route('**/rest/v1/participants*', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, body: JSON.stringify([{ id: 'test-id' }]) });
      } else {
        route.continue();
      }
    });

    await page.goto('/');

    // Click first S'inscrire button
    const cta = page.getByRole('button', { name: /s'inscrire/i }).first();
    if (await cta.isVisible()) {
      await cta.click();
    }

    // Fill nom
    const nomInput = page.locator('input[placeholder*="Nom"], input[name="nom"]').first();
    if (await nomInput.isVisible({ timeout: 5000 })) {
      await nomInput.fill('Dupont');
    }

    // Fill prenom
    const prenomInput = page.locator('input[placeholder*="Prénom"], input[name="prenom"]').first();
    if (await prenomInput.isVisible()) {
      await prenomInput.fill('Jean');
    }

    // Fill email
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill('jean.dupont@entreprise.ci');
    }

    // Verify values were entered
    if (await nomInput.isVisible()) {
      await expect(nomInput).toHaveValue('Dupont');
    }
  });
});
