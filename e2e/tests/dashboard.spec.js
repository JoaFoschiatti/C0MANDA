const { test, expect } = require('@playwright/test');
const {
  createPrisma,
  readTestData,
  seedCobradoTaskPedido,
  seedExpiredIngredient
} = require('../support');
const { loginAsAdmin } = require('./helpers');

test.describe('Dashboard E2E', () => {
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

  test('muestra alertas reales de stock vencido y tareas de alta prioridad', async ({ page }) => {
    await seedExpiredIngredient(prisma);
    await seedCobradoTaskPedido(prisma, { usuarioId: testData.userId });

    await page.goto('/dashboard');

    await expect(
      page.getByText(/lotes vencidos pendientes de descarte manual/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/tareas operativas de alta prioridad pendientes/i)
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: /Abrir tareas/i }).click();
    await expect(page).toHaveURL(/\/tareas/, { timeout: 10000 });
  });
});
