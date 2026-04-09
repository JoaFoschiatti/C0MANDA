const { Prisma } = require('@prisma/client');

const serializeJsonValue = (value) => {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value));
};

const isUniqueConstraintError = (error) => (
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
);

const claimIdempotentRequest = async (prisma, {
  usuarioId,
  operation,
  idempotencyKey,
  requestHash
}) => {
  try {
    const record = await prisma.idempotentRequest.create({
      data: {
        usuarioId,
        operation,
        idempotencyKey,
        requestHash
      }
    });

    return {
      status: 'started',
      record
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  const record = await prisma.idempotentRequest.findUnique({
    where: {
      usuarioId_operation_idempotencyKey: {
        usuarioId,
        operation,
        idempotencyKey
      }
    }
  });

  if (!record) {
    return claimIdempotentRequest(prisma, {
      usuarioId,
      operation,
      idempotencyKey,
      requestHash
    });
  }

  if (record.requestHash !== requestHash) {
    return {
      status: 'conflict',
      record
    };
  }

  if (record.status === 'COMPLETED') {
    return {
      status: 'replay',
      record
    };
  }

  return {
    status: 'in_progress',
    record
  };
};

const completeIdempotentRequest = async (prisma, {
  requestId,
  responseStatus,
  responseBody
}) => prisma.idempotentRequest.update({
  where: { id: requestId },
  data: {
    status: 'COMPLETED',
    responseStatus,
    responseBody: serializeJsonValue(responseBody)
  }
});

module.exports = {
  claimIdempotentRequest,
  completeIdempotentRequest,
  serializeJsonValue
};
