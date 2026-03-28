require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const {
  bootstrapCore,
  seedDemoData
} = require('../src/services/bootstrap.service');

const prisma = new PrismaClient();

async function main() {
  await bootstrapCore(prisma, {
    negocioNombre: process.env.SEED_NEGOCIO_NOMBRE || 'Comanda Demo',
    negocioEmail: process.env.SEED_NEGOCIO_EMAIL || 'admin@comanda.local',
    negocioTelefono: process.env.SEED_NEGOCIO_TELEFONO || '11-5555-0000',
    negocioDireccion: process.env.SEED_NEGOCIO_DIRECCION || 'Av. Principal 123',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@comanda.local',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    allowDefaultAdminPassword: true
  });

  await seedDemoData(prisma);

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
