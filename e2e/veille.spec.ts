import { test, expect } from '@playwright/test';

// Slice 1 smoke/structure E2E. Asserts the public Veille IA surface renders and
// degrades gracefully. Deliberately DB-state-agnostic: header, subscribe form,
// and the diagnostic CTA render whether or not the veille_articles migration is
// applied or any article is published, so these pass in CI before seeding.

test.describe('Veille IA — public surface', () => {
  test('feed page renders header, subscribe form and diagnostic CTA', async ({ page }) => {
    await page.goto('/veille');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByPlaceholder('votre.email@entreprise.ci')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Diagnostic IA gratuit/i })
    ).toBeVisible();
  });

  test('subscribe form blocks an invalid email (no success state)', async ({ page }) => {
    await page.goto('/veille');
    await page.getByPlaceholder('votre.email@entreprise.ci').fill('not-an-email');
    await page.getByRole('button', { name: /S'abonner/i }).click();
    // Native email validation prevents submit, so the success state never shows.
    await expect(page.getByText(/C'est noté/i)).toHaveCount(0);
  });

  test('unknown article slug shows a recovery message, not a crash', async ({ page }) => {
    await page.goto('/veille/article-inexistant-xyz');
    await expect(page.getByText(/introuvable|indisponible/i)).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Retour à la Veille IA/i })
    ).toBeVisible();
  });
});
