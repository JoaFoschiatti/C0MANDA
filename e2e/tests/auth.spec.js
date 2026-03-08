const { test, expect } = require('@playwright/test');
const { readTestData, loginAsAdmin } = require('./helpers');

test.describe('Auth E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test('login exitoso con email y password', async ({ page }) => {
    await loginAsAdmin(page, testData);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login fallido con credenciales invalidas', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(testData.userEmail);
    await page.locator('input[placeholder="********"]').fill('password-invalido');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('alert')).toContainText(/Credenciales invalidas/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('ruta protegida sin sesion redirige a /login', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout redirige nuevamente a /login', async ({ page }) => {
    await loginAsAdmin(page, testData);
    await page.getByRole('button', { name: /Cerrar sesion/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
