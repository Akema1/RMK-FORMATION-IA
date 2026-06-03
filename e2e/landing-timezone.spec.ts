import { test, expect } from '@playwright/test';

/**
 * Guard against regression of P1-B (TZ-unsafe date parsing).
 *
 * Atelier S1 starts 2026-07-07T08:30:00Z (Abidjan, UTC+0, no DST).
 * We pin the browser to Europe/Paris (UTC+2 in July) and freeze its
 * clock to 2026-07-01T08:30:00Z — exactly 6 days before the target.
 *
 * Expected render: Jours=06, Heures=00 — regardless of timezone.
 *
 * If somebody later drops the Z suffix on "2026-07-07T08:30:00",
 * Paris interpretation puts the target 2h earlier in Unix ms, the
 * diff becomes 5d22h, and this test fails at Jours=05 / Heures=22.
 */

test.describe('Hero countdown — timezone anchoring', () => {
  test('renders UTC-anchored diff when visitor is in Europe/Paris', async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: 'Europe/Paris' });
    const page = await context.newPage();

    await page.addInitScript(() => {
      // 2026-07-01T08:30:00Z — exactly 6 days before the Atelier start.
      const fixedNow = Date.UTC(2026, 6, 1, 8, 30, 0);
      Date.now = () => fixedNow;
    });

    await page.goto('/');

    const joursLabel = page.getByText('Jours', { exact: true }).first();
    await expect(joursLabel).toBeVisible({ timeout: 10_000 });

    const joursTile = joursLabel.locator('xpath=..');
    await expect(joursTile).toContainText('06');

    const heuresTile = page.getByText('Heures', { exact: true }).first().locator('xpath=..');
    await expect(heuresTile).toContainText('00');

    await context.close();
  });
});
