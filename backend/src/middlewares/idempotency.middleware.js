const { createHttpError } = require('../utils/http-error');
const { getPrisma } = require('../utils/get-prisma');
const { logger } = require('../utils/logger');
const {
  readIdempotencyKey,
  buildIdempotentPrintBatchId,
  buildIdempotentRequestHash
} = require('../utils/idempotency');
const {
  claimIdempotentRequest,
  completeIdempotentRequest
} = require('../services/idempotency.service');

const replayStoredResponse = (res, record) => {
  const status = record.responseStatus || 200;
  if (record.responseBody === null || record.responseBody === undefined) {
    return res.status(status).end();
  }

  return res.status(status).json(record.responseBody);
};

const idempotency = (operation, options = {}) => async (req, res, next) => {
  const idempotencyKey = readIdempotencyKey(req);
  if (!idempotencyKey) {
    if (options.required) {
      return next(createHttpError.badRequest(`Falta el header ${options.headerName || 'Idempotency-Key'}`));
    }
    return next();
  }

  if (!req.usuario?.id) {
    return next(createHttpError.unauthorized('No se pudo identificar al usuario para idempotencia'));
  }

  const prisma = getPrisma(req);
  const requestHash = buildIdempotentRequestHash({
    operation,
    method: req.method,
    params: req.params,
    query: req.query,
    body: req.body
  });

  const claimedRequest = await claimIdempotentRequest(prisma, {
    usuarioId: req.usuario.id,
    operation,
    idempotencyKey,
    requestHash
  });

  if (claimedRequest.status === 'conflict') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'La misma Idempotency-Key ya fue usada con un payload diferente'
      }
    });
  }

  if (claimedRequest.status === 'in_progress') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'La operacion ya esta en proceso para esta Idempotency-Key'
      }
    });
  }

  if (claimedRequest.status === 'replay') {
    return replayStoredResponse(res, claimedRequest.record);
  }

  req.idempotency = {
    operation,
    idempotencyKey,
    requestId: claimedRequest.record.id,
    requestHash,
    printBatchId: buildIdempotentPrintBatchId({ operation, idempotencyKey })
  };

  let completed = false;
  const originalJson = res.json.bind(res);

  res.json = async (body) => {
    if (!completed && req.idempotency?.requestId) {
      completed = true;
      try {
        await completeIdempotentRequest(prisma, {
          requestId: req.idempotency.requestId,
          responseStatus: res.statusCode,
          responseBody: body
        });
      } catch (error) {
        logger.error('No se pudo persistir la respuesta idempotente', {
          error,
          operation,
          idempotencyKey,
          requestId: req.idempotency.requestId
        });
      }
    }

    return originalJson(body);
  };

  next();
};

module.exports = {
  idempotency
};
