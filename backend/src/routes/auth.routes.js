const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const authController = require('../controllers/auth.controller');
const { verificarToken, esAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { normalizeEmail } = require('../utils/email');
const {
  loginBodySchema,
  registrarBodySchema,
  cambiarPasswordBodySchema,
  mfaCodeBodySchema,
  mfaRecoveryBodySchema
} = require('../schemas/auth.schemas');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.email) || 'anonymous';
    return `${email}|${ipKeyGenerator(req.ip)}`;
  },
  message: {
    error: { message: 'Demasiados intentos de login. Intente nuevamente en unos minutos.' }
  }
});

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  message: {
    error: { message: 'Demasiados intentos de verificacion. Intente nuevamente en unos minutos.' }
  }
});

router.post('/login', loginLimiter, validate({ body: loginBodySchema }), asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.get('/mfa/setup', asyncHandler(authController.getMfaSetup));
router.post('/mfa/setup/confirm', validate({ body: mfaCodeBodySchema }), asyncHandler(authController.confirmMfaSetup));
router.post('/mfa/verify', mfaLimiter, validate({ body: mfaCodeBodySchema }), asyncHandler(authController.verifyMfa));
router.post('/mfa/recovery', mfaLimiter, validate({ body: mfaRecoveryBodySchema }), asyncHandler(authController.recoverWithMfa));

router.post('/registrar', verificarToken, esAdmin, validate({ body: registrarBodySchema }), asyncHandler(authController.registrar));
router.get('/perfil', verificarToken, asyncHandler(authController.perfil));
router.put('/cambiar-password', verificarToken, validate({ body: cambiarPasswordBodySchema }), asyncHandler(authController.cambiarPassword));

module.exports = router;

