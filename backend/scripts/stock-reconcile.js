const { loadRuntimeEnv } = require('../src/config/load-env');
const { PrismaClient } = require('@prisma/client');
const { ensureBaseSucursales } = require('../src/services/sucursales.service');
const { ensureIngredienteStock } = require('../src/services/ingrediente-stock.service');
const {
  ensureLegacyLotesCoverage,
  sincronizarStockIngrediente,
  syncIngredienteAggregate
} = require('../src/services/lotes-stock.service');

loadRuntimeEnv();

const prisma = new PrismaClient();

const main = async () => {
  await ensureBaseSucursales(prisma);

  const [ingredientes, sucursales] = await prisma.$transaction([
    prisma.ingrediente.findMany({
      where: { activo: true }
    }),
    prisma.sucursal.findMany({
      where: { activa: true },
      select: { id: true }
    })
  ]);

  let reconciled = 0;

  for (const ingrediente of ingredientes) {
    for (const sucursal of sucursales) {
      await prisma.$transaction(async (tx) => {
        await ensureIngredienteStock(tx, {
          ingredienteId: ingrediente.id,
          sucursalId: sucursal.id,
          useLegacyFallback: true
        });
        await ensureLegacyLotesCoverage(tx, ingrediente, sucursal.id, {
          allowPartialCoverage: true
        });
        await sincronizarStockIngrediente(tx, ingrediente, sucursal.id, new Date(), {
          migrateLegacy: true
        });
        await syncIngredienteAggregate(tx, ingrediente.id);
      });

      reconciled += 1;
    }
  }

  console.log(`Stock reconciliado para ${reconciled} combinaciones ingrediente/sucursal.`);
};

main()
  .catch((error) => {
    console.error('Error reconciliando stock:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
