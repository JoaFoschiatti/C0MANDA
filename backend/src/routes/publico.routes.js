const express = require('express');
const rateLimit = require('express-rate-limit');
const emailService = require('../services/email.service');
const eventBus = require('../services/event-bus');
const { prisma, getNegocio } = require('../db/prisma');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const publicoService = require('../services/publico.service');
const { logger } = require('../utils/logger');
const {
  getRequestIp,
  logPublicAbuseSignal
} = require('../services/public-order-security.service');
const {
  pedidoIdParamSchema,
  qrTokenParamSchema,
  publicOrderAccessQuerySchema,
  publicOrderPaymentBodySchema,
  createPublicOrderBodySchema,
  createPublicTableOrderBodySchema
} = require('../schemas/publico.schemas');

const router = express.Router();

const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=120';

const noopLimiter = (_req, _res, next) => next();

const buildPublicRequestMeta = (req) => ({
  ip: req.ip,
  forwardedFor: req.headers['x-forwarded-for'],
  userAgent: req.headers['user-agent']
});

const normalizePhoneForLimiter = (value) => String(value || '').replace(/\D+/g, '').slice(-15) || 'anon';

const buildLimiter = ({
  name,
  windowMs,
  max,
  keyGenerator,
  message,
  buildSignal
}) => {
  if (process.env.NODE_ENV === 'test') {
    return noopLimiter;
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req, res) => {
      const requestMeta = buildPublicRequestMeta(req);
      const payload = buildSignal
        ? buildSignal(req, requestMeta)
        : { action: name, requestMeta, cause: 'rate-limit' };

      logPublicAbuseSignal({
        ...payload,
        action: name
      });

      res.status(429).json({
        error: { message }
      });
    }
  });
};

const publicOrderingPaused = (kind) => (req, res, next) => {
  const paused = kind === 'table'
    ? process.env.PUBLIC_TABLE_ORDERING_PAUSED === 'true'
    : process.env.PUBLIC_ORDERING_PAUSED === 'true';

  if (!paused) {
    return next();
  }

  logger.warn('Public ordering circuit breaker activo', {
    kind,
    ip: getRequestIp(buildPublicRequestMeta(req))
  });

  return res.status(503).json({
    error: {
      message: kind === 'table'
        ? 'Los pedidos por QR estan temporalmente pausados. Solicita asistencia al personal.'
        : 'Los pedidos online estan temporalmente pausados. Intenta nuevamente en unos minutos.'
    }
  });
};

const createOrderIpLimiter = buildLimiter({
  name: 'public-order-create-ip-limit',
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `public-order:ip:${getRequestIp(buildPublicRequestMeta(req))}`,
  message: 'Demasiados pedidos creados. Intente nuevamente en 1 hora.',
  buildSignal: (_req, requestMeta) => ({
    requestMeta,
    cause: 'ip-hourly-burst'
  })
});

const createOrderBurstLimiter = buildLimiter({
  name: 'public-order-create-burst-limit',
  windowMs: 5 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `public-order:burst:${getRequestIp(buildPublicRequestMeta(req))}`,
  message: 'Demasiados intentos seguidos. Espera unos minutos antes de volver a pedir.',
  buildSignal: (_req, requestMeta) => ({
    requestMeta,
    cause: 'ip-short-burst'
  })
});

const createOrderPhoneLimiter = buildLimiter({
  name: 'public-order-create-phone-limit',
  windowMs: 60 * 60 * 1000,
  max: 6,
  keyGenerator: (req) => `public-order:phone:${normalizePhoneForLimiter(req.body?.clienteTelefono)}`,
  message: 'Este telefono alcanzo el limite temporal de pedidos. Intenta nuevamente mas tarde.',
  buildSignal: (req, requestMeta) => ({
    requestMeta,
    phone: req.body?.clienteTelefono,
    clientRequestId: req.body?.clientRequestId,
    cause: 'phone-hourly-limit'
  })
});

const createOrderClientRequestLimiter = buildLimiter({
  name: 'public-order-client-request-limit',
  windowMs: 10 * 60 * 1000,
  max: 4,
  keyGenerator: (req) => `public-order:client-request:${String(req.body?.clientRequestId || 'missing')}`,
  message: 'Ese intento de pedido se reintento demasiadas veces. Genera uno nuevo y vuelve a intentar.',
  buildSignal: (req, requestMeta) => ({
    requestMeta,
    phone: req.body?.clienteTelefono,
    clientRequestId: req.body?.clientRequestId,
    cause: 'client-request-replay'
  })
});

