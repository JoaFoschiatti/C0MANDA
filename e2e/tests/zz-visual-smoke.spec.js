const { test, expect } = require('@playwright/test');
const {
  buildDateInputValue,
  createPrisma,
  readTestData,
  seedCobradoTaskPedido,
  seedExpiredIngredient
} = require('../support');
const {
  loginAsAdmin,
  openAndWait,
  saveQaScreenshot
} = require('./helpers');

test.describe('Visual Smoke Desktop', () => {
  let prisma;
  let testData;

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    prisma = createPrisma();
    testData = readTestData();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('captura estados principales del admin y menu publico', async ({ page }) => {
    const reservaFechaVacia = buildDateInputValue(60);
    const reservaFechaConDato = buildDateInputValue(61);

    await openAndWait(page, '/login', 'input[type="email"]');
    await saveQaScreenshot(page, 'desktop-login', {
      route: '/login',
      role: 'anon',
      state: 'formulario-visible',
      result: 'PASS',
      defect: null
    });

    await loginAsAdmin(page, testData);

    await openAndWait(page, '/dashboard', 'h1:has-text("Dashboard")');
    await saveQaScreenshot(page, 'desktop-dashboard', {
      route: '/dashboard',
      role: 'ADMIN',
      state: 'cards-cargadas',
      result: 'PASS',
      defect: null
    });

    await openAndWait(page, '/reservas', '#reservas-fecha');
    await page.locator('#reservas-fecha').fill(reservaFechaVacia);
    await expect(page.getByText(/No hay reservas para esta fecha/i)).toBeVisible({ timeout: 10000 });
    await saveQaScreenshot(page, 'desktop-reservas-empty', {
      route: '/reservas',
      role: 'ADMIN',
      state: 'vacio',
      result: 'PASS',
      defect: null
    });

    await prisma.reserva.create({
      data: {
        mesaId: testData.baseMesaId,
        clienteNombre: 'E2E Visual Reserva',
        clienteTelefono: '3415554040',
        fechaHora: new Date(`${reservaFechaConDato}T20:00:00.000Z`),
        cantidadPersonas: 4,
        observaciones: 'Reserva visual Playwright'
      }
    });

    await page.locator('#reservas-fecha').fill(reservaFechaConDato);
    await expect(page.getByText('E2E Visual Reserva')).toBeVisible({ timeout: 10000 });
    await saveQaScreenshot(page, 'desktop-reservas-populated', {
      route: '/reservas',
      role: 'ADMIN',
      state: 'con-reserva-visible',
      result: 'PASS',
      defect: null
    });

    await openAndWait(page, '/ingredientes', 'text=Ingredientes / Stock');
    await saveQaScreenshot(page, 'desktop-ingredientes', {
      route: '/ingredientes',
      role: 'ADMIN',
      state: 'tabla-cargada',
      result: 'PASS',
      defect: null
    });

    await seedExpiredIngredient(prisma);
    await seedCobradoTaskPedido(prisma, { usuarioId: testData.userId });
    await openAndWait(page, '/tareas', 'text=Tareas');
    await saveQaScreenshot(page, 'desktop-tareas', {
      route: '/tareas',
      role: 'ADMIN',
      state: 'resumen-visible',
      result: 'PASS',
      defect: null
    });

    await openAndWait(page, '/menu', `text=${testData.productName}`);
    await saveQaScreenshot(page, 'desktop-menu-empty', {
      route: '/menu',
      role: 'publico',
      state: 'catalogo-visible',
      result: 'PASS',
      defect: null
    });

    const productCard = page.locator('article').filter({ hasText: testData.productName }).first();
    await productCard.getByRole('button', { name: /Agregar/i }).click();
    await saveQaScreenshot(page, 'desktop-menu-cart', {
      route: '/menu',
      role: 'publico',
      state: 'carrito-con-item',
      result: 'PASS',
      defect: null
    });
  });
});

test.describe('Visual Smoke Mobile', () => {
  let testData;

  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  test.beforeAll(() => {
    testData = readTestData();
  });

  test('captura menu publico y menu por mesa en mobile', async ({ page }) => {
    await openAndWait(page, '/menu', `text=${testData.productName}`);
    await saveQaScreenshot(page, 'mobile-menu', {
      route: '/menu',
      role: 'publico',
      state: 'catalogo-mobile',
      result: 'PASS',
      defect: null
    });

    const productCard = page.locator('article').filter({ hasText: testData.productName }).first();
    await productCard.getByRole('button', { name: /Agregar/i }).click();
    await saveQaScreenshot(page, 'mobile-menu-cart', {
      route: '/menu',
      role: 'publico',
      state: 'carrito-mobile',
      result: 'PASS',
      defect: null
    });
  });
});
