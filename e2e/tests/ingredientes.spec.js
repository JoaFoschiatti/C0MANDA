const { test, expect } = require('@playwright/test');
const {
  buildDateInputValue,
  createPrisma,
  createUniqueSuffix,
  readTestData,
  seedExpiredIngredient
} = require('../support');
const { loginAsAdmin } = require('./helpers');

test.describe('Ingredientes E2E', () => {
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

  test('crea un ingrediente y registra una entrada con lote desde la UI', async ({ page }) => {
    const suffix = createUniqueSuffix('ING-UI');
    const ingredientName = `E2E Ingrediente UI ${suffix}`;
    const loteCode = `E2E-LOTE-UI-${suffix}`;

    await page.goto('/ingredientes');
    await page.getByRole('button', { name: /Nuevo Ingrediente/i }).click();

    await page.locator('#ingrediente-nombre').fill(ingredientName);
    await page.locator('#ingrediente-unidad').fill('kg');
    await page.locator('#ingrediente-costo').fill('1500');
    await page.locator('#ingrediente-stock-actual').fill('0');
    await page.locator('#ingrediente-stock-minimo').fill('2');
    await page.getByRole('button', { name: /^Crear$/ }).click();

    const row = page.locator('tr').filter({ hasText: ingredientName }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.getByLabel(`Movimiento de stock: ${ingredientName}`).click();
    await page.locator('#ingrediente-mov-cantidad').fill('5');
    await page.locator('#ingrediente-mov-lote').fill(loteCode);
    await page.locator('#ingrediente-mov-vencimiento').fill(buildDateInputValue(15));
    await page.locator('#ingrediente-mov-costo').fill('1600');
    await page.locator('#ingrediente-mov-motivo').fill('Compra E2E');
    await page.getByRole('button', { name: /^Registrar$/ }).click();

    await expect(row).toContainText('5.00 kg', { timeout: 10000 });
    await expect(row).toContainText('OK');
  });

  test('abre el descarte por deep link y descarta un lote vencido real', async ({ page }) => {
    const { ingrediente, lote } = await seedExpiredIngredient(prisma);

    await page.goto(`/ingredientes?ingredienteId=${ingrediente.id}&loteId=${lote.id}&action=descartar`);
    await expect(
      page.getByText(`Descartar lote vencido: ${ingrediente.nombre}`)
    ).toBeVisible({ timeout: 10000 });

    await page.locator('#ingrediente-descarte-motivo').fill('Control bromatologico E2E');
    await page.getByRole('button', { name: /Confirmar descarte/i }).click();

    await expect(
      page.getByText(`Descartar lote vencido: ${ingrediente.nombre}`)
    ).toHaveCount(0, { timeout: 10000 });
    await expect(
      page.getByLabel(`Descartar lotes vencidos: ${ingrediente.nombre}`)
    ).toHaveCount(0);
  });
});
