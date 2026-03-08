const { test, expect } = require('@playwright/test');
const {
  createPrisma,
  readTestData,
  seedMercadoPagoTransaction
} = require('../support');
const { loginAsAdmin, openAndWait } = require('./helpers');

test.describe('Transacciones MercadoPago E2E', () => {
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

  test('lista una transaccion aprobada y navega al pedido asociado', async ({ page }) => {
    const { pedido, transaccion } = await seedMercadoPagoTransaction(prisma, {
      productoId: testData.productId,
      total: 6400,
      payerEmail: 'payer.tx.e2e@comanda.local'
    });

    await openAndWait(page, '/transacciones-mp', 'button:has-text("Filtros")');
    await page.getByRole('button', { name: /Filtros/i }).click();
    await page.locator('#tx-estado').selectOption('approved');

    await expect(page.getByText(transaccion.payerEmail)).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: `#${pedido.id}` }).click();

    await expect(page).toHaveURL(/\/pedidos/, { timeout: 10000 });
    await expect(page.getByText(pedido.clienteNombre).first()).toBeVisible({ timeout: 10000 });
  });
});
