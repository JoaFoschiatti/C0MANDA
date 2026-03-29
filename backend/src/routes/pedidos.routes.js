const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidos.controller');
const { verificarToken, esMozo, esAdmin, verificarRol } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearPedidoBodySchema,
  cambiarEstadoBodySchema,
  agregarItemsBodySchema,
  cancelarBodySchema,
  asignarDeliveryBodySchema
} = require('../schemas/pedidos.schemas');

router.use(verificarToken);

router.get('/', verificarRol('ADMIN', 'CAJERO', 'MOZO'), validate({ query: listarQuerySchema }), asyncHandler(pedidosController.listar));
router.get('/cocina', verificarRol('ADMIN', 'COCINERO', 'CAJERO'), asyncHandler(pedidosController.pedidosCocina));
router.get('/delivery', verificarRol('ADMIN', 'DELIVERY'), asyncHandler(pedidosController.pedidosDelivery));
router.get('/delivery/repartidores', verificarRol('ADMIN', 'CAJERO'), asyncHandler(pedidosController.listarRepartidores));
router.get('/:id', verificarRol('ADMIN', 'CAJERO', 'MOZO'), validate({ params: idParamSchema }), asyncHandler(pedidosController.obtener));
router.post('/', verificarRol('ADMIN', 'CAJERO', 'MOZO'), validate({ body: crearPedidoBodySchema }), asyncHandler(pedidosController.crear));
router.patch('/:id/estado', verificarRol('ADMIN', 'COCINERO', 'CAJERO', 'MOZO', 'DELIVERY'), validate({ params: idParamSchema, body: cambiarEstadoBodySchema }), asyncHandler(pedidosController.cambiarEstado));
router.patch('/:id/asignar-delivery', verificarRol('ADMIN', 'CAJERO'), validate({ params: idParamSchema, body: asignarDeliveryBodySchema }), asyncHandler(pedidosController.asignarDelivery));
router.post('/:id/items', esMozo, validate({ params: idParamSchema, body: agregarItemsBodySchema }), asyncHandler(pedidosController.agregarItems));
router.post('/:id/cancelar', esAdmin, validate({ params: idParamSchema, body: cancelarBodySchema }), asyncHandler(pedidosController.cancelar));
router.post('/:id/cerrar', verificarRol('ADMIN', 'CAJERO'), validate({ params: idParamSchema }), asyncHandler(pedidosController.cerrar));

module.exports = router;

