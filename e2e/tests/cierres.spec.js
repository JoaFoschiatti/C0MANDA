const { test, expect } = require('@playwright/test');
const { readTestData, loginAsRole, openAndWait } = require('./helpers');

test.describe('Cierre de Caja E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'CAJERO', testData);
  });

  test('abre y cierra caja desde la UI', async ({ page }) => {
    await openAndWait(page, '/cierre-caja', 'text=Caja');

    await expect(page.getByText(/Caja Cerrada/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /^Abrir Caja$/ }).click();

    await page.locator('#caja-fondo-inicial').fill('1000');
    await page.getByRole('button', { name: /^Abrir Caja$/ }).last().click();

    await expect(page.getByText(/Caja Abierta/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Cerrar Caja/i }).click();

    await expect(page.getByText(/Resumen del Turno/i)).toBeVisible({ timeout: 10000 });
    await page.locator('#caja-efectivo-contado').fill('1000');
    await page.locator('#caja-observaciones').fill(testData.cierreObservaciones);
    await page.getByRole('button', { name: /Confirmar Cierre/i }).click();

    await expect(page.getByText('Caja Cerrada', { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.badge').filter({ hasText: 'Cerrado' }).first()).toBeVisible({ timeout: 10000 });
  });
});
