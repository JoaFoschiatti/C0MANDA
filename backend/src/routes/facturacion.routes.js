const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacion.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  comprobanteBodySchema,
  comprobanteIdParamSchema,
  configuracionFacturacionBodySchema
} = require('../schemas/facturacion.schemas');

router.use(verificarToken);

router.get(
  '/comprobantes',
  verificarRol('ADMIN', 'CAJERO'),
  asyncHandler(facturacionController.listarComprobantes)
);

router.post(
  '/comprobantes',
  verificarRol('ADMIN', 'CAJERO'),
  validate({ body: comprobanteBodySchema }),
  asyncHandler(facturacionController.crearComprobante)
);

router.get(
  '/comprobantes/:id',
  verificarRol('ADMIN', 'CAJERO'),
  validate({ params: comprobanteIdParamSchema }),
  asyncHandler(facturacionController.obtenerComprobante)
);

router.put(
  '/configuracion',
  verificarRol('ADMIN'),
  validate({ body: configuracionFacturacionBodySchema }),
  asyncHandler(facturacionController.guardarConfiguracion)
);

module.exports = router;

