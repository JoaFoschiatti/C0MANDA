const { test, expect } = require('@playwright/test');
const {
  readTestData,
  loginAsAdmin,
  buildFutureLocalDateTime,
  openAndWait
} = require('./helpers');

test.describe('Reservas E2E', () => {
  let testData;

  test.beforeAll(() => {
    testData = readTestData();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page, testData);
  });

  test('crea una reserva para la mesa base', async ({ page }) => {
    await openAndWait(page, '/reservas', '#reservas-fecha');

    const fechaHora = buildFutureLocalDateTime(5);
    const fechaReserva = fechaHora.split('T')[0];

    await page.getByRole('button', { name: /Nueva Reserva/i }).click();
    await page.locator('#reserva-mesa').selectOption(String(testData.baseMesaId));
    await page.locator('#reserva-fecha-hora').fill(fechaHora);
    await page.locator('#reserva-cliente-nombre').fill(testData.reservationClientName);
    await page.locator('#reserva-cliente-telefono').fill('3415550101');
    await page.locator('#reserva-cantidad-personas').fill('4');
    await page.locator('#reserva-observaciones').fill('E2E reserva desde Playwright');
    await page.getByRole('button', { name: /Crear Reserva/i }).click();

    await page.locator('#reservas-fecha').fill(fechaReserva);
    await expect(page.getByText(testData.reservationClientName)).toBeVisible({ timeout: 10000 });
  });
});
