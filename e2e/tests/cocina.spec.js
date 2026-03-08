const { test, expect } = require('@playwright/test');
const { createPrisma, readTestData, seedKitchenPedido } = require('../support');
const { loginAsRole, openAndWait } = require('./helpers');

test.describe('Cocina E2E', () => {
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
    await loginAsRole(page, 'COCINERO', testData);
  });

  test('inicia preparacion y marca un pedido como listo', async ({ page }) => {
    const { pedido } = await seedKitchenPedido(prisma, {
      productoId: testData.productId,
      usuarioId: testData.userId,
      tipo: 'MOSTRADOR'
    });

    await openAndWait(page, '/cocina', 'text=Cocina');

    const pedidoCard = page.locator('.card').filter({ hasText: `#${pedido.id}` }).first();
    await expect(pedidoCard).toBeVisible({ timeout: 10000 });
    await pedidoCard.getByRole('button', { name: /Iniciar Preparaci/i }).click();
    await expect(pedidoCard.getByRole('button', { name: /Marcar Listo/i })).toBeVisible({ timeout: 10000 });

    await pedidoCard.getByRole('button', { name: /Marcar Listo/i }).click();
    await expect(page.getByText(`#${pedido.id}`)).toHaveCount(0, { timeout: 10000 });
  });
});
