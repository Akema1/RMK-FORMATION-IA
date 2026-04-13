/**
 * Authenticated E2E tests for the admin AI agents.
 *
 * Validates the fixes landed in 5dc9735:
 *  - Client `callAI()` sends the new { templateId, vars, userPrompt } shape
 *    instead of the old { systemPrompt, messages, tools } shape.
 *  - Commercial agent uses server-side stats injection (no tool-call loop).
 *  - AI requests succeed (Zod parsing + AI Gateway path intact).
 *
 * Credentials come from env vars so they never touch git:
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npx playwright test admin-ai-agents
 *
 * Optional for preview testing:
 *   E2E_BASE=https://preview.vercel.app E2E_COOKIE="_vercel_jwt=..." ...
 */
import { test, expect } from '@playwright/test';

const API_BASE = process.env.E2E_BASE || 'http://localhost:8080';
const EXTRA_COOKIE = process.env.E2E_COOKIE || '';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';

if (EXTRA_COOKIE) {
  test.use({ extraHTTPHeaders: { Cookie: EXTRA_COOKIE } });
}

// AI calls via Claude Haiku can take 30-120s on long prompts. Raise well
// above Playwright's 30s default.
test.describe.configure({ timeout: 240_000 });

test.beforeEach(async ({ page }) => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated tests'
  );
  await page.goto(`${API_BASE}/admin`);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(
    page.getByText('RMK CONSEILS', { exact: false }).first()
  ).toBeVisible({ timeout: 15_000 });
});

test.describe('Admin AI agents — request shape and live call', () => {
  test('Commercial agent sends new { templateId, vars } shape and never sends legacy { systemPrompt }', async ({
    page,
  }) => {
    // Passive observation — no route interception. Capture the outgoing
    // request body on the way out, then separately wait for the response.
    let capturedBody: any = null;
    page.on('request', (req) => {
      if (req.url().includes('/api/ai/generate') && req.method() === 'POST') {
        try {
          capturedBody = req.postDataJSON();
        } catch {
          capturedBody = { _parseFailed: true };
        }
      }
    });

    await page
      .getByRole('button', { name: /Agent Commercial/i })
      .first()
      .click();

    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/ai/generate') &&
        r.request().method() === 'POST',
      { timeout: 180_000 }
    );
    await page
      .getByRole('button', { name: /Lancer la prospection/i })
      .click();
    const response = await responsePromise;

    // Request shape assertions — the core of the refactor.
    expect(capturedBody, 'POST body should be captured').toBeTruthy();
    expect(capturedBody.templateId).toBe('commercial');
    expect(capturedBody.vars).toBeDefined();
    expect(capturedBody.vars.seminarId).toMatch(/^s[1-4]$/);
    expect(capturedBody).not.toHaveProperty('systemPrompt');
    expect(capturedBody).not.toHaveProperty('tools');

    // Response assertions.
    expect(
      response.status(),
      `/api/ai/generate returned ${response.status()}`
    ).toBe(200);
    const body = await response.json();
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(100);
  });

  test('SEO agent sends { templateId: "seo" } and receives text', async ({
    page,
  }) => {
    let capturedBody: any = null;
    page.on('request', (req) => {
      if (req.url().includes('/api/ai/generate') && req.method() === 'POST') {
        capturedBody = req.postDataJSON();
      }
    });

    await page.getByRole('button', { name: /Agent SEO/i }).first().click();

    // SEO agent requires a keyword in the input before "Générer Stratégie SEO"
    // fires the request. Clicking with an empty input silently no-ops client-side.
    const keywordInput = page
      .getByPlaceholder(/Formation IA|mot[\s-]?cl/i)
      .first();
    await keywordInput.waitFor({ state: 'visible', timeout: 10_000 });
    await keywordInput.fill('Formation IA pour DRH Abidjan');

    const generateButton = page.getByRole('button', {
      name: /Générer Stratégie SEO/i,
    });

    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/ai/generate') &&
        r.request().method() === 'POST',
      { timeout: 180_000 }
    );
    await generateButton.click();
    const response = await responsePromise;

    expect(capturedBody).toBeTruthy();
    expect(capturedBody.templateId).toBe('seo');
    expect(capturedBody).not.toHaveProperty('systemPrompt');
    expect(response.status()).toBe(200);
  });
});
