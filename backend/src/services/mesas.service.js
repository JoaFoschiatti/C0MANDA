const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

// Crear servicio CRUD base usando el factory
const baseCrud = createCrudService('mesa', {
  uniqueFields: { numero: 'número' },
  defaultOrderBy: { numero: 'asc' },
  defaultInclude: {
    pedidos: {
      where: { estado: { notIn: ['CERRADO', 'CANCELADO'] } },
      take: 1
    }
  },
  softDelete: true,
  softDeleteField: 'activa',
  entityName: 'mesa',
  gender: 'f',

  // Protección mass assignment
  allowedFilterFields: ['activa', 'estado', 'capacidad'],
  allowedCreateFields: ['numero', 'capacidad', 'activa', 'zona', 'posX', 'posY', 'rotacion', 'grupoMesaId'],
  allowedUpdateFields: ['capacidad', 'activa', 'estado', 'zona', 'posX', 'posY', 'rotacion', 'grupoMesaId']
});

// Sobrescribir obtener para usar include más detallado
const obtener = async (prisma, id) => {
  const mesa = await prisma.mesa.findUnique({
    where: { id },
    include: {
      pedidos: {
        where: { estado: { notIn: ['CERRADO', 'CANCELADO'] } },
        include: { items: { include: { producto: true } } }
      }
    }
  });

  if (!mesa) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  return mesa;
};

// Función específica: cambiar estado de la mesa
const cambiarEstado = async (prisma, id, estado) => {
  const mesaExiste = await prisma.mesa.findUnique({
    where: { id },
    select: { id: true, estado: true }
  });

  if (!mesaExiste) {
    throw createHttpError.notFound('Mesa no encontrada');
  }

  if (mesaExiste.estado === estado) {
    return prisma.mesa.findUnique({ where: { id } });
  }

  const transitionKey = `${mesaExiste.estado}:${estado}`;
  const allowedTransitions = new Set([
    'LIBRE:RESERVADA',
    'RESERVADA:LIBRE'
  ]);

  if (!allowedTransitions.has(transitionKey)) {
    throw createHttpError.badRequest('El estado solicitado no puede cambiarse manualmente');
  }

  return prisma.mesa.update({
    where: { id },
    data: { estado }
  });
};

module.exports = {
  ...baseCrud,
  obtener, // Sobrescribir con versión custom
  cambiarEstado
};

