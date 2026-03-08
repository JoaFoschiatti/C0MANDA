const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  idParamSchema,
  listarQuerySchema,
  crearUsuarioBodySchema,
  actualizarUsuarioBodySchema
} = require('../schemas/usuarios.schemas');

router.use(verificarToken);
router.use(esAdmin);

router.get('/', validate({ query: listarQuerySchema }), asyncHandler(usuariosController.listar));
router.get('/:id', validate({ params: idParamSchema }), asyncHandler(usuariosController.obtener));
router.post('/', validate({ body: crearUsuarioBodySchema }), asyncHandler(usuariosController.crear));
router.put('/:id', validate({ params: idParamSchema, body: actualizarUsuarioBodySchema }), asyncHandler(usuariosController.actualizar));
router.delete('/:id', validate({ params: idParamSchema }), asyncHandler(usuariosController.eliminar));

module.exports = router;
