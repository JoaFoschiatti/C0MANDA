const { test, expect } = require('@playwright/test');
const { createUniqueSuffix, readTestData } = require('../support');
const { loginAsAdmin, openAndWait } = require('./helpers');

test.describe('Productos E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('crea un producto nuevo y lo muestra en la vista plana', async ({ page }) => {
    const productName = `${testData.productName} ${createUniqueSuffix('UI')}`;

    await openAndWait(page, '/productos', 'button:has-text("Nuevo Producto")');
    await page.getByRole('button', { name: /Vista plana/i }).click();
    await page.getByRole('button', { name: /Nuevo Producto/i }).click();

    await page.locator('#producto-nombre').fill(productName);
    await page.locator('#producto-descripcion').fill('Producto creado desde Playwright E2E');
    await page.locator('#producto-precio').fill('6900');
    await page.locator('#producto-categoria').selectOption(String(testData.baseCategoryId));
    await page.getByRole('button', { name: /^Crear$/ }).click();

    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
  });
});
