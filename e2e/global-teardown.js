const {
  createPrisma,
  cleanupE2EData,
  removeTestData
} = require('./support');

async function globalTeardown() {
  const prisma = createPrisma();

  try {
    console.log('\n[E2E Teardown] Limpiando datos de pruebas...');
    await cleanupE2EData(prisma);
    removeTestData();
    console.log('[E2E Teardown] Limpieza completa.\n');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = globalTeardown;
