const { loadRuntimeEnv } = require('../src/config/load-env');
const { PrismaClient } = require('@prisma/client');
const {
  bootstrapCore,
  seedCatalogDemoData
} = require('../src/services/bootstrap.service');
const {
  resetVisualSeedState,
  seedVisualData
} = require('../src/services/visual-seed.service');

loadRuntimeEnv();

const prisma = new PrismaClient();

const printBlock = (title, lines) => {
  console.log(`\n${title}`);
  lines.forEach((line) => console.log(`- ${line}`));
};

async function main() {
  await resetVisualSeedState(prisma);

  await bootstrapCore(prisma, {
    negocioNombre: process.env.SEED_NEGOCIO_NOMBRE || 'Comanda Visual QA',
    negocioEmail: process.env.SEED_NEGOCIO_EMAIL || 'admin@comanda.local',
    negocioTelefono: process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
    negocioDireccion: process.env.SEED_NEGOCIO_DIRECCION || 'Av. Demo 123',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@comanda.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    allowDefaultAdminPassword: true
  });

  await seedCatalogDemoData(prisma);

  const result = await seedVisualData(prisma);

  printBlock('Credenciales demo', result.credentials.map((item) => `${item.rol}: ${item.email} / ${item.password}`));
  printBlock('URLs utiles', [
    `Menu publico: ${result.urls.menuPublico}`
  ]);
  printBlock('Conteos', Object.entries(result.counts).map(([key, value]) => `${key}: ${value}`));

  console.log('\nSeed visual completado.');
}

main()
  .catch((error) => {
    console.error('Error en seed visual:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
