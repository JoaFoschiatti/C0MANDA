const { test, expect } = require('@playwright/test');
const { readTestData, loginAsAdmin } = require('./helpers');

test.describe('Categorias E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('lista la categoria base de la instalacion', async ({ page }) => {
    await page.goto('/categorias');
    await expect(page.getByText(testData.baseCategoryName)).toBeVisible({ timeout: 10000 });
  });

  test('crea una categoria nueva desde la UI', async ({ page }) => {
    await page.goto('/categorias');

    await page.getByRole('button', { name: /Nueva/i }).click();
    await page.locator('#categoria-nombre').fill(testData.createdCategoryName);
    await page.locator('#categoria-descripcion').fill('Categoria creada por la suite E2E');
    await page.locator('#categoria-orden').fill('2');
    await page.getByRole('button', { name: /^Crear$/ }).click();

    await expect(page.getByText(testData.createdCategoryName)).toBeVisible({ timeout: 10000 });
  });
});
