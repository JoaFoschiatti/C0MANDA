const { test, expect } = require('@playwright/test');
const { readTestData, loginAsAdmin } = require('./helpers');

test.describe('Pedidos E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('crea un pedido manual de mostrador con el producto base', async ({ page }) => {
    await page.goto('/pedidos');

    await page.getByRole('button', { name: /Nuevo Pedido/i }).click();
    await expect(page.getByText('Nuevo Pedido Manual')).toBeVisible({ timeout: 10000 });

    await page.locator('#pedido-cliente').fill(testData.orderClientName);
    await page.getByRole('button', { name: new RegExp(testData.baseCategoryName, 'i') }).click();
    await page.locator('button').filter({ hasText: testData.productName }).first().click();

    await expect(page.getByText(testData.productName)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Crear Pedido/i }).click();

    await expect(page.getByText(testData.orderClientName)).toBeVisible({ timeout: 10000 });
  });
});
