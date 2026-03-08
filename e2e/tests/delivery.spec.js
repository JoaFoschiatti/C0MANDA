const { test, expect } = require('@playwright/test');
const { createPrisma, readTestData, seedDeliveryPedido } = require('../support');
const { loginAsRole, openAndWait } = require('./helpers');

test.describe('Delivery E2E', () => {
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
    await loginAsRole(page, 'DELIVERY', testData);
  });

  test('marca un pedido listo como entregado', async ({ page }) => {
    const { pedido } = await seedDeliveryPedido(prisma, {
      productoId: testData.productId
    });

    await openAndWait(page, '/delivery/pedidos', 'text=Mis Entregas');

    const pedidoCard = page.locator('.card').filter({ hasText: pedido.clienteNombre }).first();
    await expect(pedidoCard).toBeVisible({ timeout: 10000 });
    await pedidoCard.getByRole('button', { name: /Marcar como Entregado/i }).click();

    await expect(page.getByText(pedido.clienteNombre)).toHaveCount(0, { timeout: 10000 });
  });
});
