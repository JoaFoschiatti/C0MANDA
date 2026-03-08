const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const controller = require('../controllers/mercadopago-oauth.controller');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { configManualBodySchema, transaccionesQuerySchema } = require('../schemas/mercadopago.schemas');

router.get('/oauth/callback', controller.callbackOAuth);

router.get('/oauth/authorize', verificarToken, verificarRol('ADMIN'), asyncHandler(controller.iniciarOAuth));
router.delete('/oauth/disconnect', verificarToken, verificarRol('ADMIN'), asyncHandler(controller.desconectarOAuth));
router.get('/status', verificarToken, verificarRol('ADMIN'), asyncHandler(controller.obtenerEstado));
router.post('/config/manual', verificarToken, verificarRol('ADMIN'), validate({ body: configManualBodySchema }), asyncHandler(controller.configurarManual));
router.get('/transacciones', verificarToken, verificarRol('ADMIN'), validate({ query: transaccionesQuerySchema }), asyncHandler(controller.listarTransacciones));

module.exports = router;
