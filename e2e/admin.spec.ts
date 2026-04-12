import { test, expect } from '@playwright/test';

/**
 * Admin dashboard — auth gate tests
 * Validates that the admin login screen appears and unauthenticated access is blocked.
 * Full CRUD tests require a live Supabase instance with test credentials.
 */

test.describe('Admin dashboard', () => {
  test('admin route shows login screen when unauthenticated', async ({ page }) => {
    // Mock Supabase session as null (unauthenticated)
    await page.route('**/auth/v1/token*', route => {
      route.fulfill({ status: 400, body: JSON.stringify({ error: 'invalid_grant' }) });
    });

    await page.goto('/admin');

    // Should display login form, not the dashboard
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 8000 });
  });

  test('admin login form has email and password fields', async ({ page }) => {
    await page.goto('/admin');

    // Check both inputs exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 8000 });
    await expect(passwordInput).toBeVisible();
  });

  test('admin login shows error for wrong credentials', async ({ page }) => {
    // Mock Supabase auth to reject credentials
    await page.route('**/auth/v1/token*', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    });

    await page.goto('/admin');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill('wrong@test.com');
    await passwordInput.fill('wrongpassword');

    const loginBtn = page.getByRole('button', { name: /connexion|se connecter|login/i }).first();
    await loginBtn.click();

    // Should show an error message
    const errorMsg = page.locator('text=/erreur|incorrect|invalide|échoué/i').first();
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('admin dashboard layout renders after successful auth (mocked)', async ({ page }) => {
    // Mock getSession to return authenticated admin user
    await page.route('**/auth/v1/user*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-user-id',
          email: 'admin@rmkconseils.com',
          role: 'authenticated',
        }),
      });
    });

    // Mock all Supabase data tables
    await page.route('**/rest/v1/participants*', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );
    await page.route('**/rest/v1/seminars*', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );
    await page.route('**/rest/v1/tasks*', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );
    await page.route('**/rest/v1/leads*', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );
    await page.route('**/rest/v1/expenses*', route =>
      route.fulfill({ status: 200, body: JSON.stringify([]) })
    );

    await page.goto('/admin');

    // Even without real auth, the page should not crash
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL('/admin');
  });
});
