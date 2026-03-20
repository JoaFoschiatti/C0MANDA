const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const emailService = require('../services/email.service');
const eventBus = require('../services/event-bus');
const { prisma, getNegocio } = require('../db/prisma');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const publicoService = require('../services/publico.service');
const { logger } = require('../utils/logger');
const {
  pedidoIdParamSchema,
  qrTokenParamSchema,
  publicOrderAccessQuerySchema,
  publicOrderPaymentBodySchema,
  createPublicOrderBodySchema,
  createPublicTableOrderBodySchema
} = require('../schemas/publico.schemas');

const publicOrderLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      message: {
        error: { message: 'Demasiados pedidos creados. Intente nuevamente en 1 hora.' }
      },
      standardHeaders: true,
      legacyHeaders: false
    });

const getConfigHandler = asyncHandler(async (_req, res) => {
  const result = await publicoService.getPublicConfig(prisma);
  res.json(result);
});

const getMenuHandler = asyncHandler(async (_req, res) => {
  const categorias = await publicoService.getPublicMenu(prisma);
  res.json(categorias);
});

const createOrderHandler = asyncHandler(async (req, res) => {
  const negocio = await getNegocio();
  const result = await publicoService.createPublicOrder(prisma, {
    negocio,
    body: req.body
  });

  result.events.forEach((event) => eventBus.publish(event.topic, event.payload));

  if (result.shouldSendEmail) {
    try {
      await emailService.sendOrderConfirmation(result.pedido, negocio);
      logger.info('Email de confirmacion enviado a:', result.pedido.clienteEmail);
    } catch (emailError) {
      logger.error('Error al enviar email de confirmacion:', emailError);
    }
  }

  res.status(201).json({
    pedido: result.pedido,
    costoEnvio: result.costoEnvio,
    total: result.total,
    initPoint: result.initPoint,
    accessToken: result.accessToken,
    message: 'Pedido creado correctamente'
  });
});

const startPaymentHandler = asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id, 10);
  const negocio = await getNegocio();
  const result = await publicoService.startMercadoPagoPaymentForOrder(prisma, {
    negocio,
    pedidoId,
    accessToken: req.body.token
  });

  res.json(result);
});

const getOrderStatusHandler = asyncHandler(async (req, res) => {
  const pedidoId = parseInt(req.params.id, 10);
  const result = await publicoService.getPublicOrderStatus(prisma, {
    pedidoId,
    accessToken: req.query.token
  });
  result.events.forEach((event) => eventBus.publish(event.topic, event.payload));
  res.json(result.pedido);
});

const getMesaContextHandler = asyncHandler(async (req, res) => {
  const mesa = await prisma.mesa.findUnique({
    where: { qrToken: req.params.qrToken }
  });

  if (!mesa || !mesa.activa) {
    return res.status(404).json({ error: { message: 'Mesa no encontrada' } });
  }

  const negocio = await getNegocio();
  const [config, categorias] = await Promise.all([
    publicoService.getPublicConfig(prisma, negocio),
    publicoService.getPublicMenu(prisma)
  ]);

  res.json({
    mesa: {
      id: mesa.id,
      numero: mesa.numero,
      zona: mesa.zona,
      capacidad: mesa.capacidad,
      estado: mesa.estado,
      qrToken: mesa.qrToken
    },
    negocio: config.negocio,
    config: config.config,
    categorias
  });
});

const createMesaOrderHandler = asyncHandler(async (req, res) => {
  const mesa = await prisma.mesa.findUnique({
    where: { qrToken: req.params.qrToken }
  });

  if (!mesa || !mesa.activa) {
    return res.status(404).json({ error: { message: 'Mesa no encontrada' } });
  }

  const result = await publicoService.createPublicTableOrder(prisma, {
    qrToken: req.params.qrToken,
    body: req.body
  });

  result.events.forEach((event) => eventBus.publish(event.topic, event.payload));

  res.status(201).json({
    mesa: result.mesa,
    pedido: result.pedido,
    message: 'Pedido enviado a la mesa correctamente'
  });
});

router.get('/config', getConfigHandler);
router.get('/menu', getMenuHandler);
router.post('/pedido', publicOrderLimiter, validate({ body: createPublicOrderBodySchema }), createOrderHandler);
router.post('/pedido/:id/pagar', validate({ params: pedidoIdParamSchema, body: publicOrderPaymentBodySchema }), startPaymentHandler);
router.get('/pedido/:id', validate({ params: pedidoIdParamSchema, query: publicOrderAccessQuerySchema }), getOrderStatusHandler);
router.get('/mesa/:qrToken', validate({ params: qrTokenParamSchema }), getMesaContextHandler);
router.post(
  '/mesa/:qrToken/pedido',
  publicOrderLimiter,
  validate({ params: qrTokenParamSchema, body: createPublicTableOrderBodySchema }),
  createMesaOrderHandler
);

module.exports = router;
