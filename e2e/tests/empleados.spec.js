const { test, expect } = require('@playwright/test');
const { createUniqueSuffix, readTestData } = require('../support');
const { loginAsAdmin } = require('./helpers');

test.describe('Empleados E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('crea, edita y desactiva un empleado desde la UI', async ({ page }) => {
    const suffix = createUniqueSuffix('EMP-UI');
    const nombre = `E2ENombre${suffix.slice(-4)}`;
    const apellido = `E2EApellido${suffix.slice(0, 4)}`;
    const dni = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;

    await page.goto('/empleados');
    await page.getByRole('button', { name: /Nuevo Empleado/i }).click();

    await page.locator('#empleado-nombre').fill(nombre);
    await page.locator('#empleado-apellido').fill(apellido);
    await page.locator('#empleado-dni').fill(dni);
    await page.locator('#empleado-telefono').fill('E2E-EMP-TEL');
    await page.locator('#empleado-rol').selectOption('CAJERO');
    await page.locator('#empleado-tarifa').fill('4500');
    await page.getByRole('button', { name: /^Crear$/ }).click();

    const row = page.locator('tr').filter({ hasText: `${nombre} ${apellido}` }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('CAJERO');

    await row.getByLabel(`Editar empleado: ${nombre} ${apellido}`).click();
    await page.locator('#empleado-tarifa').fill('5000');
    await page.getByRole('button', { name: /^Guardar$/ }).click();

    await expect(row).toContainText('5.000', { timeout: 10000 });

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByLabel(`Desactivar empleado: ${nombre} ${apellido}`).click();

    await expect(row).toContainText('Inactivo', { timeout: 10000 });
  });
});
