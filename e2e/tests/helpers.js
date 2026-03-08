const { expect } = require('@playwright/test');
const path = require('path');
const {
  SCREENSHOTS_DIR,
  appendQaReport,
  readTestData,
  buildFutureLocalDateTime
} = require('../support');

const ROLE_HOME_PATTERNS = {
  ADMIN: /\/dashboard/,
  MOZO: /\/mozo\/mesas/,
  COCINERO: /\/dashboard/,
  CAJERO: /\/dashboard/,
  DELIVERY: /\/delivery\/pedidos/
};

const buildLocator = (page, readyTarget) => (
  typeof readyTarget === 'string' ? page.locator(readyTarget).first() : readyTarget
);

const waitForAppReady = async (page, readyTarget, timeout = 15000) => {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Cargando interfaz...')).toHaveCount(0, { timeout });

  if (readyTarget) {
    await expect(buildLocator(page, readyTarget)).toBeVisible({ timeout });
  }
};

const openAndWait = async (page, url, readyTarget, timeout = 15000) => {
  await page.goto(url);
  await waitForAppReady(page, readyTarget, timeout);
};

const getRoleCredentials = (testData, role) => {
  if (role === 'ADMIN') {
    return {
      email: testData.userEmail,
      password: testData.userPassword,
      nombre: testData.userName,
      rol: 'ADMIN'
    };
  }

  const data = testData.roles?.[role.toLowerCase()];
  if (!data) {
    throw new Error(`No hay credenciales E2E para el rol ${role}`);
  }

  return data;
};

const loginAsRole = async (page, role, testData = readTestData()) => {
  const credentials = getRoleCredentials(testData, role);
  await page.goto('/login');
  await waitForAppReady(page, 'input[type="email"]');
  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[placeholder="********"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(ROLE_HOME_PATTERNS[role], { timeout: 15000 });
  await expect(page.getByText(credentials.nombre).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Cargando interfaz...')).toHaveCount(0, { timeout: 15000 });
  return credentials;
};

const loginAsAdmin = async (page, testData = readTestData()) => loginAsRole(page, 'ADMIN', testData);

const saveQaScreenshot = async (page, name, entry) => {
  const fileName = `${name}.png`;
  const filePath = path.join(SCREENSHOTS_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  appendQaReport({
    ...entry,
    screenshot: filePath
  });
  return filePath;
};

module.exports = {
  getRoleCredentials,
  loginAsRole,
  readTestData,
  loginAsAdmin,
  buildFutureLocalDateTime,
  openAndWait,
  saveQaScreenshot,
  waitForAppReady
};
