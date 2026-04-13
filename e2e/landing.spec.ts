import { test, expect } from '@playwright/test';

/**
 * Landing page — smoke & critical UI tests
 * Validates that the public-facing page loads correctly and key elements are visible.
 */

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the hero section', async ({ page }) => {
    // RMK logo or brand name visible
    await expect(page.locator('h1, [data-testid="hero-title"]').first()).toBeVisible();
  });

  test('displays at least one seminar card', async ({ page }) => {
    // Seminars section should be rendered
    await page.getByText('Séminaires', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
    // Each seminar card has a title — expect at least 1
    const seminarTitles = page.locator('h3');
    await expect(seminarTitles.first()).toBeVisible();
    const count = await seminarTitles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('has an inscription CTA button', async ({ page }) => {
    const ctas = page.getByRole('button', { name: /inscrire|inscription|commencer/i });
    await expect(ctas.first()).toBeVisible();
  });

  test('navbar links are present', async ({ page }) => {
    // At minimum the page renders a navigation element
    const navOrHeader = page.locator('nav, header').first();
    await expect(navOrHeader).toBeVisible();
  });

  test('page has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Filter known false-positive errors (e.g. third-party fonts)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('fonts.googleapis') &&
      !e.includes('net::ERR_')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
