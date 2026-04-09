const { getPrisma } = require('../utils/get-prisma');
const mesasService = require('../services/mesas.service');
const pedidosService = require('../services/pedidos.service');
const printService = require('../services/print.service');
const eventBus = require('../services/event-bus');
const { logger } = require('../utils/logger');

const listar = async (req, res) => {
  const prisma = getPrisma(req);
  const mesas = await mesasService.listar(prisma, req.query);
  res.set('Cache-Control', 'no-store');
  res.json(mesas);
};

const obtener = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.obtener(prisma, req.params.id);
  res.json(mesa);
};

const crear = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.crear(prisma, req.body);
  res.status(201).json(mesa);
};

const actualizar = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.actualizar(prisma, req.params.id, req.body);
  res.json(mesa);
};

const cambiarEstado = async (req, res) => {
  const prisma = getPrisma(req);
  const mesa = await mesasService.cambiarEstado(prisma, req.params.id, req.body.estado);
  res.json(mesa);
};

const eliminar = async (req, res) => {
  const prisma = getPrisma(req);
  await mesasService.eliminar(prisma, req.params.id);
  res.status(204).end();
};

const precuenta = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await pedidosService.precuentaMesa(prisma, {
    mesaId: Number(req.params.id),
    usuarioId: req.usuario.id
  });

  let impresion = null;
  try {
    impresion = await printService.enqueuePrintJobs(prisma, result.pedido.id, {
      tipos: ['CAJA', 'CLIENTE'],
      ...(req.idempotency?.printBatchId ? { batchId: req.idempotency.printBatchId } : {})
    });
    eventBus.publish('impresion.updated', {
      pedidoId: result.pedido.id,
      ok: 0,
      total: impresion.total
    });
  } catch (printError) {
    logger.error('Error al imprimir precuenta:', printError);
  }

  eventBus.publish('mesa.updated', {
    mesaId: result.mesa.id,
    estado: result.mesa.estado,
    updatedAt: new Date().toISOString()
  });
  eventBus.publish('pedido.updated', {
    id: result.pedido.id,
    estado: result.pedido.estado,
    estadoPago: result.pedido.estadoPago,
    tipo: result.pedido.tipo,
    mesaId: result.pedido.mesaId || null,
    updatedAt: new Date().toISOString()
  });
  res.json({ ...result, impresion });
};

const liberar = async (req, res) => {
  const prisma = getPrisma(req);
  const result = await pedidosService.liberarMesa(prisma, {
    mesaId: Number(req.params.id),
    usuarioId: req.usuario.id
  });
  eventBus.publish('mesa.updated', {
    mesaId: result.mesa.id,
    estado: result.mesa.estado,
    updatedAt: new Date().toISOString()
  });
  if (result.pedido) {
    eventBus.publish('pedido.updated', {
      id: result.pedido.id,
      estado: result.pedido.estado,
      estadoPago: result.pedido.estadoPago,
      tipo: result.pedido.tipo,
      mesaId: result.pedido.mesaId || null,
      updatedAt: new Date().toISOString()
    });
  }
  res.json(result);
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  precuenta,
  liberar
};
