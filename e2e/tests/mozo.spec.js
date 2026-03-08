const { test, expect } = require('@playwright/test');
const { createPrisma, readTestData } = require('../support');
const { loginAsRole, openAndWait } = require('./helpers');

test.describe('Mozo E2E', () => {
  let prisma;
  let testData;

  test.beforeAll(() => {
    prisma = createPrisma();
    testData = readTestData();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'MOZO', testData);
  });

  test('crea un pedido de mesa desde el flujo de mozo', async ({ page }) => {
    const mesa = await prisma.mesa.create({
      data: {
        numero: Number.parseInt(`98${Date.now().toString().slice(-4)}`, 10),
        zona: 'Salon Mozo E2E',
        capacidad: 4,
        estado: 'LIBRE',
        activa: true
      }
    });

    await openAndWait(page, '/mozo/mesas', `button:has-text("${mesa.numero}")`);

    const mesaButton = page.locator('button').filter({ hasText: String(mesa.numero) }).first();
    await mesaButton.click();

    await expect(page).toHaveURL(new RegExp(`/mozo/nuevo-pedido/${mesa.id}`), { timeout: 10000 });
    await expect(page.getByText(`Mesa ${mesa.numero}`)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: new RegExp(testData.baseCategoryName, 'i') }).click();
    await page.locator('button').filter({ hasText: testData.productName }).first().click();
    await expect(page.getByText(testData.productName).last()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Confirmar Pedido/i }).click();

    await expect(page).toHaveURL(/\/mozo\/mesas/, { timeout: 10000 });
    await expect(mesaButton).toContainText(/Pedido #/i, { timeout: 10000 });
  });
});
