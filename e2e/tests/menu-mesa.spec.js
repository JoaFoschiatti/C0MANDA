const { test, expect } = require('@playwright/test');
const { readTestData } = require('../support');
const { openAndWait } = require('./helpers');

test.describe('Menu Mesa Publico E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test('permite enviar un pedido desde el QR de mesa', async ({ page }) => {
    await openAndWait(page, `/menu/mesa/${testData.baseMesaQrToken}`, `text=Mesa ${testData.baseMesaNumber}`);

    const productCard = page.locator('article').filter({ hasText: testData.productName }).first();
    await productCard.getByRole('button', { name: /Agregar/i }).click();

    await page.getByLabel('Nombre').fill('E2E Cliente Mesa');
    await page.getByRole('button', { name: /Enviar a mesa/i }).click();

    await expect(page.getByText(/enviado correctamente a la mesa/i)).toBeVisible({ timeout: 10000 });
  });
});
