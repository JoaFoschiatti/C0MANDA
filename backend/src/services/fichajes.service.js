const { createHttpError } = require('../utils/http-error');

const listar = async (prisma, query) => {
  const { usuarioId, fechaDesde, fechaHasta } = query;

  const where = {};
  if (usuarioId) where.usuarioId = usuarioId;
  if (fechaDesde || fechaHasta) {
    where.fecha = {};
    if (fechaDesde) where.fecha.gte = new Date(fechaDesde);
    if (fechaHasta) where.fecha.lte = new Date(fechaHasta);
  }

  return prisma.fichaje.findMany({
    where,
    include: { usuario: { select: { nombre: true, apellido: true } } },
    orderBy: [{ fecha: 'desc' }, { entrada: 'desc' }]
  });
};

const registrarEntrada = async (prisma, usuarioId) => {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.activo) {
    throw createHttpError.badRequest('Usuario no válido');
  }

  const fichajeAbierto = await prisma.fichaje.findFirst({
    where: { usuarioId, salida: null }
  });

  if (fichajeAbierto) {
    throw createHttpError.badRequest('El usuario ya tiene un fichaje de entrada sin salida');
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return prisma.fichaje.create({
    data: {
      usuarioId,
      entrada: new Date(),
      fecha: hoy
    },
    include: { usuario: { select: { nombre: true, apellido: true } } }
  });
};

const registrarSalida = async (prisma, usuarioId) => {
  const fichajeAbierto = await prisma.fichaje.findFirst({
    where: { usuarioId, salida: null }
  });

  if (!fichajeAbierto) {
    throw createHttpError.badRequest('No hay fichaje de entrada para registrar salida');
  }

  return prisma.fichaje.update({
    where: { id: fichajeAbierto.id },
    data: { salida: new Date() },
    include: { usuario: { select: { nombre: true, apellido: true } } }
  });
};

const estadoUsuario = async (prisma, usuarioId) => {
  const fichajeAbierto = await prisma.fichaje.findFirst({
    where: { usuarioId, salida: null }
  });

  return {
    fichado: Boolean(fichajeAbierto),
    fichaje: fichajeAbierto
  };
};

const calcularHoras = async (prisma, usuarioId, fechaDesde, fechaHasta) => {
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

  const horas = Math.floor(totalMinutos / 60);
  const minutos = Math.round(totalMinutos % 60);

  return {
    usuarioId,
    periodo: { desde: fechaDesde, hasta: fechaHasta },
    totalFichajes: fichajes.length,
    horasTotales: totalMinutos / 60,
    formato: `${horas}h ${minutos}m`
  };
};

const editar = async (prisma, id, data) => {
  const fichajeExiste = await prisma.fichaje.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!fichajeExiste) {
    throw createHttpError.notFound('Fichaje no encontrado');
  }

  return prisma.fichaje.update({
    where: { id },
    data: {
      entrada: data.entrada ? new Date(data.entrada) : undefined,
      salida: data.salida ? new Date(data.salida) : undefined
    },
    include: { usuario: { select: { nombre: true, apellido: true } } }
  });
};

module.exports = {
  listar,
  registrarEntrada,
  registrarSalida,
  estadoUsuario,
  calcularHoras,
  editar
};
