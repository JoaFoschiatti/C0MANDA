const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { verificarToken, esAdminOCajero, verificarRol } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  pedidoIdParamSchema,
  registrarPagoBodySchema,
  crearPreferenciaBodySchema
} = require('../schemas/pagos.schemas');

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas solicitudes al webhook' } }
});

// Webhook publico de MercadoPago (sin auth)
router.post('/webhook/mercadopago', webhookLimiter, asyncHandler(pagosController.webhookMercadoPago));

// Rutas protegidas
router.use(verificarToken);

router.post('/', esAdminOCajero, validate({ body: registrarPagoBodySchema }), asyncHandler(pagosController.registrarPago));
router.get('/mercadopago/transferencia-config', verificarRol('ADMIN', 'CAJERO', 'MOZO'), asyncHandler(pagosController.obtenerConfiguracionTransferenciaMercadoPago));
router.post('/mercadopago/preferencia', esAdminOCajero, validate({ body: crearPreferenciaBodySchema }), asyncHandler(pagosController.crearPreferenciaMercadoPago));
router.get('/pedido/:pedidoId', esAdminOCajero, validate({ params: pedidoIdParamSchema }), asyncHandler(pagosController.listarPagosPedido));
router.post('/reembolso', esAdminOCajero, asyncHandler(pagosController.registrarReembolso));
router.get('/pedido/:pedidoId/reembolsos', esAdminOCajero, validate({ params: pedidoIdParamSchema }), asyncHandler(pagosController.listarReembolsos));

module.exports = router;
