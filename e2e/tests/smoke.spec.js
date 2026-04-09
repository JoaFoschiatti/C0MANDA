const { test, expect } = require('@playwright/test');
const { loadSmokeContext, loginAsAdmin } = require('./helpers');

const apiBaseUrl = (process.env.BACKEND_URL || process.env.PLAYWRIGHT_BACKEND_URL || process.env.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

test.describe('Release smoke', () => {
  let smokeContext;

  test.beforeAll(() => {
    smokeContext = loadSmokeContext();
  });

  test('health endpoint responde', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/api/health`);

    expect(response.ok()).toBeTruthy();
  });

  test('login y dashboard cargan', async ({ page }) => {
    await loginAsAdmin(page, smokeContext, { expectName: false });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });
  });

  test('menu publico renderiza', async ({ page }) => {
    await page.goto('/menu');
    await expect(page).toHaveURL(/\/menu/, { timeout: 10000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 });

    if (smokeContext.productName) {
      await expect(page.getByText(smokeContext.productName)).toBeVisible({
        timeout: 10000
      });
    }
  });
});