const tableOrderIpLimiter = buildLimiter({
  name: 'public-table-order-ip-limit',
  windowMs: 15 * 60 * 1000,
  max: 12,
  keyGenerator: (req) => `public-table:ip:${getRequestIp(buildPublicRequestMeta(req))}`,
  message: 'Demasiados intentos desde este origen. Solicita asistencia al personal.',
  buildSignal: (req, requestMeta) => ({
    requestMeta,
    qrToken: req.params.qrToken,
    cause: 'qr-ip-limit'
  })
});

const tableOrderMesaLimiter = buildLimiter({
  name: 'public-table-order-mesa-limit',
  windowMs: 5 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `public-table:mesa:${req.params.qrToken}:${getRequestIp(buildPublicRequestMeta(req))}`,
  message: 'La mesa alcanzo el limite temporal de intentos. Vuelve a escanear el QR o solicita asistencia.',
  buildSignal: (req, requestMeta) => ({
    requestMeta,
    qrToken: req.params.qrToken,
    cause: 'qr-mesa-burst'
  })
});

const paymentRetryLimiter = buildLimiter({
  name: 'public-order-payment-retry-limit',
  windowMs: 10 * 60 * 1000,
  max: 6,
  keyGenerator: (req) => `public-order:retry:${req.params.id}:${getRequestIp(buildPublicRequestMeta(req))}`,
  message: 'Demasiados reintentos de pago. Espera unos minutos antes de volver a intentar.',
  buildSignal: (req, requestMeta) => ({
    requestMeta,
    pedidoId: Number.parseInt(req.params.id, 10) || null,
    cause: 'payment-retry-burst'
  })
});

const getConfigHandler = asyncHandler(async (_req, res) => {
  const result = await publicoService.getPublicConfig(prisma);
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  res.json(result);
});

const getMenuHandler = asyncHandler(async (_req, res) => {
  const categorias = await publicoService.getPublicMenu(prisma, { sucursalId: null });
  res.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  res.json(categorias);
});

const createOrderHandler = asyncHandler(async (req, res) => {
  const negocio = await getNegocio();
  const requestMeta = buildPublicRequestMeta(req);
  const result = await publicoService.createPublicOrder(prisma, {
    negocio,
    body: req.body,
    requestMeta
  });

  result.events.forEach((event) => eventBus.publish(event.topic, event.payload));

  if (result.shouldSendEmail && result.emailPayload) {
    try {
      await emailService.sendOrderConfirmation(result.emailPayload, negocio);
      logger.info('Email de confirmacion enviado a:', result.emailPayload.clienteEmail);
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
  const mesaContext = await publicoService.getPublicTableSession(
    prisma,
    req.params.qrToken,
    buildPublicRequestMeta(req)
  );

  const negocio = await getNegocio();
  const [config, categorias] = await Promise.all([
    publicoService.getPublicConfig(prisma, negocio),
    publicoService.getPublicMenu(prisma, { sucursalId: mesaContext.mesa.sucursalId })
  ]);

  res.json({
    mesa: {
      id: mesaContext.mesa.id,
      numero: mesaContext.mesa.numero,
      zona: mesaContext.mesa.zona,
      capacidad: mesaContext.mesa.capacidad,
      estado: mesaContext.mesa.estado
    },
    mesaSession: mesaContext.session,
    negocio: config.negocio,
    config: config.config,
    categorias
  });
});

const createMesaOrderHandler = asyncHandler(async (req, res) => {
  const result = await publicoService.createPublicTableOrder(prisma, {
    qrToken: req.params.qrToken,
    body: req.body,
    requestMeta: buildPublicRequestMeta(req)
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
router.post(
  '/pedido',
  publicOrderingPaused('web'),
  createOrderIpLimiter,
  createOrderBurstLimiter,
  createOrderPhoneLimiter,
  createOrderClientRequestLimiter,
  validate({ body: createPublicOrderBodySchema }),
  createOrderHandler
);
router.post(
  '/pedido/:id/pagar',
  publicOrderingPaused('web'),
  paymentRetryLimiter,
  validate({ params: pedidoIdParamSchema, body: publicOrderPaymentBodySchema }),
  startPaymentHandler
);
router.get('/pedido/:id', validate({ params: pedidoIdParamSchema, query: publicOrderAccessQuerySchema }), getOrderStatusHandler);
router.get('/mesa/:qrToken', validate({ params: qrTokenParamSchema }), getMesaContextHandler);
router.post(
  '/mesa/:qrToken/pedido',
  publicOrderingPaused('table'),
  tableOrderIpLimiter,
  tableOrderMesaLimiter,
  validate({ params: qrTokenParamSchema, body: createPublicTableOrderBodySchema }),
  createMesaOrderHandler
);

module.exports = router;
