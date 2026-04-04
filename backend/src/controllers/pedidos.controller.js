const eventBus = require('../services/event-bus');
const printService = require('../services/print.service');
const { getPrisma } = require('../utils/get-prisma');
const pedidosService = require('../services/pedidos.service');
const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');

const emitPedidoUpdated = (pedido) => {
  if (!pedido) return;
  eventBus.publish('pedido.updated', {
    id: pedido.id,
    estado: pedido.estado,
    estadoPago: pedido.estadoPago,
    tipo: pedido.tipo,
    mesaId: pedido.mesaId || null,
    updatedAt: pedido.updatedAt || new Date().toISOString()
  });
};

const emitMesaUpdated = (mesaId, estado) => {
  if (!mesaId) return;
  eventBus.publish('mesa.updated', {
    mesaId,
    estado,
    updatedAt: new Date().toISOString()
  });
};

const enqueueKitchenRounds = async (prisma, pedidoId, roundIds = []) => {
  if (!roundIds.length) {
    return null;
  }

  const impresion = await printService.enqueuePrintJobs(prisma, pedidoId, {
    tipos: ['COCINA'],
    roundIds
  });

  await pedidosService.markRoundsSentToKitchen(prisma, roundIds);
  return impresion;
};

const allowedStatesByRole = {
  ADMIN: ['EN_PREPARACION', 'LISTO', 'ENTREGADO'],
  CAJERO: ['EN_PREPARACION', 'LISTO', 'ENTREGADO'],
  COCINERO: ['EN_PREPARACION', 'LISTO'],
  MOZO: ['ENTREGADO'],
  DELIVERY: ['ENTREGADO']
};

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await pedidosService.listar(prisma, req.query);
  res.json(result);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const pedido = await pedidosService.obtener(prisma, id);
  res.json(pedido);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const { tipo, mesaId, sucursalId, items, clienteNombre, clienteTelefono, clienteDireccion, observaciones } = req.body;

  if (req.usuario.rol === 'MOZO' && tipo === 'DELIVERY') {
    throw createHttpError.forbidden('Los mozos no pueden crear pedidos de delivery');
  }

  const { pedido, mesaUpdated } = await pedidosService.crearPedido(prisma, {
    tipo,
    mesaId: mesaId ? Number(mesaId) : null,
    sucursalId: sucursalId ? Number(sucursalId) : null,
    items,
    clienteNombre,
    clienteTelefono,
    clienteDireccion,
    observaciones,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedido);
  res.status(201).json(pedido);
};

const cambiarEstado = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { estado } = req.body;
  const usuarioRol = req.usuario.rol;
  const allowedStates = allowedStatesByRole[usuarioRol] || [];

  if (!allowedStates.includes(estado)) {
    throw createHttpError.forbidden('No tienes permiso para cambiar a este estado');
  }

  const { pedidoAntes, pedidoActualizado, roundIdsToPrint, mesaUpdates, productosAgotados } =
    await pedidosService.cambiarEstadoPedido(prisma, { pedidoId: id, estado, usuarioId: req.usuario.id });

  for (const update of mesaUpdates) {
    emitMesaUpdated(update.mesaId, update.estado);
  }

  for (const producto of productosAgotados) {
    eventBus.publish('producto.agotado', {
      id: producto.id,
      nombre: producto.nombre,
      motivo: 'Ingrediente agotado',
      updatedAt: new Date().toISOString()
    });
  }

  let impresion = null;
  if (roundIdsToPrint.length > 0) {
    try {
      impresion = await enqueueKitchenRounds(prisma, pedidoAntes.id, roundIdsToPrint);
      eventBus.publish('impresion.updated', {
        pedidoId: pedidoAntes.id,
        ok: 0,
        total: impresion.total
      });
    } catch (printError) {
      logger.error('Error al encolar impresion:', printError);
    }
  }

  emitPedidoUpdated(pedidoActualizado);
  res.json({ ...pedidoActualizado, impresion });
};

