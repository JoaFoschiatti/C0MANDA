const { test, expect } = require('@playwright/test');
const {
  createPrisma,
  readTestData,
  seedCobradoTaskPedido,
  seedExpiredIngredient
} = require('../support');
const { loginAsAdmin } = require('./helpers');

test.describe('Tareas E2E', () => {
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

  test('resuelve el flujo de caja: cerrar pedido y liberar mesa', async ({ page }) => {
    const { mesa, pedido } = await seedCobradoTaskPedido(prisma, { usuarioId: testData.userId });

    await page.goto('/tareas');

    const pedidoCard = page.locator('.card').filter({
      hasText: `Pedido #${pedido.id} pendiente de cierre`
    }).first();
    await expect(pedidoCard).toBeVisible({ timeout: 10000 });
    await pedidoCard.getByRole('button', { name: /Cerrar pedido/i }).click();

    const mesaCard = page.locator('.card').filter({
      hasText: `Mesa ${mesa.numero} pendiente de liberacion`
    }).first();
    await expect(mesaCard).toBeVisible({ timeout: 10000 });
    await mesaCard.getByRole('button', { name: /Liberar mesa/i }).click();

    await expect(
      page.getByText(`Mesa ${mesa.numero} pendiente de liberacion`)
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('abre una tarea de stock y llega al descarte enfocado del ingrediente', async ({ page }) => {
    const { ingrediente, lote } = await seedExpiredIngredient(prisma);

    await page.goto('/tareas');

    const stockCard = page.locator('.card').filter({
      hasText: `Lote ${lote.codigoLote} vencido`
    }).first();
    await expect(stockCard).toBeVisible({ timeout: 10000 });
    await stockCard.getByRole('link', { name: /^Abrir$/ }).click();

    await expect(page).toHaveURL(
      new RegExp(`/ingredientes\\?ingredienteId=${ingrediente.id}.*loteId=${lote.id}.*action=descartar`),
      { timeout: 10000 }
    );
    await expect(
      page.getByText(`Descartar lote vencido: ${ingrediente.nombre}`)
    ).toBeVisible({ timeout: 10000 });
  });
});
