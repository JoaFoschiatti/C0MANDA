const express = require('express');
const router = express.Router();
const fichajesController = require('../controllers/fichajes.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  usuarioIdParamSchema,
  listarQuerySchema,
  registrarBodySchema,
  calcularHorasQuerySchema,
  editarBodySchema
} = require('../schemas/fichajes.schemas');

router.use(verificarToken);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(fichajesController.listar));
router.post('/entrada', validate({ body: registrarBodySchema }), asyncHandler(fichajesController.registrarEntrada));
router.post('/salida', validate({ body: registrarBodySchema }), asyncHandler(fichajesController.registrarSalida));
router.get('/usuario/:usuarioId/estado', validate({ params: usuarioIdParamSchema }), asyncHandler(fichajesController.estadoUsuario));
router.get(
  '/usuario/:usuarioId/horas',
  validate({ params: usuarioIdParamSchema, query: calcularHorasQuerySchema }),
  asyncHandler(fichajesController.calcularHoras)
);
router.put('/:id', esAdmin, validate({ params: idParamSchema, body: editarBodySchema }), asyncHandler(fichajesController.editar));

module.exports = router;