const agregarItems = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { items } = req.body;

  const { pedido, ronda, mesaUpdated, roundIdsToPrint } = await pedidosService.agregarItemsPedido(prisma, {
    pedidoId: id,
    items,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  let impresion = null;
  if (roundIdsToPrint.length > 0) {
    try {
      impresion = await enqueueKitchenRounds(prisma, pedido.id, roundIdsToPrint);
      eventBus.publish('impresion.updated', {
        pedidoId: pedido.id,
        ok: 0,
        total: impresion.total
      });
    } catch (printError) {
      logger.error('Error al encolar impresion incremental:', printError);
    }
  }

  emitPedidoUpdated(pedido);
  res.json({ pedido, ronda, impresion });
};

const cancelar = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { motivo } = req.body;

  const { pedidoCancelado, mesaUpdated } = await pedidosService.cancelarPedido(prisma, {
    pedidoId: id,
    motivo,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedidoCancelado);
  res.json(pedidoCancelado);
};

const cerrar = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;

  const { pedidoActualizado, mesaUpdated } = await pedidosService.cerrarPedido(prisma, {
    pedidoId: id,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedidoActualizado);
  res.json(pedidoActualizado);
};

const pedidosCocina = async (req, res) => {
  const prisma = getPrisma(req);
  const pedidos = await prisma.pedido.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'EN_PREPARACION'] },
      operacionConfirmada: true
    },
    select: {
      id: true,
      tipo: true,
      estado: true,
      createdAt: true,
      observaciones: true,
      mesa: { select: { numero: true } },
      rondas: {
        select: {
          id: true,
          numero: true,
          enviadaCocinaAt: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              cantidad: true,
              observaciones: true,
              producto: { select: { nombre: true } },
              modificadores: {
                select: {
                  id: true,
                  modificador: { select: { nombre: true, tipo: true } }
                }
              }
            }
          }
        },
        orderBy: { numero: 'asc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(pedidos);
};

const pedidosDelivery = async (req, res) => {
  const prisma = getPrisma(req);
  const where = {
    tipo: 'DELIVERY',
    estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'LISTO'] },
    operacionConfirmada: true
  };

  if (req.usuario.rol === 'DELIVERY') {
    where.repartidorId = req.usuario.id;
  }

  const pedidos = await prisma.pedido.findMany({
    where,
    select: {
      id: true,
      estado: true,
      createdAt: true,
      clienteNombre: true,
      clienteTelefono: true,
      clienteDireccion: true,
      total: true,
      observaciones: true,
      items: {
        select: {
          cantidad: true,
          producto: { select: { nombre: true } }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  res.json(pedidos);
};

const listarRepartidores = async (req, res) => {
  const prisma = getPrisma(req);
  const repartidores = await prisma.usuario.findMany({
    where: { rol: 'DELIVERY', activo: true },
    select: { id: true, nombre: true, apellido: true }
  });
  res.json(repartidores);
};

const asignarDelivery = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { repartidorId } = req.body;

  const [pedidoExistente, repartidor] = await Promise.all([
    prisma.pedido.findUnique({ where: { id }, select: { id: true, tipo: true } }),
    prisma.usuario.findUnique({ where: { id: repartidorId }, select: { id: true, rol: true } })
  ]);

  if (!pedidoExistente) {
    throw createHttpError.notFound('Pedido no encontrado');
  }
  if (pedidoExistente.tipo !== 'DELIVERY') {
    throw createHttpError.badRequest('Solo se puede asignar repartidor a pedidos de tipo DELIVERY');
  }
  if (!repartidor || repartidor.rol !== 'DELIVERY') {
    throw createHttpError.badRequest('El usuario seleccionado no es un repartidor');
  }

  const pedido = await prisma.pedido.update({
    where: { id },
    data: { repartidorId },
    include: {
      repartidor: { select: { id: true, nombre: true } },
      mesa: true,
      usuario: { select: { nombre: true } },
      items: { include: { producto: true } }
    }
  });

  emitPedidoUpdated(pedido);
  res.json(pedido);
};

const cambiarMesa = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { nuevoMesaId } = req.body;

  const { pedido, mesaUpdates } = await pedidosService.cambiarMesa(prisma, {
    pedidoId: id,
    nuevoMesaId,
    usuarioId: req.usuario.id
  });

  for (const update of mesaUpdates) {
    emitMesaUpdated(update.mesaId, update.estado);
  }

  emitPedidoUpdated(pedido);
  res.json(pedido);
};

const anularItem = async (req, res) => {
  const prisma = getPrisma(req);
  const { id, itemId } = req.params;
  const { motivo } = req.body;

  const { pedido, mesaUpdated } = await pedidosService.anularItem(prisma, {
    pedidoId: id,
    itemId,
    motivo,
    usuarioId: req.usuario.id
  });

  if (mesaUpdated) {
    emitMesaUpdated(mesaUpdated.mesaId, mesaUpdated.estado);
  }

  emitPedidoUpdated(pedido);
  res.json(pedido);
};

const aplicarDescuento = async (req, res) => {
  const prisma = getPrisma(req);
  const { id } = req.params;
  const { descuento, motivo } = req.body;

  const pedido = await pedidosService.aplicarDescuento(prisma, {
    pedidoId: id,
    descuento,
    motivo,
    usuarioId: req.usuario.id
  });

  emitPedidoUpdated(pedido);
  res.json(pedido);
};

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado,
  agregarItems,
  cancelar,
  cerrar,
  pedidosCocina,
  pedidosDelivery,
  listarRepartidores,
  asignarDelivery,
  cambiarMesa,
  anularItem,
  aplicarDescuento
};
