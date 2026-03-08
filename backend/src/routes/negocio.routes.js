const express = require('express');
const negocioController = require('../controllers/negocio.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { actualizarNegocioBodySchema } = require('../schemas/negocio.schemas');

const router = express.Router();

router.use(verificarToken);
router.use(esAdmin);

router.get('/', asyncHandler(negocioController.obtenerNegocio));
router.put('/', validate({ body: actualizarNegocioBodySchema }), asyncHandler(negocioController.actualizarNegocio));

module.exports = router;

