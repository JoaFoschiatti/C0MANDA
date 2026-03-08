const express = require('express');
const rateLimit = require('express-rate-limit');
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

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  message: {
    error: { message: 'Demasiados intentos de login. Intente nuevamente en 5 minutos.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const passwordChangeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  message: {
    error: { message: 'Demasiados intentos de cambio de contrasena. Intente nuevamente en 5 minutos.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  message: {
    error: { message: 'Demasiados intentos de alta de usuarios. Intente nuevamente en 1 hora.' }
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));

router.post('/registrar', registroLimiter, verificarToken, esAdmin, validate({ body: registrarBodySchema }), asyncHandler(authController.registrar));
router.get('/perfil', verificarToken, asyncHandler(authController.perfil));
router.put('/cambiar-password', passwordChangeLimiter, verificarToken, validate({ body: cambiarPasswordBodySchema }), asyncHandler(authController.cambiarPassword));

module.exports = router;

