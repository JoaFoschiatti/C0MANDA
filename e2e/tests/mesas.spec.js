const { test, expect } = require('@playwright/test');
const { readTestData, loginAsAdmin } = require('./helpers');

test.describe('Mesas E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('muestra la mesa base en la vista de configuracion', async ({ page }) => {
    await page.goto('/mesas');
    await expect(page.getByText(String(testData.baseMesaNumber))).toBeVisible({ timeout: 10000 });
  });

  test('crea una mesa nueva desde la UI', async ({ page }) => {
    await page.goto('/mesas');

    await page.getByRole('button', { name: /Nueva Mesa/i }).click();
    await page.locator('#mesa-numero').fill(String(testData.extraMesaNumber));
    await page.locator('#mesa-capacidad').fill('6');
    await page.getByRole('button', { name: /^Crear$/ }).click();

    await expect(page.getByText(String(testData.extraMesaNumber))).toBeVisible({ timeout: 10000 });
  });
});
