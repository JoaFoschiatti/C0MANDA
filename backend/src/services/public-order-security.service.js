const crypto = require('crypto');
const { createHttpError } = require('../utils/http-error');
const { logger } = require('../utils/logger');

const DEFAULT_PUBLIC_MESA_SESSION_TTL_MINUTES = 120;

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '').slice(-15);

const hashPhone = (value) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    return null;
  }

  return crypto.createHash('sha256').update(normalized).digest('hex');
};

const summarizeUserAgent = (value) => {
  const userAgent = String(value || '').trim();
  return userAgent ? userAgent.slice(0, 200) : null;
};

const getRequestIp = (requestMeta = {}) => {
  const forwardedFor = String(requestMeta.forwardedFor || '').split(',')[0]?.trim();
  return forwardedFor || requestMeta.ip || 'unknown';
};

const buildPublicAuditContext = ({
  action,
  requestMeta = {},
  pedidoId = null,
  mesaId = null,
  qrToken = null,
  clientRequestId = null,
  phone = null,
  cause = null,
  blocked = false
}) => ({
  action,
  pedidoId,
  mesaId,
  qrToken,
  clientRequestId,
  phoneHash: hashPhone(phone),
  ip: getRequestIp(requestMeta),
  userAgent: summarizeUserAgent(requestMeta.userAgent),
  blocked,
  cause
});

const logPublicAudit = (payload) => {
  logger.info('Public order audit', buildPublicAuditContext(payload));
};

const logPublicAbuseSignal = (payload) => {
  logger.warn('Public order abuse signal', buildPublicAuditContext({
    ...payload,
    blocked: payload.blocked ?? true
  }));
};

const getMesaSessionTtlMs = () => {
  const configuredMinutes = Number.parseInt(process.env.PUBLIC_MESA_SESSION_TTL_MINUTES || '', 10);
  const minutes = Number.isInteger(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : DEFAULT_PUBLIC_MESA_SESSION_TTL_MINUTES;

  return minutes * 60 * 1000;
};

const generateMesaSessionToken = () => crypto.randomBytes(32).toString('base64url');

const issueMesaPublicSession = async (tx, { mesaId, now = new Date() }) => {
  await tx.mesaPublicSession.updateMany({
    where: {
      mesaId,
      revokedAt: null,
      expiresAt: { lte: now }
    },
    data: {
      revokedAt: now
    }
  });

  const activeSession = await tx.mesaPublicSession.findFirst({
    where: {
      mesaId,
      revokedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { id: 'desc' }
  });

  if (activeSession) {
    return tx.mesaPublicSession.update({
      where: { id: activeSession.id },
      data: {
        lastUsedAt: now,
        expiresAt: new Date(now.getTime() + getMesaSessionTtlMs())
      }
    });
  }

  return tx.mesaPublicSession.create({
    data: {
      mesaId,
      sessionToken: generateMesaSessionToken(),
      expiresAt: new Date(now.getTime() + getMesaSessionTtlMs()),
      lastUsedAt: now
    }
  });
};

const assertActiveMesaPublicSession = async (tx, { mesaId, sessionToken, now = new Date() }) => {
  if (!sessionToken) {
    throw createHttpError.forbidden('La sesion del QR expiro. Vuelve a escanear el codigo.');
  }

  const session = await tx.mesaPublicSession.findUnique({
    where: { sessionToken }
  });

  if (!session || session.mesaId !== mesaId || session.revokedAt || session.expiresAt <= now) {
    throw createHttpError.forbidden('La sesion del QR expiro. Vuelve a escanear el codigo.');
  }

  return tx.mesaPublicSession.update({
    where: { id: session.id },
    data: {
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + getMesaSessionTtlMs())
    }
  });
};

const invalidateMesaPublicSessions = async (tx, { mesaId, now = new Date() }) => {
  if (!tx?.mesaPublicSession?.updateMany) {
    return { count: 0 };
  }

  return tx.mesaPublicSession.updateMany({
    where: {
      mesaId,
      revokedAt: null
    },
    data: {
      revokedAt: now
    }
  });
};

const isDeferredSettlementPedido = (pedido) => (
  pedido?.origen === 'MENU_PUBLICO' &&
  pedido?.tipo !== 'MESA'
);

const buildPedidoPaidUpdateData = (pedido, cobro) => {
  if (!cobro.fullyPaid) {
    return { estadoPago: 'PENDIENTE' };
  }

  if (!isDeferredSettlementPedido(pedido)) {
    return {
      estadoPago: 'APROBADO',
      estado: 'COBRADO'
    };
  }

  if (pedido.estado === 'ENTREGADO') {
    return {
      estadoPago: 'APROBADO',
      estado: 'COBRADO',
      operacionConfirmada: true
    };
  }

  return {
    estadoPago: 'APROBADO',
    operacionConfirmada: true
  };
};

const shouldCloseMesaOnPaid = (pedido, cobro) => (
  cobro.fullyPaid &&
  !isDeferredSettlementPedido(pedido) &&
  Boolean(pedido?.mesaId)
);

module.exports = {
  assertActiveMesaPublicSession,
  buildPedidoPaidUpdateData,
  getRequestIp,
  hashPhone,
  invalidateMesaPublicSessions,
  isDeferredSettlementPedido,
  issueMesaPublicSession,
  logPublicAbuseSignal,
  logPublicAudit,
  shouldCloseMesaOnPaid,
  summarizeUserAgent
};
