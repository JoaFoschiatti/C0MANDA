const { test, expect } = require('@playwright/test');
const { createUniqueSuffix, readTestData } = require('../support');
const { loginAsAdmin, openAndWait, waitForAppReady } = require('./helpers');

test.describe('Configuracion E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('guarda un cambio del negocio y lo persiste tras recargar', async ({ page }) => {
    await openAndWait(page, '/configuracion', '#negocio-nombre');

    const telefonoOriginal = await page.locator('#negocio-telefono').inputValue();
    const telefonoNuevo = `341-${createUniqueSuffix('TEL').slice(-8)}`;

    try {
      await page.locator('#negocio-telefono').fill(telefonoNuevo);
      await page.getByRole('button', { name: /Guardar Datos del Negocio/i }).click();
      await expect(page.locator('#negocio-telefono')).toHaveValue(telefonoNuevo, { timeout: 10000 });

      await page.reload();
      await waitForAppReady(page, '#negocio-telefono');
      await expect(page.locator('#negocio-telefono')).toHaveValue(telefonoNuevo, { timeout: 10000 });
    } finally {
      await page.locator('#negocio-telefono').fill(telefonoOriginal);
      await page.getByRole('button', { name: /Guardar Datos del Negocio/i }).click();
      await expect(page.locator('#negocio-telefono')).toHaveValue(telefonoOriginal, { timeout: 10000 });
    }
  });
});
