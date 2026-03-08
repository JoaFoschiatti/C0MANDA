const { test, expect } = require('@playwright/test');
const { readTestData } = require('../support');
const { openAndWait } = require('./helpers');

test.describe('Menu Publico E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test('permite agregar al carrito y confirmar un pedido en efectivo', async ({ page }) => {
    await openAndWait(page, '/menu', `text=${testData.productName}`);

    const productCard = page.locator('article').filter({ hasText: testData.productName }).first();
    await productCard.getByRole('button', { name: /Agregar/i }).click();

    await expect(page.getByText(testData.productName).last()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Continuar pedido/i }).click();
    await expect(page.getByRole('heading', { name: /Confirmar pedido/i })).toBeVisible({ timeout: 10000 });

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Retiro/i }).click();
    await dialog.getByLabel('Nombre').fill('E2E Cliente Publico');
    await dialog.getByLabel('Telefono').fill('3415553030');
    await dialog.getByLabel('Email').fill('publico.e2e@comanda.local');
    await dialog.getByLabel('Con cuanto abonas').fill('5000');
    await dialog.getByRole('button', { name: /Confirmar pedido/i }).click();

    await expect(page.getByText(/Pedido confirmado/i)).toBeVisible({ timeout: 10000 });
  });
});
