const express = require('express');
const router = express.Router();
const impresionController = require('../controllers/impresion.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { asyncHandler } = require('../utils/async-handler');
const { getPrisma } = require('../utils/get-prisma');
const { validateBridgeRequest } = require('../services/bridge-auth.service');
const {
  pedidoIdParamSchema,
  jobIdParamSchema,
  imprimirComandaBodySchema,
  previewComandaQuerySchema,
  bridgeClaimBodySchema,
  bridgeAckBodySchema,
  bridgeFailBodySchema
} = require('../schemas/impresion.schemas');

const requireBridgeSignature = async (req, res, next) => {
  try {
    const prisma = getPrisma(req);
    await validateBridgeRequest(prisma, req);
    return next();
  } catch (error) {
    const status = error?.status || 401;
    return res.status(status).json({
      error: {
        message: error?.message || 'Firma de bridge invalida'
      }
    });
  }
};

router.post(
  '/jobs/claim',
  requireBridgeSignature,
  validate({ body: bridgeClaimBodySchema }),
  asyncHandler(impresionController.claimJobs)
);
router.post(
  '/jobs/:id/ack',
  requireBridgeSignature,
  validate({ params: jobIdParamSchema, body: bridgeAckBodySchema }),
  asyncHandler(impresionController.ackJob)
);
router.post(
  '/jobs/:id/fail',
  requireBridgeSignature,
  validate({ params: jobIdParamSchema, body: bridgeFailBodySchema }),
  asyncHandler(impresionController.failJob)
);

router.use(verificarToken);

router.post(
  '/comanda/:pedidoId',
  validate({ params: pedidoIdParamSchema, body: imprimirComandaBodySchema }),
  asyncHandler(impresionController.imprimirComanda)
);
router.get(
  '/comanda/:pedidoId/preview',
  validate({ params: pedidoIdParamSchema, query: previewComandaQuerySchema }),
  asyncHandler(impresionController.previewComanda)
);
router.post(
  '/comanda/:pedidoId/reimprimir',
  validate({ params: pedidoIdParamSchema, body: imprimirComandaBodySchema }),
  asyncHandler(impresionController.reimprimirComanda)
);
router.get('/estado', asyncHandler(impresionController.estadoImpresora));

module.exports = router;
