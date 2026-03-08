const { test, expect } = require('@playwright/test');
const { createUniqueSuffix, readTestData } = require('../support');
const { loginAsAdmin, openAndWait } = require('./helpers');

test.describe('Modificadores E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('crea y edita un modificador adicional', async ({ page }) => {
    const modifierName = `${createUniqueSuffix('MOD')} queso`;

    await openAndWait(page, '/modificadores', 'button:has-text("Nuevo Modificador")');
    await page.getByRole('button', { name: /Nuevo Modificador/i }).click();

    await page.locator('#modificador-tipo').selectOption('ADICION');
    await page.locator('#modificador-nombre').fill(modifierName);
    await page.locator('#modificador-precio').fill('500');
    await page.getByRole('button', { name: /^Crear$/ }).click();

    const row = page.locator('.card').filter({ hasText: modifierName }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(/500/i);

    await row.getByLabel(`Editar modificador: ${modifierName}`).click();
    await page.locator('#modificador-precio').fill('750');
    await page.getByRole('button', { name: /Guardar Cambios/i }).click();

    await expect(row).toContainText(/750/i, { timeout: 10000 });
  });
});
