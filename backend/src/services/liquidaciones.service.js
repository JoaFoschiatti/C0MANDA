const { createHttpError } = require('../utils/http-error');
const { createCrudService } = require('./crud-factory.service');

const baseCrud = createCrudService('liquidacion', {
  defaultOrderBy: { createdAt: 'desc' },
  defaultInclude: {
    usuario: { select: { nombre: true, apellido: true, dni: true } }
  },
  softDelete: false,
  entityName: 'liquidación',
  gender: 'f',

  allowedFilterFields: ['usuarioId', 'pagado'],
  allowedCreateFields: ['usuarioId', 'periodoDesde', 'periodoHasta', 'horasTotales', 'descuentos', 'adicionales', 'observaciones'],

  // Hook: calcular totales antes de crear
  beforeCreate: async (prisma, data) => {
    if (!data.horasTotales || data.horasTotales <= 0) {
      throw createHttpError.badRequest('Las horas trabajadas son requeridas');
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: data.usuarioId }
    });

    if (!usuario) {
      throw createHttpError.notFound('Usuario no encontrado');
    }

    const horas = parseFloat(data.horasTotales);
    const tarifaHora = parseFloat(usuario.tarifaHora);
    const descuentos = data.descuentos || 0;
    const adicionales = data.adicionales || 0;
    const subtotal = horas * tarifaHora;
    const totalPagar = subtotal - descuentos + adicionales;

    return {
      usuarioId: data.usuarioId,
      periodoDesde: new Date(data.periodoDesde),
      periodoHasta: new Date(data.periodoHasta),
      horasTotales: horas,
      tarifaHora: usuario.tarifaHora,
      subtotal,
      descuentos,
      adicionales,
      totalPagar,
      observaciones: data.observaciones || null
    };
  },

  customValidations: {
    eliminar: async (prisma, id, item) => {
      if (item.pagado) {
        throw createHttpError.badRequest(
          'No se puede eliminar una liquidación pagada'
        );
      }
    }
  }
});

// Función de negocio: calcular horas desde fichajes
const calcular = async (prisma, usuarioId, fechaDesde, fechaHasta) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw createHttpError.notFound('Usuario no encontrado');
  }

  const fichajes = await prisma.fichaje.findMany({
    where: {
      usuarioId,
      fecha: {
        gte: new Date(fechaDesde),
        lte: new Date(fechaHasta)
      },
      salida: { not: null }
    }
  });

  let totalMinutos = 0;
  for (const fichaje of fichajes) {
    const entrada = new Date(fichaje.entrada);
    const salida = new Date(fichaje.salida);
    totalMinutos += (salida - entrada) / (1000 * 60);
  }

  const horasTotales = totalMinutos / 60;
  const tarifaHora = parseFloat(usuario.tarifaHora);
  const subtotal = horasTotales * tarifaHora;

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      tarifaHora: usuario.tarifaHora
    },
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    totalFichajes: fichajes.length,
    horasTotales: parseFloat(horasTotales.toFixed(2)),
    tarifaHora,
    subtotal: parseFloat(subtotal.toFixed(2))
  };
};

// Función de negocio: marcar liquidación como pagada
const marcarPagada = async (prisma, id) => {
  const liquidacionExiste = await prisma.liquidacion.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!liquidacionExiste) {
    throw createHttpError.notFound('Liquidación no encontrada');
  }

  return prisma.liquidacion.update({
    where: { id },
    data: {
      pagado: true,
      fechaPago: new Date()
    },
    include: { usuario: { select: { nombre: true, apellido: true } } }
  });
};

module.exports = {
  ...baseCrud,
  calcular,
  marcarPagada
};
