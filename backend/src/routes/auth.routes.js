const express = require('express');
const authController = require('../controllers/auth.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const {
  loginBodySchema,
  registrarBodySchema,
  cambiarPasswordBodySchema
} = require('../schemas/auth.schemas');

const router = express.Router();

router.post('/login', validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));

router.post('/registrar', verificarToken, esAdmin, validate({ body: registrarBodySchema }), asyncHandler(authController.registrar));
router.get('/perfil', verificarToken, asyncHandler(authController.perfil));
router.put('/cambiar-password', verificarToken, validate({ body: cambiarPasswordBodySchema }), asyncHandler(authController.cambiarPassword));

module.exports = router;

