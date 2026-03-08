const { test, expect } = require('@playwright/test');
const {
  buildDateInputValue,
  createPrisma,
  readTestData,
  seedEmployee
} = require('../support');
const { loginAsAdmin } = require('./helpers');

test.describe('Liquidaciones E2E', () => {
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

  test('crea una liquidacion y la marca como pagada desde la UI', async ({ page }) => {
    const { empleado } = await seedEmployee(prisma, { rol: 'MOZO', tarifaHora: 4200 });

    await page.goto('/liquidaciones');
    await page.getByRole('button', { name: /Nueva Liquidaci/i }).click();

    await page.locator('#liquidacion-empleado').selectOption(String(empleado.id));
    await page.locator('#liquidacion-desde').fill(buildDateInputValue(-14));
    await page.locator('#liquidacion-hasta').fill(buildDateInputValue(-7));
    await page.locator('#liquidacion-horas').fill('10');
    await page.locator('#liquidacion-descuentos').fill('100');
    await page.locator('#liquidacion-adicionales').fill('50');
    await page.locator('#liquidacion-observaciones').fill('Liquidacion E2E');
    await page.getByRole('button', { name: /Crear Liquidaci/i }).click();

    const row = page.locator('tr').filter({
      hasText: `${empleado.nombre} ${empleado.apellido}`
    }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('Pendiente');

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByTitle(/Marcar como pagada/i).click();

    await expect(row).toContainText('Pagado', { timeout: 10000 });
  });
});
