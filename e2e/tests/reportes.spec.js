const { test, expect } = require('@playwright/test');
const { createPrisma, readTestData, seedPaidOrderForReports } = require('../support');
const { loginAsAdmin, openAndWait } = require('./helpers');

test.describe('Reportes E2E', () => {
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
    await loginAsAdmin(page, testData);
  });

  test('muestra ventas y permite cambiar a consumo de insumos', async ({ page }) => {
    const producto = await prisma.producto.findFirst({
      where: { nombre: 'Hamburguesa Clasica' },
      select: { id: true }
    });

    await seedPaidOrderForReports(prisma, {
      productoId: producto.id,
      total: 85000,
      usuarioId: testData.userId
    });

    await openAndWait(page, '/reportes', '#reportes-fecha-desde');
    await expect(page.getByText(/Total Ventas/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Hamburguesa Clasica/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Consumo de Insumos/i }).click();
    await expect(page.getByRole('heading', { name: /Consumo de Insumos/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
  });
});
