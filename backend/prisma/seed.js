const { loadRuntimeEnv } = require('../src/config/load-env');
const { PrismaClient } = require('@prisma/client');
const { bootstrapCore } = require('../src/services/bootstrap.service');
const { resetVisualSeedState, seedVisualData } = require('../src/services/visual-seed.service');

loadRuntimeEnv();

const DEMO_CREDENTIALS = [
  { rol: 'ADMIN', email: 'admin@comanda.local', password: 'admin123' },
  { rol: 'MOZO', email: 'mozo@comanda.local', password: 'mozo123' },
  { rol: 'MOZO 2', email: 'mozo2@comanda.local', password: 'mozo123' },
  { rol: 'COCINERO', email: 'cocinero@comanda.local', password: 'cocinero123' },
  { rol: 'CAJERO', email: 'cajero@comanda.local', password: 'cajero123' },
  { rol: 'DELIVERY', email: 'delivery@comanda.local', password: 'delivery123' }
];

const prisma = new PrismaClient();

const printBlock = (title, lines) => {
  console.log(`\n${title}`);
  lines.forEach((line) => console.log(`- ${line}`));
};

async function main() {
  await resetVisualSeedState(prisma);

  await bootstrapCore(prisma, {
    negocioNombre: process.env.SEED_NEGOCIO_NOMBRE || 'Comanda Demo',
    negocioEmail: process.env.SEED_NEGOCIO_EMAIL || 'admin@comanda.local',
    negocioTelefono: process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
    negocioDireccion: process.env.SEED_NEGOCIO_DIRECCION || 'Av. Principal 123',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@comanda.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    allowDefaultAdminPassword: true
  });

  const result = await seedVisualData(prisma, {
    includeExtraUsers: false,
    credentials: DEMO_CREDENTIALS,
    negocioNombre: process.env.SEED_NEGOCIO_NOMBRE || 'Comanda Demo',
    negocioTelefono: process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
    negocioDireccion: process.env.SEED_NEGOCIO_DIRECCION || 'Av. Principal 123, CABA',
    colorPrimario: '#3B82F6',
    colorSecundario: '#1E40AF',
    taglineNegocio: 'Escenario local con catalogo completo y operacion realista para pruebas.',
    mercadopagoTransferTitular: 'Comanda Demo',
    facturacionDescripcion: 'PV demo local',
    puntoVentaDescripcion: 'Punto de venta demo local'
  });

  printBlock('Credenciales demo', result.credentials.map((item) => `${item.rol}: ${item.email} / ${item.password}`));
  printBlock('URLs utiles', [
    `Menu publico: ${result.urls.menuPublico}`
  ]);
  printBlock('Conteos', Object.entries(result.counts).map(([key, value]) => `${key}: ${value}`));
  console.log('Seed demo completado.');
}

main()
  .catch((error) => {
    console.error('Error en seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
