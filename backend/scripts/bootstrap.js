const { loadRuntimeEnv } = require('../src/config/load-env');
const { PrismaClient } = require('@prisma/client');
const { bootstrapCore } = require('../src/services/bootstrap.service');

loadRuntimeEnv();

const prisma = new PrismaClient();

const main = async () => {
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD;

  if (process.env.NODE_ENV === 'production' && !adminPassword) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD es obligatorio en produccion.');
  }

  await bootstrapCore(prisma, {
    negocioNombre: process.env.BOOTSTRAP_NEGOCIO_NOMBRE || process.env.SEED_NEGOCIO_NOMBRE || 'Comanda',
    negocioEmail: process.env.BOOTSTRAP_NEGOCIO_EMAIL || process.env.SEED_NEGOCIO_EMAIL || 'admin@comanda.local',
    negocioTelefono: process.env.BOOTSTRAP_NEGOCIO_TELEFONO || process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
    negocioDireccion: process.env.BOOTSTRAP_NEGOCIO_DIRECCION || process.env.SEED_NEGOCIO_DIRECCION || 'Av. Principal 123',
    adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || 'admin@comanda.local',
    adminPassword,
    allowDefaultAdminPassword: process.env.NODE_ENV !== 'production'
  });

  console.log('Bootstrap completado.');
};

main()
  .catch((error) => {
    console.error('Error en bootstrap:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
