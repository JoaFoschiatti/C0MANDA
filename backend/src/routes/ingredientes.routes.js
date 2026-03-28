const express = require('express');
const router = express.Router();
const ingredientesController = require('../controllers/ingredientes.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  sucursalQuerySchema,
  crearIngredienteBodySchema,
  actualizarIngredienteBodySchema,
  registrarMovimientoBodySchema,
  ajustarStockBodySchema,
  descartarLoteBodySchema
} = require('../schemas/ingredientes.schemas');

router.use(verificarToken);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(ingredientesController.listar));
router.get('/alertas', validate({ query: sucursalQuerySchema }), asyncHandler(ingredientesController.alertasStock));
router.get('/:id', validate({ params: idParamSchema, query: sucursalQuerySchema }), asyncHandler(ingredientesController.obtener));
router.post('/', esAdmin, validate({ body: crearIngredienteBodySchema }), asyncHandler(ingredientesController.crear));
router.put('/:id', esAdmin, validate({ params: idParamSchema, body: actualizarIngredienteBodySchema }), asyncHandler(ingredientesController.actualizar));
router.post(
  '/:id/movimiento',
  esAdmin,
  validate({ params: idParamSchema, body: registrarMovimientoBodySchema }),
  asyncHandler(ingredientesController.registrarMovimiento)
);
router.post(
  '/:id/ajuste',
  esAdmin,
  validate({ params: idParamSchema, body: ajustarStockBodySchema }),
  asyncHandler(ingredientesController.ajustarStock)
);
router.post(
  '/lotes/:id/descartar',
  esAdmin,
  validate({ params: idParamSchema, body: descartarLoteBodySchema }),
  asyncHandler(ingredientesController.descartarLote)
);

module.exports = router;

