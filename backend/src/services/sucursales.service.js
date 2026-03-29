const { SUCURSAL_CODIGOS, SUCURSAL_IDS } = require('../constants/sucursales');

const BASE_SUCURSALES = [
  { id: SUCURSAL_IDS.SALON, codigo: SUCURSAL_CODIGOS.SALON, nombre: 'Salon' },
  { id: SUCURSAL_IDS.DELIVERY, codigo: SUCURSAL_CODIGOS.DELIVERY, nombre: 'Delivery' }
];

const ensureBaseSucursales = async (prisma) => {
  await Promise.all(
    BASE_SUCURSALES.map((sucursal) =>
      prisma.sucursal.upsert({
        where: { id: sucursal.id },
        update: {
          codigo: sucursal.codigo,
          nombre: sucursal.nombre,
          activa: true
        },
        create: {
          ...sucursal,
          activa: true
        }
      })
    )
  );
};

const listar = async (prisma) => {
  await ensureBaseSucursales(prisma);
  return prisma.sucursal.findMany({
    where: { activa: true },
    orderBy: { id: 'asc' }
  });
};

module.exports = {
  BASE_SUCURSALES,
  ensureBaseSucursales,
  listar
};
